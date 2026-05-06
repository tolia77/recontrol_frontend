import type { ClipboardSetEnvelope } from './clipboardProtocol.generated';

type Handler = (env: ClipboardSetEnvelope) => void;

/**
 * Thin wrapper over the 'clipboard' RTCDataChannel.
 * Subscribes to onmessage; routes JSON-parsed { kind: 'set' } envelopes to handlers.
 * Other kinds (refused / capabilities) are accepted in Phase 15; this Phase 14 client
 * only forwards 'set' envelopes -- non-'set' messages are silently dropped here so
 * they don't reach the apply-side and double-process.
 *
 * Channel teardown: NEVER call dc.close() -- pc.close() is the only mechanism (SIPSorcery #882).
 */
export class ClipboardChannelClient {
  private readonly dc: RTCDataChannel;
  private readonly handlers = new Set<Handler>();
  private disposed = false;

  constructor(dc: RTCDataChannel) {
    this.dc = dc;
    dc.addEventListener('message', this.onMessage);
  }

  private onMessage = (ev: MessageEvent): void => {
    if (this.disposed) return;
    if (typeof ev.data !== 'string') return;
    let env: unknown;
    try {
      env = JSON.parse(ev.data);
    } catch {
      return;
    }
    const e = env as Partial<ClipboardSetEnvelope> | null;
    if (!e || typeof e !== 'object' || e.kind !== 'set') return;
    if (typeof e.originId !== 'string' || typeof e.contentHash !== 'string') return;
    for (const h of this.handlers) {
      try {
        h(e as ClipboardSetEnvelope);
      } catch (err) {
        console.warn('[clipboard] handler threw:', err);
      }
    }
  };

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  send(envelope: ClipboardSetEnvelope): void {
    if (this.disposed) return;
    if (this.dc.readyState !== 'open') {
      // WR-11: log instead of silently dropping. The loop gate has already
      // recorded the hash via prepareOutbound, so a silent drop here would
      // leave the local peer believing the remote received the change.
      console.warn(`[clipboard] send dropped: channel readyState=${this.dc.readyState}`);
      return;
    }
    try {
      this.dc.send(JSON.stringify(envelope));
    } catch (err) {
      console.warn('[clipboard] send failed:', err);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.dc.removeEventListener('message', this.onMessage);
    this.handlers.clear();
  }
}
