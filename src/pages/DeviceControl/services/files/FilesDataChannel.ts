import { ChunkHeader } from "./ChunkHeader";
import type { DownloadTransfer } from "src/pages/DeviceControl/services/transfer/DownloadTransfer";

/**
 * Frontend-side binary-channel handler for `files-data`.
 *
 * Phase 11 chunk router: maintains a `Map<transferId, DownloadTransfer>` and
 * dispatches each incoming binary chunk to the matching DownloadTransfer's
 * `onChunk` method. Chunks for unknown transfer ids (e.g. post-cancel race --
 * the desktop's send loop may not have observed the cancel yet) are silently
 * dropped. This is normal and load-bearing for the cancel-discard contract.
 *
 * Non-binary (string) messages are rejected with a warning; the channel is
 * binary-only by protocol.
 *
 * Backpressure on this side is handled by the desktop (Recommendation A from
 * 09-SPIKE-FINDINGS): the browser only receives chunks that already passed
 * the desktop's HIGH_WATER / LOW_WATER throttle, so no browser-side
 * bufferedAmount handling is needed for the receive path. The send path
 * (uploads) uses W3C bufferedAmountLowThreshold + bufferedamountlow event in
 * createRunUpload.
 */
export class FilesDataChannel {
  private readonly dc: RTCDataChannel;
  private readonly downloads = new Map<number, DownloadTransfer>();

  constructor(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = "arraybuffer";
    dc.addEventListener("message", this.onMessage);
  }

  /**
   * Register a DownloadTransfer to receive chunks for `transferId`. Called by
   * runDownload AFTER the begin handshake resolves, so registration always
   * precedes the first chunk in practice (the desktop kicks its send loop
   * AFTER serializing the begin response, and SCTP delivers files-ctl + files-
   * data on separate streams in send-then-receive order on the same
   * association).
   */
  registerDownload(transferId: number, transfer: DownloadTransfer): void {
    this.downloads.set(transferId, transfer);
  }

  /**
   * Unregister a DownloadTransfer. Safe to call after cancel/finalize; further
   * chunks for this id will be silently dropped (Plan 11-02 cancel-race
   * coverage). Idempotent.
   */
  unregisterDownload(transferId: number): void {
    this.downloads.delete(transferId);
  }

  private onMessage = (ev: MessageEvent): void => {
    if (!(ev.data instanceof ArrayBuffer)) {
      console.warn("[files-data] unexpected non-binary message");
      return;
    }
    if (ev.data.byteLength < ChunkHeader.SIZE) {
      console.warn(`[files-data] chunk too short: ${ev.data.byteLength} bytes`);
      return;
    }
    const header = ChunkHeader.read(ev.data);
    const transfer = this.downloads.get(header.transferId);
    if (!transfer) {
      // Post-cancel race or unknown transfer; silently drop.
      return;
    }
    const payload = ev.data.slice(ChunkHeader.SIZE);
    transfer.onChunk(header, payload);
  };

  /**
   * Detach the message listener and clear the router map. Does not close the
   * underlying data channel -- per 09-SPIKE-FINDINGS Spike C, frontend-
   * initiated dc.close() is not observed by the SIPSorcery desktop peer, so
   * channel lifecycle is driven by pc.close() on the RTCPeerConnection.
   */
  dispose(): void {
    this.dc.removeEventListener("message", this.onMessage);
    this.downloads.clear();
  }
}
