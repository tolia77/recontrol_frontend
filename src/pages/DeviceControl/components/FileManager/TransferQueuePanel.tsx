import { useEffect, useMemo, useRef, useState } from "react";
import { useTransferQueue } from "src/pages/DeviceControl/hooks/state/useTransferQueue";
import type { TransferItem, TransferState } from "src/pages/DeviceControl/services/transfer/types";
import type { TransferQueue } from "src/pages/DeviceControl/services/transfer/TransferQueue";
import { SpeedTracker } from "src/pages/DeviceControl/services/transfer/speedTracker";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from "./icons";
import { useTranslation } from "react-i18next";

interface TransferQueuePanelProps {
  queue: TransferQueue;
  /**
   * Plan 11-06: disconnect banner copy supplied by FileManagerPanel when
   * useFilesChannel().status transitions out of 'open' while a transfer is
   * active. CONTEXT-locked literal: "Disconnected during transfer.
   * Reconnect and try again." Null when no banner should render.
   */
  disconnectMessage: string | null;
  /**
   * Invoked when the user clicks the X on the disconnect banner. The panel
   * clears its banner state; the banner ALSO auto-clears when a new transfer
   * starts (queue snapshot.activeId becomes non-null) -- both clear paths
   * are owned by FileManagerPanel.
   */
  onDismissDisconnect: () => void;
}

/**
 * Collapsible bottom strip rendering one row per TransferItem.
 *
 * Layout (CONTEXT-locked in 11-CONTEXT.md): always present below the file
 * manager status bar; ~32 px collapsed, ~120-180 px expanded. Auto-expands
 * whenever a transfer is queued / active / stalled so the user sees in-flight
 * work without clicking; user can collapse manually after the queue drains.
 *
 * Each row shows: direction icon (upload / download), filename, state label,
 * a thin progress bar with state-coloured fill, byte counters, and (while the
 * transfer is still in flight) a Cancel button. Errors render as a one-line
 * red caption below the bar.
 *
 * The panel is purely presentational over a {@link TransferQueue}; it does
 * not own queue lifecycle. {@link FileManagerPanel} constructs the queue once
 * via useRef and threads it down.
 */
function TransferQueuePanel({
  queue,
  disconnectMessage,
  onDismissDisconnect,
}: TransferQueuePanelProps) {
  const { t } = useTranslation("fileManager");
  const snapshot = useTransferQueue(queue);
  const [collapsed, setCollapsed] = useState(true);
  const speedTrackersRef = useRef<Map<string, SpeedTracker>>(new Map());

  const inFlightCount = snapshot.items.filter(
    (i) =>
      i.state === "queued" ||
      i.state === "active" ||
      i.state === "cancelling" ||
      i.state === "stalled",
  ).length;
  // Auto-expand whenever there is at least one in-flight transfer; user can
  // still collapse manually but a NEW enqueue will re-expand. Once the queue
  // drains, the user-controlled `collapsed` flag takes over.
  const expanded = !collapsed || inFlightCount > 0;

  const hasTerminal = snapshot.items.some((i) => isTerminal(i.state));
  const speedById = useMemo(() => {
    const now = Date.now();
    const out = new Map<
      string,
      { bytesPerSecond: number | null; etaSeconds: number | null }
    >();
    for (const item of snapshot.items) {
      if (
        item.state !== "active" &&
        item.state !== "cancelling" &&
        item.state !== "stalled"
      ) {
        continue;
      }
      let tracker = speedTrackersRef.current.get(item.id);
      if (!tracker) {
        tracker = new SpeedTracker();
        speedTrackersRef.current.set(item.id, tracker);
      }
      out.set(item.id, tracker.update(item.bytesSoFar, item.size, now));
    }
    return out;
  }, [snapshot.items]);

  useEffect(() => {
    const liveIds = new Set(snapshot.items.map((item) => item.id));
    for (const id of speedTrackersRef.current.keys()) {
      if (!liveIds.has(id)) speedTrackersRef.current.delete(id);
    }
  }, [snapshot.items]);

  return (
    <div className="border-lightgray bg-tertiary text-text flex-shrink-0 border-t text-sm">
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 hover:opacity-80"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronUpIcon className="h-3 w-3" />
          )}
          <span className="font-medium">{t("transfer.title")}</span>
          {snapshot.items.length > 0 && (
            <span className="text-darkgray text-xs">
              {t("transfer.activeTotal", {
                active: inFlightCount,
                total: snapshot.items.length,
              })}
            </span>
          )}
        </button>
        {hasTerminal && (
          <button
            type="button"
            onClick={() => queue.clearCompleted()}
            title={t("transfer.clearCompleted")}
            aria-label={t("transfer.clearCompleted")}
            className="hover:bg-background rounded p-1"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="max-h-[180px] space-y-1 overflow-auto px-2 pb-2">
          {/* Plan 11-06: disconnect banner. Renders ABOVE the row list when
              FileManagerPanel detects a status transition out of 'open' while
              a transfer is active. CONTEXT-locked verbatim copy comes from
              the panel; this component is purely presentational. */}
          {disconnectMessage && (
            <div className="bg-error/10 border-error text-error flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm">
              <span>{disconnectMessage}</span>
              <button
                type="button"
                onClick={onDismissDisconnect}
                title={t("transfer.dismiss")}
                aria-label={t("transfer.dismiss")}
                className="hover:bg-background rounded p-0.5"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {snapshot.items.length === 0 && (
            <p className="text-darkgray px-2 py-1 text-xs">
              {t("transfer.noTransfersYet")}
            </p>
          )}
          {snapshot.items.map((item) => (
            <TransferRow
              key={item.id}
              item={item}
              onCancel={() => queue.cancelById(item.id)}
              speedEstimate={speedById.get(item.id)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TransferRowProps {
  item: TransferItem;
  onCancel: () => void;
  speedEstimate?: { bytesPerSecond: number | null; etaSeconds: number | null };
  t: ReturnType<typeof useTranslation<"fileManager">>["t"];
}

function TransferRow({ item, onCancel, speedEstimate, t }: TransferRowProps) {
  const pct =
    item.size > 0
      ? Math.min(100, Math.floor((item.bytesSoFar / item.size) * 100))
      : 0;
  const Icon = item.direction === "upload" ? UploadIcon : DownloadIcon;
  const isActive = item.state === "active" || item.state === "stalled";
  const isStalled = item.state === "stalled";
  const canCancel =
    item.state === "queued" ||
    item.state === "active" ||
    item.state === "stalled";
  const showSpeedEta =
    item.state === "active" ||
    item.state === "cancelling" ||
    item.state === "stalled";

  // Plan 11-06: Wait dismissal is component-local UI state (NOT persisted,
  // NOT crossing the wire). Hides the inline Wait+Cancel buttons until the
  // row leaves the 'stalled' state, at which point the flag clears and the
  // buttons rearm for any future stall episode. The intent is "I acknowledge
  // the stall and I'd like to keep waiting" -- the transfer stays in the
  // 'stalled' state until bytes resume (panel-level interval flips it back
  // to 'active') OR another stall episode fires (this same flag arms again
  // because the current episode never ended without a state transition).
  const [waitDismissed, setWaitDismissed] = useState(false);
  useEffect(() => {
    if (!isStalled) setWaitDismissed(false);
  }, [isStalled]);
  const showStallButtons = isStalled && !waitDismissed;

  // State-coloured progress fill (CONTEXT-locked):
  //   queued    -> grey   (bg-darkgray)
  //   active    -> blue   (bg-secondary, the project's blue accent)
  //   stalled   -> amber  (bg-amber)
  //   completed -> green  (bg-accent, the project's green)
  //   failed / cancelled / disconnected -> red (bg-error)
  //   cancelling -> blue (still in flight; treated like active for the bar)
  let barClass: string;
  if (item.state === "completed") {
    barClass = "h-full bg-accent transition-all";
  } else if (
    item.state === "failed" ||
    item.state === "cancelled" ||
    item.state === "disconnected"
  ) {
    barClass = "h-full bg-error";
  } else if (item.state === "stalled") {
    barClass = "h-full bg-amber transition-all";
  } else if (isActive || item.state === "cancelling") {
    barClass = "h-full bg-secondary transition-all";
  } else {
    // 'queued'
    barClass = "h-full bg-darkgray";
  }

  return (
    <div className="border-lightgray bg-background rounded border px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate" title={item.name}>
            {item.name}
          </span>
          <span className="text-darkgray text-xs whitespace-nowrap">
            {stateLabel(item.state, t)}
          </span>
        </div>
        {/* Plan 11-06: stalled rows surface Wait + Cancel inline (replacing
            the X-icon-only treatment). Wait hides the buttons via local
            state until the next state transition; Cancel uses the standard
            queue.cancelById path that the X-icon also drives. */}
        {showStallButtons ? (
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setWaitDismissed(true)}
              aria-label={t("transfer.keepWaitingFor", { name: item.name })}
              className="border-lightgray hover:bg-tertiary rounded border px-2 py-0.5 text-xs"
            >
              {t("transfer.wait")}
            </button>
            <button
              type="button"
              onClick={onCancel}
              aria-label={t("transfer.cancelItem", { name: item.name })}
              className="border-error text-error hover:bg-error/10 rounded border px-2 py-0.5 text-xs"
            >
              {t("transfer.cancel")}
            </button>
          </div>
        ) : (
          canCancel && (
            <button
              type="button"
              onClick={onCancel}
              title={t("transfer.cancelTransfer")}
              aria-label={t("transfer.cancelItem", { name: item.name })}
              className="hover:bg-tertiary rounded p-0.5"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>
      <div className="text-darkgray mt-1 flex items-center gap-2 text-xs">
        <div className="bg-lightgray h-1.5 flex-1 overflow-hidden rounded">
          <div className={barClass} style={{ width: `${pct}%` }} />
        </div>
        <span className="whitespace-nowrap tabular-nums">
          {formatBytes(item.bytesSoFar)} / {formatBytes(item.size)} ({pct}%)
        </span>
      </div>
      {showSpeedEta && (
        <p className="text-darkgray mt-1 text-xs tabular-nums">
          {(speedEstimate?.bytesPerSecond ?? null) !== null
            ? `${formatBytes(speedEstimate?.bytesPerSecond ?? 0)}/s`
            : t("transfer.speedUnknown")}{" "}
          · {t("transfer.etaLabel")}{" "}
          {speedEstimate?.etaSeconds !== null &&
          speedEstimate?.etaSeconds !== undefined
            ? formatEta(speedEstimate.etaSeconds)
            : t("transfer.etaUnknown")}
        </p>
      )}
      {item.error && (
        <p
          className="text-error mt-1 truncate text-xs"
          title={item.error.message}
        >
          {item.error.message}
        </p>
      )}
    </div>
  );
}

function isTerminal(s: TransferState): boolean {
  return (
    s === "completed" ||
    s === "cancelled" ||
    s === "failed" ||
    s === "disconnected"
  );
}

function stateLabel(
  s: TransferState,
  t: ReturnType<typeof useTranslation<"fileManager">>["t"],
): string {
  switch (s) {
    case "queued":
      return t("transfer.states.queued");
    case "active":
      return t("transfer.states.transferring");
    case "stalled":
      return t("transfer.states.stalled");
    case "cancelling":
      return t("transfer.states.cancelling");
    case "completed":
      return t("transfer.states.completed");
    case "cancelled":
      return t("transfer.states.cancelled");
    case "disconnected":
      return t("transfer.states.disconnected");
    case "failed":
      return t("transfer.states.failed");
  }
}

/**
 * Local byte formatter for the queue panel. Stays compact (no decimals at the
 * byte scale; one decimal for KB/MB; two decimals for GB) and uses 1024-base
 * units consistent with the rest of the file manager.
 */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatEta(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export default TransferQueuePanel;
