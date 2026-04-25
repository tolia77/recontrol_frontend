import { useCallback, useEffect, useState } from 'react';
import type { FilesChannelClient, FilesDataChannel } from '../services/files';
import { FilesChannelError } from '../services/files';
import type { UseWebRtcReturn } from './useWebRtc';

export type FilesChannelStatus = 'closed' | 'opening' | 'open' | 'failed';

/**
 * Typed request function. Mirrors FilesChannelClient.request so callers can
 * parametrize the payload + result types at every call site.
 */
export type FilesChannelRequest = <TPayload, TResult>(
  command: string,
  payload: TPayload,
  timeoutMs?: number,
) => Promise<TResult>;

export interface UseFilesChannel {
  status: FilesChannelStatus;
  request: FilesChannelRequest | null;
  /**
   * Live ref to the binary data channel. Plan 11-04+ runners read this at
   * invocation time so reconnects pick up the new channel without panel-side
   * rewiring. May be null while the channel is closed; callers must guard.
   */
  filesDataRef: UseWebRtcReturn['filesDataRef'];
  /**
   * Live FilesChannelClient (the files-ctl JSON wrapper). Exposed to Plan
   * 11-05's runDownload so it can subscribe to server-push events
   * (`files.download.complete`, `files.transfer.error`) for the active
   * transferId. Null while the channel is closed.
   */
  filesClient: FilesChannelClient | null;
  /**
   * Live FilesDataChannel WRAPPER (the binary chunk router; NOT the raw
   * RTCDataChannel which is on `filesDataRef`). Exposed to Plan 11-05's
   * runDownload so it can call registerDownload / unregisterDownload.
   * Null while the channel is closed.
   */
  filesDataChannel: FilesDataChannel | null;
}

/**
 * React hook that lifts the imperative `filesClientRef` (from useWebRtc) into
 * a typed value suitable for component consumption.
 *
 * Rules:
 * - When `connectionState !== 'connected'` -> status 'closed', request null.
 * - When connected, we schedule a microtask to recheck the ref (the files-ctl
 *   channel opens a tick after connectionState flips). Status becomes 'open'
 *   iff `filesClientRef.current` is populated at that point, 'failed'
 *   otherwise.
 *
 * `request` is memoized via useCallback so downstream useEffects with
 * `channel.request` in their dependency array don't re-fire on every render.
 */
export function useFilesChannel(
  filesClientRef: UseWebRtcReturn['filesClientRef'],
  connectionState: UseWebRtcReturn['connectionState'],
  filesDataRef: UseWebRtcReturn['filesDataRef'],
  filesDataChannelRef: UseWebRtcReturn['filesDataChannelRef'],
): UseFilesChannel {
  const [status, setStatus] = useState<FilesChannelStatus>('closed');

  useEffect(() => {
    if (connectionState !== 'connected') {
      setStatus('closed');
      return;
    }
    setStatus('opening');
    // files-ctl 'open' fires a tick after pc.connectionState; poll once.
    const id = setTimeout(() => {
      setStatus(filesClientRef.current ? 'open' : 'failed');
    }, 0);
    return () => clearTimeout(id);
  }, [connectionState, filesClientRef]);

  const request = useCallback<FilesChannelRequest>(
    <TPayload, TResult>(
      command: string,
      payload: TPayload,
      timeoutMs?: number,
    ): Promise<TResult> => {
      const client: FilesChannelClient | null = filesClientRef.current;
      if (!client) {
        return Promise.reject(
          new FilesChannelError({
            code: 'CHANNEL_NOT_OPEN',
            message: 'files-ctl channel is not open',
          }),
        );
      }
      return client.request<TPayload, TResult>(command, payload, timeoutMs);
    },
    [filesClientRef],
  );

  return {
    status,
    request: status === 'open' ? request : null,
    filesDataRef,
    filesClient: status === 'open' ? filesClientRef.current : null,
    filesDataChannel: status === 'open' ? filesDataChannelRef.current : null,
  };
}
