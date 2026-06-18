import type {
  ClipboardCapabilitiesEnvelope,
  ClipboardRefusalReason,
} from "src/pages/DeviceControl/services/clipboard/clipboardProtocol.generated";
import type { ClipboardCapability } from "./useClipboardCapability";

/**
 * The distinct pill states. Visual treatment lives in the consuming component
 * (ClipboardPill.tsx).
 */
export type PillState =
  | "connected-idle"
  | "pulsing"
  | "paused"
  | "read-only"
  | "permission-required"
  | "disconnected"
  | "disabled"
  | "refused-too-large"
  | "unsupported-browser";

export interface SelectPillStateInput {
  webRtcUp: boolean;
  browserCaps: ClipboardCapability;
  cachedDesktopCaps: ClipboardCapabilitiesEnvelope | null;
  lastRefusal: {
    reason: ClipboardRefusalReason;
    at: number;
    source: "remote" | "local";
  } | null;
  isPaused: boolean;
  lastSyncAt: number | null;
  hookStatus: "idle" | "permission-required" | "unsupported" | "paused";
  /** Injected current time so tests can pin time deterministically. */
  now: number;
}

export interface PillStateResult {
  state: PillState;
  tooltipKey: string;
}

const REFUSAL_HOLD_MS = 5_000;
const PULSE_WINDOW_MS = 400;

/**
 * Pure selector for the clipboard sync pill.
 *
 * Precedence ladder — first true wins:
 *  1. disconnected         (WebRTC down)
 *  2. unsupported-browser  (Async Clipboard API missing OR insecure context)
 *  3. permission-required  (browser denied clipboard permission)
 *  4. disabled             (master off — both directions disabled)
 *  5. read-only            (exactly one direction disabled)
 *  6. refused-too-large    (last TOO_LARGE refusal within 5s)
 *  7. paused               (operator paused, no higher-priority signal)
 *  8. pulsing              (synced within last 400ms)
 *  9. connected-idle       (default)
 *
 * `now` is an input parameter — the function never reads the system clock — so
 * the fixture-table test in `selectPillState.test.ts` pins time
 * deterministically.
 */
export function selectPillState(input: SelectPillStateInput): PillStateResult {
  // Rung 1
  if (!input.webRtcUp) {
    return { state: "disconnected", tooltipKey: "pill.tooltip.disconnected" };
  }

  // Rung 2: feature-presence missing OR insecure context.
  if (
    (!input.browserCaps.canRead && !input.browserCaps.canWrite) ||
    !input.browserCaps.isSecureContext
  ) {
    return {
      state: "unsupported-browser",
      tooltipKey: "pill.tooltip.unsupportedBrowser",
    };
  }

  // Rung 3
  if (input.hookStatus === "permission-required") {
    return {
      state: "permission-required",
      tooltipKey: "pill.tooltip.permissionRequired",
    };
  }

  // Rung 4: master-off inferred from both directions disabled.
  if (
    input.cachedDesktopCaps?.outboundEnabled === false &&
    input.cachedDesktopCaps?.inboundEnabled === false
  ) {
    return { state: "disabled", tooltipKey: "pill.tooltip.disabled" };
  }

  // Rung 5: exactly one of the two directions disabled.
  if (
    input.cachedDesktopCaps &&
    input.cachedDesktopCaps.outboundEnabled !==
      input.cachedDesktopCaps.inboundEnabled
  ) {
    return { state: "read-only", tooltipKey: "pill.tooltip.readOnly" };
  }

  // Rung 6: only TOO_LARGE pins this state, and only within the 5s hold window.
  if (
    input.lastRefusal?.reason === "TOO_LARGE" &&
    input.now - input.lastRefusal.at < REFUSAL_HOLD_MS
  ) {
    return {
      state: "refused-too-large",
      tooltipKey: "pill.tooltip.refusedTooLarge",
    };
  }

  // Rung 7
  if (input.isPaused) {
    return { state: "paused", tooltipKey: "pill.tooltip.paused" };
  }

  // Rung 8: 400ms pulse window after the most recent successful sync.
  if (
    input.lastSyncAt != null &&
    input.now - input.lastSyncAt < PULSE_WINDOW_MS
  ) {
    return { state: "pulsing", tooltipKey: "pill.tooltip.pulsingJustSynced" };
  }

  // Rung 9
  return { state: "connected-idle", tooltipKey: "pill.tooltip.idle" };
}
