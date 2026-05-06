import { type ClipboardLoopGate } from './clipboardLoopGate';
import { normalizeClipboard } from './clipboardNormalization';
import { hashHex16 } from './clipboardHash';
import type { ClipboardSetEnvelope } from './clipboardProtocol.generated';

export const FOCUS_DAMPEN_MS = 1000;       // CONTEXT D-11
export const MAX_CONTENT_BYTES = 2_000_000; // Phase 13 lock

export function detectCapability(
  nav: Navigator | undefined,
  isSecure: boolean,
): { canRead: boolean; canWrite: boolean; isSecureContext: boolean } {
  const clip = (nav as Navigator | undefined)?.clipboard as
    | { readText?: unknown; writeText?: unknown }
    | undefined;
  const canRead = typeof clip?.readText === 'function';
  const canWrite = typeof clip?.writeText === 'function';
  return { canRead, canWrite, isSecureContext: !!isSecure };
}

export type OutboundDecision =
  | { kind: 'send'; envelope: ClipboardSetEnvelope; hashHex: string; hashBytes: Uint8Array }
  | { kind: 'skip-no-channel' }
  | { kind: 'skip-paused' }
  | { kind: 'skip-not-focused' }
  | { kind: 'skip-dampened' }
  | { kind: 'skip-empty' }
  | { kind: 'skip-non-text' }
  | { kind: 'skip-too-large' }
  | { kind: 'skip-loop-gate' };

export interface PrepareOutboundInput {
  rawText: string | null;
  isPaused: boolean;
  hasFocus: boolean;
  visibilityVisible: boolean;
  nowMs: number;
  lastRemoteApplyTimeMs: number;
  loopGate: ClipboardLoopGate;
  originId: string | null;
}

function hex16ToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i += 1) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// All gates are applied in the load-bearing order from CONTEXT D-13.
// Pause MUST precede focus, focus precedes dampening, dampening precedes
// empty, normalization refusal precedes byte cap, cap precedes loop gate.
export async function prepareOutbound(
  input: PrepareOutboundInput,
  nextSeq: () => number,
): Promise<OutboundDecision> {
  if (!input.originId) return { kind: 'skip-no-channel' };
  if (input.isPaused) return { kind: 'skip-paused' };
  if (!input.visibilityVisible || !input.hasFocus) return { kind: 'skip-not-focused' };
  if (input.nowMs - input.lastRemoteApplyTimeMs < FOCUS_DAMPEN_MS) return { kind: 'skip-dampened' };
  if (input.rawText == null || input.rawText.length === 0) return { kind: 'skip-empty' };

  const norm = normalizeClipboard(input.rawText);
  if (norm.refused) return { kind: 'skip-non-text' };
  const utf8 = new TextEncoder().encode(norm.text);
  if (utf8.byteLength > MAX_CONTENT_BYTES) return { kind: 'skip-too-large' };
  if (utf8.byteLength === 0) return { kind: 'skip-empty' };

  const hashHex = await hashHex16(utf8);
  const hashBytes = hex16ToBytes(hashHex);
  if (input.loopGate.shouldSuppressOutbound(hashBytes)) return { kind: 'skip-loop-gate' };
  if (input.loopGate.shouldSuppressInbound(hashBytes)) return { kind: 'skip-loop-gate' };
  input.loopGate.recordSent(hashBytes);

  const envelope: ClipboardSetEnvelope = {
    kind: 'set',
    content: norm.text,
    originId: input.originId,
    contentHash: hashHex,
    seq: nextSeq(),
    ts: input.nowMs,
  };
  return { kind: 'send', envelope, hashHex, hashBytes };
}

export type InboundDecision =
  | { kind: 'apply'; text: string; hashBytes: Uint8Array }
  | { kind: 'drop-self-origin' }
  | { kind: 'drop-paused' }
  | { kind: 'drop-bad-hash' }
  | { kind: 'drop-too-large' }
  | { kind: 'drop-loop-gate' };

const HEX16_RE = /^[0-9a-f]{16}$/;

// Pure decision (no side effects). Caller MUST call loopGate.recordApplied AFTER
// deciding 'apply' and BEFORE writeText (Pitfall 1 / T-14-34 apply-then-suppress order).
export async function decideInbound(
  env: ClipboardSetEnvelope,
  ourOriginId: string | null,
  isPaused: boolean,
  loopGate: ClipboardLoopGate,
): Promise<InboundDecision> {
  if (ourOriginId !== null && env.originId === ourOriginId) return { kind: 'drop-self-origin' };
  if (isPaused) return { kind: 'drop-paused' };
  if (!env.contentHash || !HEX16_RE.test(env.contentHash)) return { kind: 'drop-bad-hash' };
  const text = env.content ?? '';
  const utf8 = new TextEncoder().encode(text);
  if (utf8.byteLength > MAX_CONTENT_BYTES) return { kind: 'drop-too-large' };
  const expectedHash = await hashHex16(utf8);
  if (expectedHash !== env.contentHash) return { kind: 'drop-bad-hash' };
  const hashBytes = hex16ToBytes(env.contentHash);
  if (loopGate.shouldSuppressInbound(hashBytes)) return { kind: 'drop-loop-gate' };
  return { kind: 'apply', text, hashBytes };
}

export interface ListenerTargets {
  window: Window | {
    addEventListener: typeof window.addEventListener;
    removeEventListener: typeof window.removeEventListener;
  };
  document: Document | {
    addEventListener: typeof document.addEventListener;
    removeEventListener: typeof document.removeEventListener;
    visibilityState: DocumentVisibilityState;
  };
}

/**
 * Binds DEGRADE-02 listeners (BOTH window 'focus' AND document 'visibilitychange').
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
    if ((targets.document as Document).visibilityState === 'visible') onTrigger();
  };
  targets.window.addEventListener('focus', focusHandler);
  targets.document.addEventListener('visibilitychange', visibilityHandler);
  return () => {
    targets.window.removeEventListener('focus', focusHandler);
    targets.document.removeEventListener('visibilitychange', visibilityHandler);
  };
}
