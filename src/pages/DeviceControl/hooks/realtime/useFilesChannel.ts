import { useCallback } from "react";
import type { FilesChannelClient } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import type { FilesDataChannel } from "src/pages/DeviceControl/services/files/FilesDataChannel";
import { FilesChannelError } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import type { UseWebRtcReturn } from "./useWebRtc";

export type FilesChannelStatus = "closed" | "opening" | "open" | "failed";

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
   * Live ref to the binary data channel. Runners read this at invocation time
   * so reconnects pick up the new channel without panel-side rewiring. May be
   * null while the channel is closed; callers must guard.
   */
  filesDataRef: UseWebRtcReturn["filesDataRef"];
  /**
   * Live FilesChannelClient (the files-ctl JSON wrapper). Exposed to
   * runDownload so it can subscribe to server-push events
   * (`files.download.complete`, `files.transfer.error`) for the active
   * transferId. Null while the channel is closed.
   */
  filesClient: FilesChannelClient | null;
  /**
   * Live FilesDataChannel WRAPPER (the binary chunk router; NOT the raw
   * RTCDataChannel which is on `filesDataRef`). Exposed to runDownload so it
   * can call registerDownload / unregisterDownload. Null while the channel is
   * closed.
   */
  filesDataChannel: FilesDataChannel | null;
}

/**
 * React hook that lifts the imperative `filesClientRef` (from useWebRtc) into
 * a typed value suitable for component consumption.
 *
 * Derived-status hook: computes files channel status from WebRTC signals.
 * Does NOT subscribe to a raw WebSocket.
 *
 * Takes positional args from UseWebRtcReturn (NOT an options-object), because
 * the UseWebRtcReturn surface is the stable contract and adding a wrapper
 * object would create churn with zero benefit.
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
  filesClientRef: UseWebRtcReturn["filesClientRef"],
  connectionState: UseWebRtcReturn["connectionState"],
  filesDataRef: UseWebRtcReturn["filesDataRef"],
  filesDataChannelRef: UseWebRtcReturn["filesDataChannelRef"],
  filesCtlOpen: UseWebRtcReturn["filesCtlOpen"],
): UseFilesChannel {
  // Derive status directly from the live signals: WebRTC connection state and
  // the files-ctl data channel's open state. The data channel's 'open' event
  // can fire ~100ms after pc.connectionState transitions to 'connected', so we
  // can't decide 'open' vs 'failed' from a one-shot timeout - we just stay in
  // 'opening' until filesCtlOpen flips true.
  const status: FilesChannelStatus =
    connectionState !== "connected"
      ? "closed"
      : filesCtlOpen
        ? "open"
        : "opening";

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
            code: "CHANNEL_NOT_OPEN",
            message: "files-ctl channel is not open",
          }),
        );
      }
      return client.request<TPayload, TResult>(command, payload, timeoutMs);
    },
    [filesClientRef],
  );

  return {
    status,
    request: status === "open" ? request : null,
    filesDataRef,
    filesClient: status === "open" ? filesClientRef.current : null,
    filesDataChannel: status === "open" ? filesDataChannelRef.current : null,
  };
}
