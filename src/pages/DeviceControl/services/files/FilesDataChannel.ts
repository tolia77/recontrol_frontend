import { ChunkHeader } from './ChunkHeader';

/**
 * Frontend-side binary-channel handler for `files-data`. Phase-9 stub: parses
 * the 16-byte {@link ChunkHeader} prefix on every inbound message and logs
 * the triple + payload length, but otherwise drops the chunk. Phase 11 will
 * route chunks to an active transfer state machine.
 *
 * Non-binary (string) messages are rejected with a warning; the channel is
 * binary-only by protocol.
 *
 * TODO(Phase 11): implement backpressure on the SEND side using standard
 * W3C `bufferedAmount` + `bufferedamountlow` event. The desktop-side receive
 * path uses Recommendation A from 09-SPIKE-FINDINGS (HIGH_WATER=4 MiB,
 * LOW_WATER=1 MiB polling). See .planning/phases/09-backend-foundation/
 * 09-SPIKE-FINDINGS.md for the empirical basis.
 */
export class FilesDataChannel {
  private readonly dc: RTCDataChannel;

  constructor(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.addEventListener('message', this.onMessage);
  }

  private onMessage = (ev: MessageEvent): void => {
    if (!(ev.data instanceof ArrayBuffer)) {
      console.warn(
        '[files-data] unexpected non-binary message (Phase 9 is binary-only)',
      );
      return;
    }
    if (ev.data.byteLength < ChunkHeader.SIZE) {
      console.warn(`[files-data] chunk too short: ${ev.data.byteLength} bytes`);
      return;
    }
    const header = ChunkHeader.read(ev.data);
    // Phase 9 stub: just log. Phase 11 will dispatch to an active transfer.
    console.log(
      `[files-data] chunk transferId=${header.transferId} seq=${header.seq} offset=${header.offset} payloadBytes=${ev.data.byteLength - ChunkHeader.SIZE} (Phase 9 stub, dropped)`,
    );
  };

  /**
   * Detach the message listener. Does not close the underlying data channel --
   * per 09-SPIKE-FINDINGS Spike C, frontend-initiated dc.close() is not
   * observed by the SIPSorcery desktop peer, so channel lifecycle is driven
   * by pc.close() on the RTCPeerConnection.
   */
  dispose(): void {
    this.dc.removeEventListener('message', this.onMessage);
  }
}
