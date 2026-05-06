import { ClipboardLoopGate } from './clipboardLoopGate';

export type * from './clipboardProtocol.generated';
export { ClipboardLoopGate, RING_CAPACITY, TTL_MS } from './clipboardLoopGate';
export { normalizeClipboard, NON_TEXT_THRESHOLD } from './clipboardNormalization';
export { hashHex16 } from './clipboardHash';

export interface ClipboardChannelHandle {
  dispose: () => void;
}

export function createClipboardChannelHandle(
  dc: RTCDataChannel,
  loopGate: ClipboardLoopGate,
  log: Pick<Console, 'log' | 'warn'> = console,
): ClipboardChannelHandle {
  const onMessage = (ev: MessageEvent): void => {
    if (typeof ev.data !== 'string') {
      log.warn('[clipboard] non-text frame dropped');
      return;
    }
    // Phase 13 wire proof hook: strict parsing happens on desktop side; frontend
    // side keeps this listener lightweight and policy-only for now.
    log.log('[clipboard] message received');
  };

  const onClose = (): void => {
    loopGate.reset();
    log.log('[clipboard] channel closed');
  };

  dc.addEventListener('message', onMessage);
  dc.addEventListener('close', onClose);

  return {
    dispose: () => {
      dc.removeEventListener('message', onMessage);
      dc.removeEventListener('close', onClose);
    },
  };
}
