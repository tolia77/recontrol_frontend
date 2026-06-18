import type {
  FilesErrorCode,
  NameConflictMode,
} from "src/pages/DeviceControl/services/files/filesProtocol.generated";

/**
 * Direction of a transfer item from the browser's point of view.
 *  - upload:   browser -> desktop  (drag-drop a local file into the panel)
 *  - download: desktop -> browser  (Enter / double-click / context menu on a remote file)
 */
export type TransferDirection = "upload" | "download";

/**
 * Closed union of every state a TransferItem may occupy.
 *
 * 'stalled' is set by the stall watchdog and 'disconnected' by the disconnect
 * listener; every consumer (TransferQueuePanel row rendering,
 * mapFilesErrorToMessage) handles them so the union stays exhaustive.
 */
export type TransferState =
  | "queued"
  | "active"
  | "stalled" // set by the stall watchdog; defined here so the union is closed
  | "cancelling" // user pressed Cancel; awaiting desktop ack
  | "completed"
  | "cancelled"
  | "disconnected" // set by the disconnect listener; defined here so the union is closed
  | "failed";

/**
 * One row in the queue. Exactly one TransferItem per file (per-file enqueue,
 * not batch entries).
 *
 * This type intentionally has NO `file: File` field. The upload runner holds
 * the source File in a separate Map keyed by item.id, dropped on terminal
 * transition so the underlying File can be GC'd once the entry lands in
 * completed-history.
 */
export interface TransferItem {
  /** Local UUID assigned at enqueue. STABLE for the lifetime of the entry. */
  id: string;
  /**
   * Wire u32 minted desktop-side via files.upload.begin / files.download.begin
   * response. null until the runner has populated it. Never browser-allocated.
   */
  transferId: number | null;
  direction: TransferDirection;
  /** Display name (file basename only). Same string the desktop knows. */
  name: string;
  /** Upload: destination folder. Download: source folder. */
  parentPath: string;
  /** Total bytes; known up-front for both directions. */
  size: number;
  /** Bytes transferred so far; runner updates this via queue.updateItem. */
  bytesSoFar: number;
  /** Upload-only conflict mode passed to files.upload.begin. */
  conflictMode?: NameConflictMode;
  state: TransferState;
  /**
   * Populated when state moves to 'failed' / 'cancelled' / 'disconnected'.
   * `code` is the wire FilesErrorCode for desktop-originated errors, or
   * the synthetic 'CLIENT_ERROR' literal for browser-side failures (e.g.
   * the runner threw, or the queue marked the item as a client cancellation).
   */
  error?: { code: FilesErrorCode | "CLIENT_ERROR"; message: string };
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Snapshot returned by TransferQueue.getSnapshot() and pushed to subscribers.
 * Items are a SHALLOW copy of the queue's internal array so React's reference
 * equality picks up changes; mutating the array does not mutate queue state.
 */
export interface QueueState {
  items: TransferItem[];
  activeId: string | null;
}

/**
 * Runner contract: invoked by TransferQueue.tick when an item is promoted to
 * 'active'. The runner MUST update item.bytesSoFar / item.transferId /
 * item.state via queue.updateItem(id, partial); the runner returns when the
 * transfer reaches a terminal state. Throwing causes the queue to mark the
 * item as 'failed' (or 'cancelled' if isCancelled returned true) and advance
 * to the next queued item.
 */
export type RunUploadFn = (
  item: TransferItem,
  queue: TransferQueueAPI,
) => Promise<void>;
export type RunDownloadFn = (
  item: TransferItem,
  queue: TransferQueueAPI,
) => Promise<void>;

/**
 * Subset of TransferQueue surfaced to runners. Keeps runners narrow and
 * decoupled from queue internals (notify / tick / cancelledIds set).
 */
export interface TransferQueueAPI {
  /** Merge `partial` into the item identified by `id`. No-op if id unknown. */
  updateItem: (id: string, partial: Partial<TransferItem>) => void;
  /** Returns true if the item has been cancelled and the runner should bail. */
  isCancelled: (id: string) => boolean;
}
