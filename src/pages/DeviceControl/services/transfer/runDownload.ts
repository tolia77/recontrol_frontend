import { DownloadTransfer } from "./DownloadTransfer";
import { FilesChannelError } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import type { FilesChannelClient } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import type { FilesDataChannel } from "src/pages/DeviceControl/services/files/FilesDataChannel";
import type { FilesChannelRequest } from "src/pages/DeviceControl/hooks/realtime/useFilesChannel";
import type { FilesErrorCode } from "src/pages/DeviceControl/services/files/filesProtocol.generated";
import type { RunDownloadFn } from "./types";
import {
  detectSeparator,
  joinPath,
} from "src/pages/DeviceControl/components/FileManager/utils/pathUtils";

/**
 * Browser-side download runner.
 *
 * Pipeline:
 *  1. files.download.begin handshake -> desktop allocates a u32 transferId,
 *     opens the file for read, and kicks off a Task.Run that pushes binary
 *     chunks down files-data. Response carries `{ transferId, size, name }`.
 *  2. Construct a DownloadTransfer and register it with the FilesDataChannel
 *     chunk router BEFORE awaiting any complete event. The desktop's send
 *     loop runs AFTER serializing the begin response (Plan 11-02), and the
 *     begin promise resolves AFTER that serialization, so registration always
 *     precedes the first chunk's onmessage in practice.
 *  3. Race three promises: files.download.complete event, files.transfer.error
 *     event, OR the queue's cancel flag (polled every 100ms; the queue runs
 *     one transfer at a time so the poll cost is negligible).
 *  4. On complete: re-check cancel-discard one more time (the cancel poll may
 *     have fired between the last chunk and the complete event). If the user
 *     cancelled in that window, suppress the anchor-tag click and send
 *     files.transfer.cancel. Otherwise call finalize() synchronously inside
 *     the same event-loop turn as the complete event landed (Pitfall 8 --
 *     Safari treats deferred click() as user-action-less and blocks).
 *  5. On error: discard chunks via DownloadTransfer.cancel() (no anchor-tag
 *     click possible), surface the wire error to the queue.
 *  6. On cancel: discard chunks AND fire files.transfer.cancel with reason
 *     'user' and a 5s short timeout. The desktop registry's CancelAll in
 *     CleanupPeerConnection covers the worst case if cancel ack times out.
 */

interface BeginResp {
  transferId: number;
  size: number;
  name: string;
}

interface CompletePayload {
  transferId: number;
  totalBytes: number;
}

interface ErrorPayload {
  transferId: number;
  error: { code: FilesErrorCode; message: string; data?: unknown };
}

/** Cancel-handshake short timeout: best-effort, advance regardless of ack. */
const CANCEL_TIMEOUT_MS = 5_000;

/** Cancel-poll cadence; queue runs one transfer at a time so this is cheap. */
const CANCEL_POLL_MS = 100;

export interface CreateRunDownloadDeps {
  /** Bound files-ctl request fn (UseFilesChannel.request). */
  getRequest: () => FilesChannelRequest | null;
  /** Live FilesChannelClient -- needed for onEvent subscriptions. */
  getFilesClient: () => FilesChannelClient | null;
  /** Live FilesDataChannel WRAPPER (not the raw RTCDataChannel) so we can
   *  call registerDownload / unregisterDownload on the chunk router. */
  getFilesDataChannel: () => FilesDataChannel | null;
  /** UI hook: fires the success toast `Downloaded {name}` when the file
   *  lands in the user's Downloads folder. */
  onSuccess: (name: string) => void;
  /**
   * Plan 11-06: invoked with the active <see cref="DownloadTransfer"/>
   * instance for the duration of an in-flight download (right after start();
   * registerDownload), and again with `null` when the transfer reaches a
   * terminal state. The panel uses this to read `lastChunkAtMs` from a 1 s
   * setInterval and flip the row state to 'stalled' / 'active' accordingly.
   */
  onActiveChange?: (active: DownloadTransfer | null) => void;
}

/**
 * Build a RunDownloadFn closing over the channel deps. The factory shape
 * mirrors createRunUpload from Plan 11-04 so both runners stay symmetric.
 */
export function createRunDownload(deps: CreateRunDownloadDeps): RunDownloadFn {
  return async (item, queue) => {
    const request = deps.getRequest();
    const filesClient = deps.getFilesClient();
    const filesData = deps.getFilesDataChannel();
    if (!request || !filesClient || !filesData) {
      queue.updateItem(item.id, {
        state: "failed",
        error: {
          code: "CHANNEL_NOT_OPEN",
          message: "files channels not open.",
        },
        completedAt: Date.now(),
      });
      return;
    }

    // 1. Begin handshake
    const sep = detectSeparator(item.parentPath);
    const sourcePath = joinPath([item.parentPath, item.name], sep);
    let begin: BeginResp;
    try {
      begin = await request<{ path: string }, BeginResp>(
        "files.download.begin",
        { path: sourcePath },
      );
    } catch (err: unknown) {
      const info =
        err instanceof FilesChannelError
          ? err.info
          : {
              code: "CLIENT_ERROR" as const,
              message: err instanceof Error ? err.message : String(err),
            };
      queue.updateItem(item.id, {
        state: "failed",
        error: { code: info.code, message: info.message },
        completedAt: Date.now(),
      });
      return;
    }
    queue.updateItem(item.id, { transferId: begin.transferId });

    // 2. Construct DownloadTransfer + register router
    const transfer = new DownloadTransfer(
      begin.transferId,
      begin.name,
      begin.size,
      (bytesSoFar) => queue.updateItem(item.id, { bytesSoFar }),
    );
    transfer.start();
    filesData.registerDownload(begin.transferId, transfer);
    // Plan 11-06: surface the active transfer to the panel so the stall
    // interval can read transfer.lastChunkAtMs. Cleared at every terminal
    // exit below (after the router is unregistered) so a stale reference
    // never lingers across runs.
    deps.onActiveChange?.(transfer);

    // 3. Race: complete | error | cancel
    type Winner =
      | { kind: "complete" }
      | { kind: "error"; payload: ErrorPayload }
      | { kind: "cancel" };

    const completePromise = new Promise<Winner>((resolve) => {
      const off = filesClient.onEvent("files.download.complete", (payload) => {
        const p = payload as CompletePayload;
        if (p && p.transferId === begin.transferId) {
          off();
          resolve({ kind: "complete" });
        }
      });
    });
    // Plan 11-06: STALLED is non-fatal. The desktop pushes
    // files.transfer.error with code:'STALLED' for receivers idle > 10s, but
    // the transfer is still alive (bytes may resume). We surface it as a row
    // state ('stalled') WITHOUT resolving the error promise, so the runner
    // keeps awaiting the real terminal event (complete | non-STALLED error |
    // cancel). The state flip back to 'active' is handled by the panel's
    // download stall interval (FileManagerPanel) when DownloadTransfer's
    // lastChunkAtMs starts updating again.
    const errorPromise = new Promise<Winner>((resolve) => {
      const off = filesClient.onEvent("files.transfer.error", (payload) => {
        const p = payload as ErrorPayload;
        if (!p || p.transferId !== begin.transferId) return;
        if (p.error.code === "STALLED") {
          // Non-fatal: surface as row state; do NOT off() / resolve. Another
          // STALLED can fire later (separate stall episode) and we want to
          // keep listening through the lifetime of the transfer.
          queue.updateItem(item.id, { state: "stalled" });
          return;
        }
        off();
        resolve({ kind: "error", payload: p });
      });
    });
    const cancelPromise = (async (): Promise<Winner> => {
      // Poll the cancel flag with low frequency.
      while (!queue.isCancelled(item.id)) {
        await new Promise((r) => setTimeout(r, CANCEL_POLL_MS));
        // Bail if the transfer state machine self-cancelled (offset mismatch).
        if (transfer.currentState === "cancelled") {
          return { kind: "cancel" };
        }
      }
      return { kind: "cancel" };
    })();

    const winner = await Promise.race([
      completePromise,
      errorPromise,
      cancelPromise,
    ]);

    // Always unregister from the chunk router so post-terminal chunks are
    // silently dropped (cancel-race coverage on the data channel).
    filesData.unregisterDownload(begin.transferId);
    // Plan 11-06: clear the panel's active-transfer reference at terminal
    // exit. Done BEFORE the per-winner branches return so every code path
    // below already sees a null active reference (the panel's stall
    // interval becomes a no-op for this transferId immediately).
    deps.onActiveChange?.(null);

    if (winner.kind === "complete") {
      // Cancel-discard contract one more time: cancel may have arrived between
      // the last chunk and the complete event. Promise.race resolved 'complete'
      // first only because the cancel poll runs at 100ms; the user could have
      // clicked Cancel inside that window. Re-check.
      if (queue.isCancelled(item.id)) {
        transfer.cancel();
        try {
          await request<
            { transferId: number; reason: string },
            Record<string, never>
          >(
            "files.transfer.cancel",
            { transferId: begin.transferId, reason: "user" },
            CANCEL_TIMEOUT_MS,
          );
        } catch {
          /* desktop sweeper / CancelAll will reap; advance the queue. */
        }
        queue.updateItem(item.id, {
          state: "cancelled",
          completedAt: Date.now(),
          error: { code: "CANCELLED", message: "Cancelled." },
        });
        return;
      }
      // Synchronous finalize: fire anchor-tag click in the same event-loop
      // turn the complete event landed (Pitfall 8 -- Safari user-gesture).
      transfer.finalize();
      queue.updateItem(item.id, {
        state: "completed",
        completedAt: Date.now(),
        bytesSoFar: begin.size,
      });
      deps.onSuccess(begin.name);
      return;
    }

    if (winner.kind === "cancel") {
      transfer.cancel();
      try {
        await request<
          { transferId: number; reason: string },
          Record<string, never>
        >(
          "files.transfer.cancel",
          { transferId: begin.transferId, reason: "user" },
          CANCEL_TIMEOUT_MS,
        );
      } catch {
        /* best-effort; advance regardless. */
      }
      queue.updateItem(item.id, {
        state: "cancelled",
        completedAt: Date.now(),
        error: { code: "CANCELLED", message: "Cancelled." },
      });
      return;
    }

    // winner.kind === 'error'
    transfer.cancel();
    queue.updateItem(item.id, {
      state: "failed",
      error: {
        code: winner.payload.error.code,
        message: winner.payload.error.message,
      },
      completedAt: Date.now(),
    });
  };
}
