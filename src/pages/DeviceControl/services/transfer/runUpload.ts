import type { RefObject } from "react";
import { ChunkHeader } from "src/pages/DeviceControl/services/files/ChunkHeader";
import { FilesChannelError } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import type { FilesChannelRequest } from "src/pages/DeviceControl/hooks/realtime/useFilesChannel";
import type { RunUploadFn } from "./types";

/**
 * Browser-side upload runner.
 *
 * Pipeline:
 *  1. files.upload.begin handshake -> desktop allocates a u32 transferId and
 *     creates the .partial file. Response also carries `partialPath` (currently
 *     unused on the browser side; kept on the typed interface for future
 *     resume-on-reconnect work).
 *  2. Chunk loop: file.slice(start, end).arrayBuffer() at 16 KiB CHUNK_PAYLOAD,
 *     prefix each chunk with the 16-byte ChunkHeader, dc.send(ArrayBuffer).
 *  3. W3C-standard backpressure via bufferedAmountLowThreshold +
 *     bufferedamountlow event (HIGH=4MiB, LOW=1MiB). NOT polling.
 *  4. Drain loop after the last chunk: poll bufferedAmount until 0 BEFORE
 *     sending files.upload.complete (Pitfall 3 -- the desktop only sees
 *     bytes that have actually drained out of the SCTP buffer).
 *  5. files.upload.complete handshake -> desktop atomically renames .partial
 *     to the final filename.
 *
 * Cancellation: queue.isCancelled(item.id) is checked at every chunk-loop
 * iteration AND inside the drain loop. On cancel, fires files.transfer.cancel
 * with a 5s short timeout and advances regardless of ack outcome (the desktop
 * registry's CancelAll in CleanupPeerConnection covers the worst case).
 *
 * Channel-close safety (Pitfall 2): dc.readyState !== 'open' is checked
 * before every send and inside the chunk loop. dc.send raises silently on
 * closing channels so the readyState guard is the only reliable signal.
 */
const CHUNK_PAYLOAD = 16 * 1024;
const HIGH_WATER = 4 * 1024 * 1024;
const LOW_WATER = 1 * 1024 * 1024;
/** Maximum time the drain loop will wait for bufferedAmount to reach 0. */
const DRAIN_TIMEOUT_MS = 60_000;
/** Polling cadence inside the drain loop; W3C bufferedamountlow event is not
 *  used here because we need to wait until 0, not just LOW_WATER. */
const DRAIN_POLL_MS = 50;
/** Short cancel-handshake timeout: best-effort; advance regardless. */
const CANCEL_TIMEOUT_MS = 5_000;

interface BeginResp {
  transferId: number;
  partialPath: string;
}

interface CompleteResp {
  path: string;
}

export interface CreateRunUploadDeps {
  /**
   * Live ref to the binary data channel; resolves to null when disconnected.
   * Read at runner-invocation time so reconnect-then-upload picks up the new
   * channel without panel-side rewiring.
   */
  filesDataRef: RefObject<RTCDataChannel | null>;
  /**
   * Bound files-ctl request fn (UseFilesChannel.request). May be null while
   * the channel is closed; the runner short-circuits with CHANNEL_NOT_OPEN.
   */
  getRequest: () => FilesChannelRequest | null;
  /**
   * Returns the File previously stored at enqueue time for this item id, or
   * null if missing (e.g. the panel pruned the entry from history mid-flight,
   * which would be a bug -- runner is defensive).
   */
  getFile: (itemId: string) => File | null;
}

/**
 * Build a RunUploadFn closing over the data-channel + files-ctl + File map.
 * The factory shape (CreateRunUploadDeps) keeps the runner unit-testable in
 * isolation: a test passes a mock RefObject + a stub request fn + a Map-backed
 * getFile.
 */
export function createRunUpload(deps: CreateRunUploadDeps): RunUploadFn {
  return async (item, queue) => {
    const file = deps.getFile(item.id);
    if (!file) {
      queue.updateItem(item.id, {
        state: "failed",
        error: { code: "CLIENT_ERROR", message: "File reference lost." },
        completedAt: Date.now(),
      });
      return;
    }
    const dc = deps.filesDataRef.current;
    const request = deps.getRequest();
    if (!dc || !request || dc.readyState !== "open") {
      queue.updateItem(item.id, {
        state: "failed",
        error: {
          code: "CHANNEL_NOT_OPEN",
          message: "files-data channel not open.",
        },
        completedAt: Date.now(),
      });
      return;
    }

    // 1. Begin handshake
    let begin: BeginResp;
    try {
      begin = await request<
        {
          parentPath: string;
          name: string;
          size: number;
          mode: "fail" | "replace" | "skip" | "keepBoth";
        },
        BeginResp
      >("files.upload.begin", {
        parentPath: item.parentPath,
        name: item.name,
        size: item.size,
        mode: item.conflictMode ?? "fail",
      });
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

    // 2. Backpressure setup (W3C standard)
    dc.bufferedAmountLowThreshold = LOW_WATER;
    const waitForLow = (): Promise<void> =>
      new Promise((resolve) => {
        const onLow = () => {
          dc.removeEventListener("bufferedamountlow", onLow);
          resolve();
        };
        dc.addEventListener("bufferedamountlow", onLow);
      });

    let seq = 0;
    let offset = 0;
    let cancelled = false;

    // Best-effort cancel: short timeout, advance regardless of ack outcome.
    const sendCancel = async (
      reason: "user" | "desktop_error" | "disconnect" | "stalled",
    ): Promise<void> => {
      try {
        await request<
          { transferId: number; reason: string },
          Record<string, never>
        >(
          "files.transfer.cancel",
          { transferId: begin.transferId, reason },
          CANCEL_TIMEOUT_MS,
        );
      } catch {
        /* desktop sweeper / CancelAll will reap; advance the queue. */
      }
    };

    // 3. Chunk loop
    try {
      for (let start = 0; start < file.size; start += CHUNK_PAYLOAD) {
        if (queue.isCancelled(item.id)) {
          cancelled = true;
          break;
        }
        // Pitfall 2 (dc.send on closing channel).
        if (dc.readyState !== "open") {
          throw new FilesChannelError({
            code: "CHANNEL_NOT_OPEN",
            message: "files-data closed mid-upload.",
          });
        }

        const end = Math.min(start + CHUNK_PAYLOAD, file.size);
        const slice = file.slice(start, end);
        const payload = await slice.arrayBuffer();
        const frame = new ArrayBuffer(ChunkHeader.SIZE + payload.byteLength);
        new ChunkHeader(begin.transferId, seq, offset).writeTo(frame, 0);
        new Uint8Array(frame, ChunkHeader.SIZE).set(new Uint8Array(payload));

        // Backpressure pump: wait for bufferedamountlow if we're over HIGH_WATER.
        if (dc.bufferedAmount > HIGH_WATER) {
          await waitForLow();
          if (queue.isCancelled(item.id)) {
            cancelled = true;
            break;
          }
          if (dc.readyState !== "open") {
            throw new FilesChannelError({
              code: "CHANNEL_NOT_OPEN",
              message: "files-data closed mid-upload.",
            });
          }
        }

        try {
          dc.send(frame);
        } catch (err: unknown) {
          throw new FilesChannelError({
            code: "CHANNEL_NOT_OPEN",
            message: `dc.send failed: ${err instanceof Error ? err.message : String(err)}`,
          });
        }

        seq += 1;
        offset += payload.byteLength;
        queue.updateItem(item.id, { bytesSoFar: offset });
      }

      if (cancelled) {
        await sendCancel("user");
        queue.updateItem(item.id, {
          state: "cancelled",
          completedAt: Date.now(),
          error: { code: "CANCELLED", message: "Cancelled." },
        });
        return;
      }

      // 4. Drain bufferedAmount before complete (Pitfall 3)
      const drainStart = Date.now();
      while (dc.bufferedAmount > 0) {
        if (queue.isCancelled(item.id)) {
          await sendCancel("user");
          queue.updateItem(item.id, {
            state: "cancelled",
            completedAt: Date.now(),
            error: { code: "CANCELLED", message: "Cancelled." },
          });
          return;
        }
        if (dc.readyState !== "open") {
          throw new FilesChannelError({
            code: "CHANNEL_NOT_OPEN",
            message: "files-data closed during drain.",
          });
        }
        if (Date.now() - drainStart > DRAIN_TIMEOUT_MS) {
          throw new FilesChannelError({
            code: "TIMEOUT",
            message: "bufferedAmount drain exceeded 60s.",
          });
        }
        await new Promise((r) => setTimeout(r, DRAIN_POLL_MS));
      }

      // 5. Complete handshake
      // Size-proportional timeout (rough heuristic: 1 ms per KiB) with a
      // 15s floor so small files still get a reasonable window for the
      // desktop to atomically rename the .partial -> final.
      const completeTimeoutMs = Math.max(15_000, Math.ceil(file.size / 1024));
      const resp = await request<
        { transferId: number; expectedBytes: number },
        CompleteResp
      >(
        "files.upload.complete",
        { transferId: begin.transferId, expectedBytes: file.size },
        completeTimeoutMs,
      );
      void resp; // resp.path is the final filename; not currently surfaced in queue UI.
      queue.updateItem(item.id, {
        state: "completed",
        completedAt: Date.now(),
        bytesSoFar: file.size,
      });
    } catch (err: unknown) {
      const info =
        err instanceof FilesChannelError
          ? err.info
          : {
              code: "CLIENT_ERROR" as const,
              message: err instanceof Error ? err.message : String(err),
            };
      // Best-effort cancel so the desktop's .partial is reaped immediately
      // rather than via the 5-min sweeper threshold.
      await sendCancel("desktop_error");
      const wasCancelled = queue.isCancelled(item.id);
      queue.updateItem(item.id, {
        state: wasCancelled ? "cancelled" : "failed",
        error: {
          code: wasCancelled ? "CANCELLED" : info.code,
          message: wasCancelled ? "Cancelled." : info.message,
        },
        completedAt: Date.now(),
      });
    }
  };
}
