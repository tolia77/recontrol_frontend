import type {
  ClipboardSetEnvelope,
  ClipboardCapabilitiesEnvelope,
  ClipboardRefusedEnvelope,
} from './clipboardProtocol.generated';

type SetHandler = (env: ClipboardSetEnvelope) => void;
type CapabilitiesHandler = (env: ClipboardCapabilitiesEnvelope) => void;
type RefusedHandler = (env: ClipboardRefusedEnvelope) => void;

/**
 * Thin wrapper over the 'clipboard' RTCDataChannel.
 * Subscribes to onmessage; routes JSON-parsed envelopes to handlers via a
 * three-way kind discriminator (set / capabilities / refused). Each kind has
 * its own handler set so consumers (Plan 04 useClipboardSync) can subscribe
 * independently to each envelope kind.
 *
 * Browser sends only 'set' or 'capabilities' envelopes -- the 'refused'
 * envelope is desktop-only on the wire (Phase 15 D-04). Browser-local
 * refusals are surfaced via clipboardCore's `refused-local` decision, not
 * over the data channel.
 *
 * Channel teardown: NEVER call dc.close() -- pc.close() is the only mechanism (SIPSorcery #882).
 */
export class ClipboardChannelClient {
  private readonly dc: RTCDataChannel;
  private readonly setHandlers = new Set<SetHandler>();
  private readonly capabilitiesHandlers = new Set<CapabilitiesHandler>();
  private readonly refusedHandlers = new Set<RefusedHandler>();
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
    const e = env as { kind?: string } | null;
    if (!e || typeof e !== 'object') return;
    switch (e.kind) {
      case 'set': {
        const s = e as Partial<ClipboardSetEnvelope>;
        if (typeof s.originId !== 'string' || typeof s.contentHash !== 'string') return;
        for (const h of this.setHandlers) {
          try {
            h(s as ClipboardSetEnvelope);
          } catch (err) {
            console.warn('[clipboard] set handler threw:', err);
          }
        }
        return;
      }
      case 'capabilities': {
        const c = e as Partial<ClipboardCapabilitiesEnvelope>;
        if (
          typeof c.originId !== 'string' ||
          typeof c.outboundEnabled !== 'boolean' ||
          typeof c.inboundEnabled !== 'boolean' ||
          typeof c.maxBytes !== 'number'
        )
          return;
        for (const h of this.capabilitiesHandlers) {
          try {
            h(c as ClipboardCapabilitiesEnvelope);
          } catch (err) {
            console.warn('[clipboard] caps handler threw:', err);
          }
        }
        return;
      }
      case 'refused': {
        const r = e as Partial<ClipboardRefusedEnvelope>;
        if (typeof r.originId !== 'string' || typeof r.reason !== 'string') return;
        for (const h of this.refusedHandlers) {
          try {
            h(r as ClipboardRefusedEnvelope);
          } catch (err) {
            console.warn('[clipboard] refused handler threw:', err);
          }
        }
        return;
      }
      default:
        return;
    }
  };

  subscribe(handler: SetHandler): () => void {
    this.setHandlers.add(handler);
    return () => {
      this.setHandlers.delete(handler);
    };
  }

  subscribeCapabilities(handler: CapabilitiesHandler): () => void {
    this.capabilitiesHandlers.add(handler);
    return () => {
      this.capabilitiesHandlers.delete(handler);
    };
  }

  subscribeRefused(handler: RefusedHandler): () => void {
    this.refusedHandlers.add(handler);
    return () => {
      this.refusedHandlers.delete(handler);
    };
  }

  send(envelope: ClipboardSetEnvelope | ClipboardCapabilitiesEnvelope): void {
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
    this.setHandlers.clear();
    this.capabilitiesHandlers.clear();
    this.refusedHandlers.clear();
  }
}
