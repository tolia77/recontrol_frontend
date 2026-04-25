import type {
  QueueState,
  RunDownloadFn,
  RunUploadFn,
  TransferItem,
  TransferQueueAPI,
} from './types';

/**
 * Maximum number of terminal-state entries retained in completed history.
 * Older entries are dropped (oldest-completedAt first) once the count exceeds
 * this. CONTEXT-locked at 10 in 11-CONTEXT.md.
 */
const HISTORY_LIMIT = 10;

const TERMINAL: ReadonlySet<TransferItem['state']> = new Set([
  'completed',
  'cancelled',
  'failed',
  'disconnected',
]);

/**
 * Sequential, in-memory queue for upload + download transfers.
 *
 * TRANSFER-01 invariant: at most ONE active transfer at a time. tick() is the
 * single dispatch point; it short-circuits if activeId !== null. Promotion of
 * the next 'queued' item happens in tick()'s finally block, after the previous
 * runner has resolved AND the previous item has been moved to a terminal
 * state. Pitfall "starting next transfer before complete handshake resolves"
 * is closed by the await + finally ordering.
 *
 * The queue is NOT persisted to any storage. CONTEXT-locks "queue survives
 * panel close" as Phase 12. A panel close + reopen creates a fresh queue.
 *
 * Runner contract: runUpload / runDownload are injected at construction.
 * Plan 11-04 will pass the real upload runner; plan 11-05 the download
 * runner. This plan only ships stub implementations (see FileManagerPanel.tsx)
 * so the surface is exercisable end-to-end before runners exist.
 */
export class TransferQueue implements TransferQueueAPI {
  private items: TransferItem[] = [];
  private activeId: string | null = null;
  /** ids the user has cancelled while still active; cleared on terminal transition. */
  private cancelledIds = new Set<string>();
  private listeners = new Set<(s: QueueState) => void>();
  private readonly runUpload: RunUploadFn;
  private readonly runDownload: RunDownloadFn;

  constructor(runUpload: RunUploadFn, runDownload: RunDownloadFn) {
    this.runUpload = runUpload;
    this.runDownload = runDownload;
  }

  // ---------- Public API consumed by hooks / panel ----------

  /**
   * Append `item` to the queue and trigger a tick. If no transfer is
   * currently active, the runner for `item` will start on the next
   * microtask. If a transfer is in flight, `item` will sit in 'queued'
   * state until the runner resolves.
   */
  enqueue(item: TransferItem): void {
    this.items.push(item);
    this.notify();
    void this.tick();
  }

  /**
   * Cancel the currently active transfer. No-op if nothing is active.
   * The runner observes `isCancelled(item.id)` and is expected to bail
   * out, sending files.transfer.cancel to the desktop and resolving its
   * promise; tick()'s finally block then marks the item as 'cancelled'.
   */
  cancelActive(): void {
    if (this.activeId !== null) this.cancelById(this.activeId);
  }

  /**
   * Cancel a specific item by id. Works for both 'queued' and 'active'
   * items. For 'queued' items the state immediately flips to 'cancelled'
   * (since no runner is involved yet). For 'active' items the state moves
   * to 'cancelling' and the runner is expected to observe isCancelled and
   * bail.
   */
  cancelById(id: string): void {
    this.cancelledIds.add(id);
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    const cur = this.items[idx];
    if (cur.state === 'queued') {
      // Not yet started -- skip 'cancelling' and go straight to terminal.
      this.items[idx] = {
        ...cur,
        state: 'cancelled',
        completedAt: Date.now(),
        error: { code: 'CANCELLED', message: 'Cancelled.' },
      };
      this.cancelledIds.delete(id);
      this.pruneCompletedHistory();
      this.notify();
      return;
    }
    if (cur.state === 'active' || cur.state === 'stalled') {
      this.updateItem(id, { state: 'cancelling' });
    }
  }

  /**
   * Drop every terminal-state entry from the queue, EXCEPT the active one
   * (which by definition isn't terminal but the guard is defensive). Keeps
   * the panel's history list tidy on user demand.
   */
  clearCompleted(): void {
    this.items = this.items.filter(
      (i) => i.id === this.activeId || !TERMINAL.has(i.state),
    );
    this.notify();
  }

  /**
   * Subscribe to snapshot updates. Pushes the current snapshot synchronously
   * on subscription so React state can hydrate without a separate getSnapshot
   * call. Returns an idempotent unsubscribe function.
   */
  subscribe(cb: (s: QueueState) => void): () => void {
    this.listeners.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.listeners.delete(cb);
    };
  }

  /**
   * Return a fresh snapshot. Items are a SHALLOW copy so React reference-
   * equality picks up changes; consumers must not mutate the array.
   */
  getSnapshot(): QueueState {
    return { items: this.items.slice(), activeId: this.activeId };
  }

  // ---------- TransferQueueAPI surface (passed to runners) ----------

  /**
   * Merge `partial` into the item identified by `id` and notify listeners.
   * No-op if `id` is unknown (e.g. the entry was pruned from history mid-
   * runner; runner should be defensive).
   */
  updateItem(id: string, partial: Partial<TransferItem>): void {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    this.items[idx] = { ...this.items[idx], ...partial };
    this.notify();
  }

  /** True if the user has signalled cancellation for this active item. */
  isCancelled(id: string): boolean {
    return this.cancelledIds.has(id);
  }

  // ---------- Runner loop ----------

  /**
   * Promotes the next 'queued' item to 'active' and invokes the matching
   * runner. Re-entrant: returns immediately if a transfer is already in
   * flight; recurses in the finally block to drain the queue.
   *
   * Sequential await is load-bearing for TRANSFER-01: the next promotion
   * cannot run until the current runner's promise resolves AND the item
   * has been moved to a terminal state by the finally block.
   */
  private async tick(): Promise<void> {
    if (this.activeId !== null) return;
    const next = this.items.find((i) => i.state === 'queued');
    if (!next) return;
    this.activeId = next.id;
    this.updateItem(next.id, {
      state: 'active',
      startedAt: Date.now(),
    });

    try {
      if (next.direction === 'upload') {
        await this.runUpload(next, this);
      } else {
        await this.runDownload(next, this);
      }
      // If the runner returned without setting a terminal state itself,
      // mark the transfer as completed and back-fill bytesSoFar = size.
      const after = this.items.find((i) => i.id === next.id);
      if (after && !TERMINAL.has(after.state)) {
        this.updateItem(next.id, {
          state: 'completed',
          completedAt: Date.now(),
          bytesSoFar: after.size,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const wasCancelled = this.cancelledIds.has(next.id);
      this.updateItem(next.id, {
        state: wasCancelled ? 'cancelled' : 'failed',
        error: {
          code: wasCancelled ? 'CANCELLED' : 'CLIENT_ERROR',
          message: wasCancelled ? 'Cancelled.' : msg,
        },
        completedAt: Date.now(),
      });
    } finally {
      this.activeId = null;
      this.cancelledIds.delete(next.id);
      this.pruneCompletedHistory();
      this.notify();
      // Drain: try to promote the next queued item.
      void this.tick();
    }
  }

  /**
   * Trim the completed-history tail. Retains the HISTORY_LIMIT most recently
   * completed entries (by completedAt desc, falling back to enqueue order
   * if completedAt is missing). Active and queued items are never pruned.
   *
   * Runs after every transition into a terminal state (called from tick()'s
   * finally and from cancelById's queued-shortcut path).
   */
  pruneCompletedHistory(): void {
    const terminal = this.items.filter((i) => TERMINAL.has(i.state));
    if (terminal.length <= HISTORY_LIMIT) return;
    // Sort newest-first; everything past HISTORY_LIMIT is dropped.
    const sorted = terminal
      .slice()
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
    const dropIds = new Set(sorted.slice(HISTORY_LIMIT).map((i) => i.id));
    this.items = this.items.filter((i) => !dropIds.has(i.id));
  }

  // ---------- Listener fan-out ----------

  private notify(): void {
    const snap = this.getSnapshot();
    for (const cb of this.listeners) {
      try {
        cb(snap);
      } catch (err: unknown) {
        // A throwing listener must NOT prevent siblings from firing.
        // Mirrors the FilesChannelClient.onEvent dispatch loop pattern from
        // plan 11-01.
        console.error('[transfer-queue] listener threw', err);
      }
    }
  }
}
