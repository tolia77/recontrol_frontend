import { useCallback, useRef, useState } from "react";
import { frontendLogger } from "src/utils/logger";
import { FilesChannelClient } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import { FilesDataChannel } from "src/pages/DeviceControl/services/files/FilesDataChannel";
import { ClipboardLoopGate } from "src/pages/DeviceControl/services/clipboard/clipboardLoopGate";
import {
  createClipboardChannelHandle,
  type ClipboardChannelHandle,
} from "src/pages/DeviceControl/services/clipboard/clipboardChannelHandle";
import type React from "react";

/**
 * Owns the files + clipboard data-channel refs, state, and setup/cleanup
 * callbacks. Internal to useWebRtc. Provides setupDataChannels(pc) and
 * cleanupDataChannels() for usePeerConnection to call during
 * createPeerConnection / cleanupPeerConnection respectively.
 *
 * Cleanup ordering: cleanupDataChannels() disposes all file/clipboard
 * wrappers BEFORE the caller (usePeerConnection) calls pc.close(). This is
 * intentional — dc.close() from this side does not propagate to the
 * SIPSorcery peer, so pc.close() drives teardown.
 */

export interface UseDataChannelsReturn {
  // Files data-channel refs
  filesCtlRef: React.RefObject<RTCDataChannel | null>;
  filesDataRef: React.RefObject<RTCDataChannel | null>;
  filesClientRef: React.RefObject<FilesChannelClient | null>;
  filesDataChannelRef: React.RefObject<FilesDataChannel | null>;
  filesCtlOpen: boolean;
  // Clipboard data-channel refs and state
  clipboardRef: React.RefObject<RTCDataChannel | null>;
  clipboardHandleRef: React.RefObject<ClipboardChannelHandle | null>;
  clipboardLoopGateRef: React.MutableRefObject<ClipboardLoopGate>;
  clipboardOriginIdRef: React.RefObject<string | null>;
  lastRemoteApplyTimeRef: React.MutableRefObject<number>;
  clipboardCtlOpen: boolean;
  // Callbacks for usePeerConnection
  setupDataChannels: (pc: RTCPeerConnection) => void;
  cleanupDataChannels: () => void;
}

export function useDataChannels(): UseDataChannelsReturn {
  // files-ctl / files-data channels (created on this peer as offerer, BEFORE createOffer,
  // so they appear in the initial SDP offer's single SCTP m-section -- zero renegotiation).
  const filesCtlRef = useRef<RTCDataChannel | null>(null);
  const filesDataRef = useRef<RTCDataChannel | null>(null);
  const filesClientRef = useRef<FilesChannelClient | null>(null);
  const filesDataChannelRef = useRef<FilesDataChannel | null>(null);
  const clipboardRef = useRef<RTCDataChannel | null>(null);
  const clipboardHandleRef = useRef<ClipboardChannelHandle | null>(null);
  const clipboardLoopGateRef = useRef<ClipboardLoopGate>(
    new ClipboardLoopGate(),
  );
  const clipboardOriginIdRef = useRef<string | null>(null);
  const lastRemoteApplyTimeRef = useRef<number>(0);

  // Mirrors the files-ctl RTCDataChannel readyState as React state so consumers
  // (useFilesChannel) can react to it without polling. The 'open' event for
  // file-ctl can fire ~100ms AFTER pc.connectionState transitions to
  // 'connected', so a one-shot setTimeout(0) check would race and miss it.
  const [filesCtlOpen, setFilesCtlOpen] = useState(false);
  // Mirror clipboard data-channel 'open' state so useClipboardSync can re-run
  // its inbound subscription effect when the channel opens (which fires AFTER
  // pc.connectionState='connected').
  const [clipboardCtlOpen, setClipboardCtlOpen] = useState(false);

  // Called by usePeerConnection inside cleanupPeerConnection BEFORE pc.close().
  // Dispose file-channel wrappers BEFORE closing the RTCPeerConnection.
  // dc.close() from this side does not propagate to the SIPSorcery peer -- so
  // we rely on pc.close() below to drive the teardown. Here we only detach
  // listeners and reject pending requests.
  const cleanupDataChannels = useCallback(() => {
    frontendLogger.log('info', 'webrtc', 'data_channels_cleanup', {});
    filesClientRef.current?.dispose();
    filesClientRef.current = null;
    filesDataChannelRef.current?.dispose();
    filesDataChannelRef.current = null;
    clipboardHandleRef.current?.dispose();
    clipboardHandleRef.current = null;
    clipboardRef.current = null;
    clipboardOriginIdRef.current = null;
    lastRemoteApplyTimeRef.current = 0;
    clipboardLoopGateRef.current.reset();
    setClipboardCtlOpen(false);
    filesCtlRef.current = null;
    filesDataRef.current = null;
    setFilesCtlOpen(false);
    delete (window as unknown as { __filesCtl?: FilesChannelClient })
      .__filesCtl;
  }, []);

  // Called by usePeerConnection inside createPeerConnection.
  // Creates the two file-transfer data channels BEFORE createOffer so they
  // appear in the initial SDP offer's single SCTP m-section (frontend is the
  // offerer).
  //
  // The { ordered: true } init option is authoritative because the browser's
  // RTCDataChannelInit round-trips cleanly through DCEP. The desktop side
  // NEVER calls createDataChannel for files-ctl/files-data; it consumes them
  // via pc.ondatachannel. This design intentionally routes around SIPSorcery
  // issue #701. Do not add desktop-side createDataChannel calls for these
  // labels.
  const setupDataChannels = useCallback(
    (pc: RTCPeerConnection) => {
      try {
        const filesCtl = pc.createDataChannel("files-ctl", { ordered: true });
        filesCtlRef.current = filesCtl;
        filesCtl.addEventListener("open", () => {
          console.log("[files-ctl] open");
          frontendLogger.log('info', 'webrtc', 'data_channel_open', { label: filesCtl.label });
          filesClientRef.current = new FilesChannelClient(filesCtl);
          // Expose on window so a browser-console demo can call
          // window.__filesCtl.request('files.list', { path: '...' }).
          (
            window as unknown as { __filesCtl?: FilesChannelClient }
          ).__filesCtl = filesClientRef.current;
          setFilesCtlOpen(true);
        });
        filesCtl.addEventListener("close", () => {
          console.log("[files-ctl] closed");
          filesClientRef.current?.dispose();
          filesClientRef.current = null;
          setFilesCtlOpen(false);
          delete (window as unknown as { __filesCtl?: FilesChannelClient })
            .__filesCtl;
        });

        const filesData = pc.createDataChannel("files-data", {
          ordered: true,
        });
        filesData.binaryType = "arraybuffer";
        filesDataRef.current = filesData;
        filesData.addEventListener("open", () => {
          console.log("[files-data] open");
          frontendLogger.log('info', 'webrtc', 'data_channel_open', { label: filesData.label });
          filesDataChannelRef.current = new FilesDataChannel(filesData);
        });
        filesData.addEventListener("close", () => {
          console.log("[files-data] closed");
          filesDataChannelRef.current?.dispose();
          filesDataChannelRef.current = null;
        });

        const clipboard = pc.createDataChannel("clipboard", { ordered: true });
        clipboardRef.current = clipboard;
        clipboard.addEventListener("open", () => {
          frontendLogger.log('info', 'webrtc', 'data_channel_open', { label: clipboard.label });
          const originId = crypto.randomUUID();
          clipboardOriginIdRef.current = originId;
          clipboardLoopGateRef.current.reset();
          lastRemoteApplyTimeRef.current = 0;
          console.log(`clipboard channel open — originId=${originId}`);
          clipboardHandleRef.current?.dispose();
          clipboardHandleRef.current = createClipboardChannelHandle(
            clipboard,
            clipboardLoopGateRef.current,
            console,
          );
          // Signal channel-open as React state so useClipboardSync can
          // (re-)wire its inbound subscription. Fires after pc.connectionState='connected'.
          setClipboardCtlOpen(true);
        });
        clipboard.addEventListener("close", () => {
          clipboardHandleRef.current?.dispose();
          clipboardHandleRef.current = null;
          clipboardRef.current = null;
          // Clear originId on close so a stale value cannot pass the
          // self-origin-drop check on a subsequent reconnect/race.
          clipboardOriginIdRef.current = null;
          clipboardLoopGateRef.current.reset();
          setClipboardCtlOpen(false);
          console.log("[clipboard] closed");
        });
      } catch (err) {
        // Defensive: should never happen in a fresh RTCPeerConnection, but if it
        // does, log and continue so the primary video flow is not blocked.
        console.error(
          "[files-ctl/data] createDataChannel failed, video will still work:",
          err,
        );
      }
    },
    [],
  );

  return {
    filesCtlRef,
    filesDataRef,
    filesClientRef,
    filesDataChannelRef,
    filesCtlOpen,
    clipboardRef,
    clipboardHandleRef,
    clipboardLoopGateRef,
    clipboardOriginIdRef,
    lastRemoteApplyTimeRef,
    clipboardCtlOpen,
    setupDataChannels,
    cleanupDataChannels,
  };
}
