import { useEffect, useState } from 'react';
import { useTransferQueue } from '../../hooks/useTransferQueue';
import type {
  TransferItem,
  TransferQueue,
  TransferState,
} from '../../services/transfer';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DownloadIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from './icons';

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
export function TransferQueuePanel({
  queue,
  disconnectMessage,
  onDismissDisconnect,
}: TransferQueuePanelProps) {
  const snapshot = useTransferQueue(queue);
  const [collapsed, setCollapsed] = useState(true);

  const inFlightCount = snapshot.items.filter(
    (i) =>
      i.state === 'queued' ||
      i.state === 'active' ||
      i.state === 'cancelling' ||
      i.state === 'stalled',
  ).length;
  // Auto-expand whenever there is at least one in-flight transfer; user can
  // still collapse manually but a NEW enqueue will re-expand. Once the queue
  // drains, the user-controlled `collapsed` flag takes over.
  const expanded = !collapsed || inFlightCount > 0;

  const hasTerminal = snapshot.items.some((i) => isTerminal(i.state));

  return (
    <div className="border-t border-lightgray bg-tertiary text-text text-sm flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 hover:opacity-80"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDownIcon className="w-3 h-3" />
          ) : (
            <ChevronUpIcon className="w-3 h-3" />
          )}
          <span className="font-medium">Transfers</span>
          {snapshot.items.length > 0 && (
            <span className="text-xs text-darkgray">
              ({inFlightCount} active / {snapshot.items.length} total)
            </span>
          )}
        </button>
        {hasTerminal && (
          <button
            type="button"
            onClick={() => queue.clearCompleted()}
            title="Clear completed transfers"
            aria-label="Clear completed transfers"
            className="p-1 rounded hover:bg-background"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="max-h-[180px] overflow-auto px-2 pb-2 space-y-1">
          {/* Plan 11-06: disconnect banner. Renders ABOVE the row list when
              FileManagerPanel detects a status transition out of 'open' while
              a transfer is active. CONTEXT-locked verbatim copy comes from
              the panel; this component is purely presentational. */}
          {disconnectMessage && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-error/10 border border-error rounded text-sm text-error">
              <span>{disconnectMessage}</span>
              <button
                type="button"
                onClick={onDismissDisconnect}
                title="Dismiss"
                aria-label="Dismiss disconnect banner"
                className="p-0.5 rounded hover:bg-background"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {snapshot.items.length === 0 && (
            <p className="text-xs text-darkgray px-2 py-1">No transfers yet.</p>
          )}
          {snapshot.items.map((item) => (
            <TransferRow
              key={item.id}
              item={item}
              onCancel={() => queue.cancelById(item.id)}
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
}

function TransferRow({ item, onCancel }: TransferRowProps) {
  const pct =
    item.size > 0 ? Math.min(100, Math.floor((item.bytesSoFar / item.size) * 100)) : 0;
  const Icon = item.direction === 'upload' ? UploadIcon : DownloadIcon;
  const isActive = item.state === 'active' || item.state === 'stalled';
  const isStalled = item.state === 'stalled';
  const canCancel =
    item.state === 'queued' ||
    item.state === 'active' ||
    item.state === 'stalled';

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
  if (item.state === 'completed') {
    barClass = 'h-full bg-accent transition-all';
  } else if (
    item.state === 'failed' ||
    item.state === 'cancelled' ||
    item.state === 'disconnected'
  ) {
    barClass = 'h-full bg-error';
  } else if (item.state === 'stalled') {
    barClass = 'h-full bg-amber transition-all';
  } else if (isActive || item.state === 'cancelling') {
    barClass = 'h-full bg-secondary transition-all';
  } else {
    // 'queued'
    barClass = 'h-full bg-darkgray';
  }

  return (
    <div className="rounded border border-lightgray bg-background px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate" title={item.name}>
            {item.name}
          </span>
          <span className="text-xs text-darkgray whitespace-nowrap">
            {stateLabel(item.state)}
          </span>
        </div>
        {/* Plan 11-06: stalled rows surface Wait + Cancel inline (replacing
            the X-icon-only treatment). Wait hides the buttons via local
            state until the next state transition; Cancel uses the standard
            queue.cancelById path that the X-icon also drives. */}
        {showStallButtons ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setWaitDismissed(true)}
              aria-label={`Keep waiting for ${item.name}`}
              className="px-2 py-0.5 text-xs border border-lightgray rounded hover:bg-tertiary"
            >
              Wait
            </button>
            <button
              type="button"
              onClick={onCancel}
              aria-label={`Cancel ${item.name}`}
              className="px-2 py-0.5 text-xs border border-error text-error rounded hover:bg-error/10"
            >
              Cancel
            </button>
          </div>
        ) : (
          canCancel && (
            <button
              type="button"
              onClick={onCancel}
              title="Cancel transfer"
              aria-label={`Cancel ${item.name}`}
              className="p-0.5 rounded hover:bg-tertiary"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-darkgray">
        <div className="flex-1 h-1.5 bg-lightgray rounded overflow-hidden">
          <div className={barClass} style={{ width: `${pct}%` }} />
        </div>
        <span className="whitespace-nowrap tabular-nums">
          {formatBytes(item.bytesSoFar)} / {formatBytes(item.size)} ({pct}%)
        </span>
      </div>
      {item.error && (
        <p
          className="mt-1 text-xs text-error truncate"
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
    s === 'completed' ||
    s === 'cancelled' ||
    s === 'failed' ||
    s === 'disconnected'
  );
}

function stateLabel(s: TransferState): string {
  switch (s) {
    case 'queued':
      return 'Queued';
    case 'active':
      return 'Transferring';
    case 'stalled':
      return 'Stalled';
    case 'cancelling':
      return 'Cancelling…';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'disconnected':
      return 'Disconnected';
    case 'failed':
      return 'Failed';
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
