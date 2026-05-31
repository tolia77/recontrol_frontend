import type { ChunkHeader } from "src/pages/DeviceControl/services/files/ChunkHeader";

/**
 * Closed state machine for a single browser-side download.
 *
 *   pending --start()--> receiving --finalize()--> finalizing --> done
 *      |                     |                                      ^
 *      |                     +------ cancel() ----> cancelled       |
 *      +------ cancel() ----> cancelled  (terminal)                 |
 *                                                                    |
 *   finalize() is a NO-OP when state === 'cancelled'  (cancel-discard contract)
 *   cancel()   is a NO-OP when state === 'done'       (cancel-discard contract)
 *
 * The cancel-discard contract is enforced INSIDE this class. It MUST NOT live in
 * any caller; the state machine is the single source of truth so a cancel that
 * races finalize cannot accidentally drop a file in the user's Downloads folder
 * after they hit Cancel (CONTEXT-locked semantics).
 *
 * Chunk accumulation: chunks are stored as ArrayBuffer[] then assembled into one
 * Blob at finalize time -- NEVER pre-concatenated per chunk (RESEARCH Pitfall:
 * O(n^2) memory churn on large downloads).
 *
 * Anchor-tag finalize: createObjectURL + a.download = name + a.click + 60s
 * setTimeout-deferred URL.revokeObjectURL (RESEARCH Pitfall 4: Safari Blob URL
 * revocation safety -- synchronous revoke can break the in-flight save).
 */
export type DownloadState =
  | "pending"
  | "receiving"
  | "finalizing"
  | "done"
  | "cancelled";

export class DownloadTransfer {
  // erasableSyntaxOnly tsconfig forbids constructor parameter properties; use
  // explicit field declarations + body-side assignment (same pattern as
  // TransferQueue.ts in Plan 11-03).
  readonly transferId: number;
  readonly name: string;
  readonly totalBytes: number;
  private readonly onProgress: (bytesSoFar: number) => void;

  private chunks: ArrayBuffer[] = [];
  private receivedBytes = 0;
  private state: DownloadState = "pending";
  private blobUrl: string | null = null;

  /**
   * Wall-clock timestamp of the most recent chunk arrival. Plan 11-06's stall
   * watchdog reads this to decide when to flip the row state to 'stalled'.
   */
  lastChunkAtMs = Date.now();

  constructor(
    transferId: number,
    name: string,
    totalBytes: number,
    onProgress: (bytesSoFar: number) => void,
  ) {
    this.transferId = transferId;
    this.name = name;
    this.totalBytes = totalBytes;
    this.onProgress = onProgress;
  }

  start(): void {
    if (this.state !== "pending") return;
    this.state = "receiving";
  }

  /**
   * Append `payload` to the buffered chunks. Returns true on success; returns
   * false (without touching state) when the transfer is no longer 'receiving'
   * (e.g. cancelled). Returns false AFTER self-cancelling on offset mismatch:
   * SCTP delivers in order, so a mismatch indicates corruption -- aborting
   * the download is safer than silently producing a torn file.
   *
   * `header.offset` is a JS `number` (ChunkHeader on this side stores u64 as
   * a JS number; safe to ~9 PiB for any realistic browser-memory download).
   */
  onChunk(header: ChunkHeader, payload: ArrayBuffer): boolean {
    if (this.state !== "receiving") return false;
    if (header.offset !== this.receivedBytes) {
      // Sanity: SCTP delivers in order. Mismatch = corruption -- abort.
      this.cancel();
      return false;
    }
    this.chunks.push(payload);
    this.receivedBytes += payload.byteLength;
    this.lastChunkAtMs = Date.now();
    this.onProgress(this.receivedBytes);
    return true;
  }

  /**
   * Assemble the blob, fire the anchor-tag click, and defer URL revocation.
   * NO-OP if state === 'cancelled' or already 'done' (CONTEXT cancel-discard
   * contract).
   *
   * Synchronous click() inside the same event-loop turn is load-bearing:
   * Safari's popup blocker treats deferred .click() as user-action-less and
   * blocks the download (RESEARCH Pitfall 8). The download.complete event
   * dispatcher in runDownload calls finalize() synchronously from the event
   * listener so we ride the user gesture on Safari too.
   */
  finalize(): void {
    if (this.state === "cancelled") return;
    if (this.state === "done") return;
    this.state = "finalizing";

    const blob = new Blob(this.chunks, { type: "application/octet-stream" });
    // Release ArrayBuffer references; the Blob now owns the bytes.
    this.chunks.length = 0;
    this.blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = this.blobUrl;
    a.download = this.name;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Safari Blob URL revocation safety (RESEARCH Pitfall 4): synchronous
    // revoke can interrupt the save dialog / the implicit Downloads-folder
    // write. 60s gives every browser plenty of headroom while still
    // releasing the URL eventually.
    const url = this.blobUrl;
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);
    this.blobUrl = null;
    this.state = "done";
  }

  /**
   * Discard buffered chunks; revoke any in-flight blob URL; flip terminal.
   * NO-OP if state === 'done' (CONTEXT cancel-discard contract: a complete
   * file already left the runner via finalize, and cancelling AFTER that
   * point would not undo the user's downloaded copy).
   */
  cancel(): void {
    if (this.state === "done") return;
    this.state = "cancelled";
    this.chunks.length = 0;
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }

  get currentState(): DownloadState {
    return this.state;
  }

  get bytesReceived(): number {
    return this.receivedBytes;
  }
}
