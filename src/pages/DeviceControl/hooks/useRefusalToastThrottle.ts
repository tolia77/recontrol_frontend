import { useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "src/components/ui";
import type { ClipboardRefusalReason } from "src/pages/DeviceControl/services/clipboard/clipboardProtocol.generated";

const THROTTLE_MS = 2_000;

/**
 * Per-reason i18n key under the `clipboard:` namespace.
 *
 * Notes:
 * - `CAPS_UNKNOWN` intentionally has no toast. It is a no-op condition for the
 *   operator, so it is simply not surfaced.
 * - `OUTBOUND_DISABLED` is unreachable per the current schema
 *   (clipboardProtocol.generated.ts:57-63) so it is omitted here. The locale
 *   file ships a defensive `toast.refused.outboundDisabled` entry; if a future
 *   schema bump adds the enum member, add it to this map.
 */
const REASON_TO_KEY: Partial<Record<ClipboardRefusalReason, string>> = {
  TOO_LARGE: "toast.refused.tooLarge",
  NON_TEXT: "toast.refused.nonText",
  MASTER_DISABLED: "toast.refused.masterDisabled",
  INBOUND_DISABLED: "toast.refused.inboundDisabled",
  PAUSED: "toast.refused.paused",
  PERMISSION_DENIED: "toast.refused.permissionDenied",
  // CAPS_UNKNOWN intentionally omitted (suppressed — no operator action applies)
};

/**
 * Returns a stable callback that fires a `useToast().warning(t(key))` for the
 * given refusal reason, throttled to at most one toast per reason category per
 * 2 seconds. `CAPS_UNKNOWN` is suppressed entirely.
 *
 * The `?? 0` guard on the per-reason last-fired timestamp is load-bearing:
 * `Map.get` returns `undefined` on first hit; `now - undefined === NaN`;
 * `NaN >= THROTTLE_MS === false` would *block* the first-ever toast. Coercing
 * to 0 makes `now - 0 >= THROTTLE_MS` true on the first fire.
 */
export function useRefusalToastThrottle(): (
  reason: ClipboardRefusalReason,
) => void {
  const { warning } = useToast();
  const { t } = useTranslation("clipboard");
  const lastFiredRef = useRef<Map<ClipboardRefusalReason, number>>(new Map());

  return useCallback(
    (reason: ClipboardRefusalReason) => {
      // CAPS_UNKNOWN is intentionally not toasted (no operator action applies).
      // It is also unmapped in REASON_TO_KEY above.
      if (reason === "CAPS_UNKNOWN") return;

      const key = REASON_TO_KEY[reason];
      if (!key) return; // unknown / unmapped reason — fail closed

      const now = Date.now();
      const last = lastFiredRef.current.get(reason) ?? 0;
      if (now - last < THROTTLE_MS) return;
      lastFiredRef.current.set(reason, now);

      warning(t(key));
    },
    [warning, t],
  );
}
