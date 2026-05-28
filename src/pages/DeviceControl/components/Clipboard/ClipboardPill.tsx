import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  selectPillState,
  type PillState,
  type PillStateResult,
} from "../../hooks/selectPillState";
import type {
  ClipboardCapabilitiesEnvelope,
  ClipboardRefusalReason,
} from "../../services/clipboard/clipboardProtocol.generated";
import {
  PauseIcon,
  ArrowRightIcon,
  WarningIcon,
  SlashIcon,
  OfflineIcon,
  LockIcon,
  BrowserIcon,
} from "./ClipboardPill.icons";

export interface ClipboardPillProps {
  webRtcUp: boolean;
  isPaused: boolean;
  togglePause: () => void;
  status: "idle" | "permission-required" | "unsupported" | "paused";
  cachedDesktopCaps: ClipboardCapabilitiesEnvelope | null;
  lastRefusal: {
    reason: ClipboardRefusalReason;
    at: number;
    source: "remote" | "local";
  } | null;
  lastSyncAt: number | null;
  browserCaps: {
    canRead: boolean;
    canWrite: boolean;
    isSecureContext: boolean;
  };
}

// D-06 per-state background tokens (Tailwind, project palette).
const PILL_BG: Record<PillState, string> = {
  "connected-idle": "bg-accent",
  pulsing: "bg-accent",
  paused: "bg-amber",
  "read-only": "bg-amber",
  "refused-too-large": "bg-amber",
  disabled: "bg-secondary",
  disconnected: "bg-error/60",
  "permission-required": "bg-error/60",
  "unsupported-browser": "bg-secondary",
};

// D-15 i18n key suffix per PillState (matches en/clipboard.ts pill.state.*).
const STATE_TO_LABEL_KEY: Record<PillState, string> = {
  "connected-idle": "pill.state.idle",
  pulsing: "pill.state.pulsing",
  paused: "pill.state.paused",
  "read-only": "pill.state.readOnly",
  "refused-too-large": "pill.state.refusedTooLarge",
  disabled: "pill.state.disabled",
  disconnected: "pill.state.disconnected",
  "permission-required": "pill.state.permissionRequired",
  "unsupported-browser": "pill.state.unsupportedBrowser",
};

function StateIcon({
  state,
  className,
}: {
  state: PillState;
  className?: string;
}) {
  switch (state) {
    case "connected-idle":
    case "pulsing":
      return (
        <span
          className={`inline-block h-2 w-2 rounded-full bg-white ${className ?? ""}`.trim()}
          aria-hidden="true"
        />
      );
    case "paused":
      return <PauseIcon className={className} />;
    case "read-only":
      return <ArrowRightIcon className={className} />;
    case "refused-too-large":
      return <WarningIcon className={className} />;
    case "disabled":
      return <SlashIcon className={className} />;
    case "disconnected":
      return <OfflineIcon className={className} />;
    case "permission-required":
      return <LockIcon className={className} />;
    case "unsupported-browser":
      return <BrowserIcon className={className} />;
  }
}

/**
 * D-08 freshness windows for the hover tooltip:
 *   <2s          → "Just synced"
 *   2s – 59s     → "Last synced N seconds ago" (CLDR plural)
 *   60s – 4m59s  → "Last synced N minutes ago" (CLDR plural)
 *   ≥ 5min       → "Idle"
 *
 * Returns null if no sync has happened yet (the caller falls back to the
 * static tooltipKey from selectPillState).
 */
function computeFreshnessTooltip(
  lastSyncAt: number | null,
  now: number,
  // Accept the i18next TFunction loosely — only the (key, options) shape is
  // exercised here, and the `count` interpolation field is the only option
  // we ever pass.
  t: (key: string, opts?: { count: number }) => string,
): string | null {
  if (lastSyncAt == null || lastSyncAt === 0) return null;
  const ageMs = now - lastSyncAt;
  if (ageMs < 0) return null;
  if (ageMs < 2_000) return t("pill.tooltip.pulsingJustSynced");
  if (ageMs < 60_000) {
    const seconds = Math.max(1, Math.floor(ageMs / 1_000));
    return t("pill.tooltip.pulsingSecondsAgo", { count: seconds });
  }
  if (ageMs < 5 * 60_000) {
    const minutes = Math.max(1, Math.floor(ageMs / 60_000));
    return t("pill.tooltip.pulsingMinutesAgo", { count: minutes });
  }
  return t("pill.tooltip.idleStale");
}

export function ClipboardPill(props: ClipboardPillProps) {
  const { t } = useTranslation("clipboard");

  // Session sync counter per D-07 / Claude's Discretion: ClipboardPill-internal
  // useRef so useClipboardSync's contract stays Phase-15-frozen. Reset on a
  // webRtcUp false→true transition.
  const sessionCount = useRef(0);
  const prevSyncAt = useRef<number | null>(null);
  const prevWebRtcUp = useRef(props.webRtcUp);

  useEffect(() => {
    if (!prevWebRtcUp.current && props.webRtcUp) {
      sessionCount.current = 0;
      prevSyncAt.current = null;
    }
    prevWebRtcUp.current = props.webRtcUp;
  }, [props.webRtcUp]);

  if (props.lastSyncAt != null && props.lastSyncAt !== prevSyncAt.current) {
    sessionCount.current += 1;
    prevSyncAt.current = props.lastSyncAt;
  }

  // selectPillState reads `now` as input but the time-windowed rungs (pulsing,
  // refused-too-large) only resolve when a re-render happens after the window
  // closes. `tick` is bumped from a setTimeout so the pill doesn't get stuck
  // on "Syncing…" / "Too large" past the window's end.
  const [tick, setTick] = useState(0);

  const result: PillStateResult = useMemo(
    () =>
      selectPillState({
        webRtcUp: props.webRtcUp,
        browserCaps: props.browserCaps,
        cachedDesktopCaps: props.cachedDesktopCaps,
        lastRefusal: props.lastRefusal,
        isPaused: props.isPaused,
        lastSyncAt: props.lastSyncAt,
        hookStatus: props.status,
        now: Date.now(),
      }),
    [
      props.webRtcUp,
      props.browserCaps,
      props.cachedDesktopCaps,
      props.lastRefusal,
      props.isPaused,
      props.lastSyncAt,
      props.status,
      tick,
    ],
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const now = Date.now();
    if (result.state === "pulsing" && props.lastSyncAt != null) {
      const delay = Math.max(props.lastSyncAt + 400 - now + 1, 0);
      timer = setTimeout(() => setTick((t) => t + 1), delay);
    } else if (
      result.state === "refused-too-large" &&
      props.lastRefusal != null
    ) {
      const delay = Math.max(props.lastRefusal.at + 5_000 - now + 1, 0);
      timer = setTimeout(() => setTick((t) => t + 1), delay);
    }
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [result.state, props.lastSyncAt, props.lastRefusal]);

  // PILL-01: render nothing until the WebRTC peer connection is up.
  if (!props.webRtcUp) return null;

  const bg = PILL_BG[result.state];
  const isPulsing = result.state === "pulsing";

  // D-08: prefer the freshness tooltip during pulsing/connected-idle (when a
  // recent sync exists); fall back to the static tooltipKey from
  // selectPillState in error / policy / degrade states.
  const freshness = computeFreshnessTooltip(props.lastSyncAt, Date.now(), t);
  const tooltip =
    (isPulsing || result.state === "connected-idle") && freshness
      ? freshness
      : t(result.tooltipKey);

  const className = [
    "mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-white hover:opacity-90",
    bg,
    isPulsing
      ? "animate-pulse [animation-duration:400ms] [animation-iteration-count:1] motion-reduce:animate-none motion-reduce:transition-opacity motion-reduce:duration-[400ms]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={props.togglePause}
      aria-pressed={props.isPaused}
      title={tooltip}
      className={className}
      // RESEARCH Pitfall 3: re-mount on each lastSyncAt change so the one-shot
      // pulse animation re-fires for each successful sync. Static key when not
      // pulsing keeps the button identity stable.
      key={isPulsing ? `pulse-${props.lastSyncAt}` : "static"}
    >
      <span className="flex items-center gap-2">
        <StateIcon state={result.state} className="h-4 w-4" />
        <span>{t(STATE_TO_LABEL_KEY[result.state])}</span>
      </span>
    </button>
  );
}
