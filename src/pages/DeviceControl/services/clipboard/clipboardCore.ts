import { type ClipboardLoopGate } from "./clipboardLoopGate";
import { normalizeClipboard } from "./clipboardNormalization";
import { hashHex16 } from "./clipboardHash";
import type {
  ClipboardCapabilitiesEnvelope,
  ClipboardSetEnvelope,
} from "./clipboardProtocol.generated";

export const FOCUS_DAMPEN_MS = 1000;
export const MAX_CONTENT_BYTES = 2_000_000;

export function detectCapability(
  nav: Navigator | undefined,
  isSecure: boolean,
): { canRead: boolean; canWrite: boolean; isSecureContext: boolean } {
  const clip = (nav as Navigator | undefined)?.clipboard as
    | { readText?: unknown; writeText?: unknown }
    | undefined;
  const canRead = typeof clip?.readText === "function";
  const canWrite = typeof clip?.writeText === "function";
  return { canRead, canWrite, isSecureContext: !!isSecure };
}

// Subset of ClipboardRefusalReason that the browser can self-emit as a local
// refusal. Excludes 'PAUSED' because the browser-local pause path returns
// `skip-paused` and the user already knows they paused, so pause stays out of
// the refusal feed. Includes CAPS_UNKNOWN so the UI can show an honest
// "waiting for desktop" toast instead of the misleading MASTER_DISABLED.
export type RefusalReasonForLocal =
  | "INBOUND_DISABLED"
  | "MASTER_DISABLED"
  | "TOO_LARGE"
  | "NON_TEXT"
  | "CAPS_UNKNOWN";

// Non-text and too-large inputs both surface as 'refused-local' (with a reason)
// rather than as silent skip-* variants, so they reach the refusal feed.
export type OutboundDecision =
  | {
      kind: "send";
      envelope: ClipboardSetEnvelope;
      hashHex: string;
      hashBytes: Uint8Array;
    }
  | { kind: "skip-no-channel" }
  | { kind: "skip-paused" }
  | { kind: "skip-not-focused" }
  | { kind: "skip-dampened" }
  | { kind: "skip-empty" }
  | { kind: "skip-loop-gate" }
  | { kind: "refused-local"; reason: RefusalReasonForLocal };

export interface PrepareOutboundInput {
  rawText: string | null;
  isPaused: boolean;
  hasFocus: boolean;
  visibilityVisible: boolean;
  nowMs: number;
  lastRemoteApplyTimeMs: number;
  loopGate: ClipboardLoopGate;
  originId: string | null;
  /**
   * Latest desktop capabilities envelope received via ClipboardChannelClient
   * subscribeCapabilities, or null if none received yet.
   */
  cachedDesktopCaps: ClipboardCapabilitiesEnvelope | null;
}

function hex16ToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i += 1) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Gates are applied in a load-bearing order:
// pause -> focus -> dampening -> empty -> normalization refusal -> byte cap -> loop gate.
export async function prepareOutbound(
  input: PrepareOutboundInput,
  nextSeq: () => number,
): Promise<OutboundDecision> {
  if (!input.originId) return { kind: "skip-no-channel" };

  // Cap-cache says desktop's inbound is off -> preempt before sending.
  // Browser does not separately track desktop's "master" toggle; SendCapabilities
  // on the desktop folds master into outboundEnabled / inboundEnabled, so a false
  // here is sufficient.
  if (
    input.cachedDesktopCaps &&
    input.cachedDesktopCaps.inboundEnabled === false
  ) {
    return { kind: "refused-local", reason: "INBOUND_DISABLED" };
  }

  if (input.isPaused) return { kind: "skip-paused" };
  if (!input.visibilityVisible || !input.hasFocus)
    return { kind: "skip-not-focused" };
  if (input.nowMs - input.lastRemoteApplyTimeMs < FOCUS_DAMPEN_MS)
    return { kind: "skip-dampened" };
  if (input.rawText == null || input.rawText.length === 0)
    return { kind: "skip-empty" };

  const norm = normalizeClipboard(input.rawText);
  // Surface non-text content as a refusal (not a silent skip) so it reaches the
  // lastRefusal feed.
  if (norm.refused) return { kind: "refused-local", reason: "NON_TEXT" };
  const utf8 = new TextEncoder().encode(norm.text);
  // Likewise surface over-cap content as a refusal for the lastRefusal feed.
  if (utf8.byteLength > MAX_CONTENT_BYTES)
    return { kind: "refused-local", reason: "TOO_LARGE" };
  if (utf8.byteLength === 0) return { kind: "skip-empty" };

  const hashHex = await hashHex16(utf8);
  const hashBytes = hex16ToBytes(hashHex);
  if (input.loopGate.shouldSuppressOutbound(hashBytes))
    return { kind: "skip-loop-gate" };
  if (input.loopGate.shouldSuppressInbound(hashBytes))
    return { kind: "skip-loop-gate" };
  input.loopGate.recordSent(hashBytes);

  const envelope: ClipboardSetEnvelope = {
    kind: "set",
    content: norm.text,
    originId: input.originId,
    contentHash: hashHex,
    seq: nextSeq(),
    ts: input.nowMs,
  };
  return { kind: "send", envelope, hashHex, hashBytes };
}

export type InboundDecision =
  | { kind: "apply"; text: string; hashBytes: Uint8Array }
  | { kind: "drop-self-origin" }
  | { kind: "drop-paused" }
  | { kind: "drop-bad-hash" }
  | { kind: "drop-too-large" }
  | { kind: "drop-loop-gate" };

const HEX16_RE = /^[0-9a-f]{16}$/;

// Pure decision (no side effects). Caller MUST call loopGate.recordApplied AFTER
// deciding 'apply' and BEFORE writeText, or the resulting clipboard change can
// echo back through the outbound path.
export async function decideInbound(
  env: ClipboardSetEnvelope,
  ourOriginId: string | null,
  isPaused: boolean,
  loopGate: ClipboardLoopGate,
): Promise<InboundDecision> {
  if (ourOriginId !== null && env.originId === ourOriginId)
    return { kind: "drop-self-origin" };
  if (isPaused) return { kind: "drop-paused" };
  if (!env.contentHash || !HEX16_RE.test(env.contentHash))
    return { kind: "drop-bad-hash" };
  const text = env.content ?? "";
  const utf8 = new TextEncoder().encode(text);
  if (utf8.byteLength > MAX_CONTENT_BYTES) return { kind: "drop-too-large" };
  const expectedHash = await hashHex16(utf8);
  if (expectedHash !== env.contentHash) return { kind: "drop-bad-hash" };
  const hashBytes = hex16ToBytes(env.contentHash);
  if (loopGate.shouldSuppressInbound(hashBytes))
    return { kind: "drop-loop-gate" };
  return { kind: "apply", text, hashBytes };
}

export interface ListenerTargets {
  window:
    | Window
    | {
        addEventListener: typeof window.addEventListener;
        removeEventListener: typeof window.removeEventListener;
      };
  document:
    | Document
    | {
        addEventListener: typeof document.addEventListener;
        removeEventListener: typeof document.removeEventListener;
        visibilityState: DocumentVisibilityState;
      };
}

/**
 * Binds BOTH window 'focus' AND document 'visibilitychange' listeners.
 * Returns a cleanup function that removes both.
 * The handler is called via a closure -- it MUST be stable across re-renders or the
 * listener will rebind every render. Caller is responsible for stability.
 */
export function bindFocusVisibilityListeners(
  targets: ListenerTargets,
  onTrigger: () => void,
): () => void {
  const focusHandler = (): void => {
    onTrigger();
  };
  const visibilityHandler = (): void => {
    if ((targets.document as Document).visibilityState === "visible")
      onTrigger();
  };
  targets.window.addEventListener("focus", focusHandler);
  targets.document.addEventListener("visibilitychange", visibilityHandler);
  return () => {
    targets.window.removeEventListener("focus", focusHandler);
    targets.document.removeEventListener("visibilitychange", visibilityHandler);
  };
}
