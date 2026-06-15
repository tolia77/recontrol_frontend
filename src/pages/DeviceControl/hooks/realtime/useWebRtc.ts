import { useRef } from "react";
import { FilesChannelClient } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import { FilesDataChannel } from "src/pages/DeviceControl/services/files/FilesDataChannel";
import { ClipboardLoopGate } from "src/pages/DeviceControl/services/clipboard/clipboardLoopGate";
import type React from "react";
// AUDIT-ONLY — frontendLogger imported for hook-level render counter. Remove in Plan 04 (D-04).
import { frontendLogger } from "src/utils/logger";
import { useDataChannels } from "./useDataChannels";
import { usePeerConnection } from "./usePeerConnection";
import { useWebRtcSignaling } from "./useWebRtcSignaling";

export type WebRtcConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "failed";

interface UseWebRtcOptions {
  sendMessage: (command: string, payload: Record<string, unknown>) => void;
}

export interface UseWebRtcReturn {
  // --- Peer connection lifecycle (usePeerConnection) ---
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setVideoNode: (node: HTMLVideoElement | null) => void;
  pcRef: React.RefObject<RTCPeerConnection | null>;
  startWebRtc: () => void;
  stopWebRtc: () => void;
  retryWebRtc: () => void;
  connectionState: WebRtcConnectionState;
  hasReceivedFrame: boolean;
  desktopStats: { framesSkipped: number; encoder?: string } | null;
  // --- Signaling (useWebRtcSignaling) ---
  handleSignalingMessage: (
    command: string,
    payload: Record<string, unknown>,
  ) => void;
  // --- Data channels — files + clipboard (useDataChannels) ---
  filesCtlRef: React.RefObject<RTCDataChannel | null>;
  filesDataRef: React.RefObject<RTCDataChannel | null>;
  filesClientRef: React.RefObject<FilesChannelClient | null>;
  /**
   * Live ref to the FilesDataChannel WRAPPER (not the raw RTCDataChannel).
   * Plan 11-05's runDownload reads this so it can call
   * registerDownload / unregisterDownload on the chunk router.
   */
  filesDataChannelRef: React.RefObject<FilesDataChannel | null>;
  filesCtlOpen: boolean;
  clipboardCtlRef: React.RefObject<RTCDataChannel | null>;
  clipboardOriginIdRef: React.RefObject<string | null>;
  clipboardLoopGate: ClipboardLoopGate;
  lastRemoteApplyTimeRef: React.MutableRefObject<number>;
  /**
   * Mirrors the clipboard RTCDataChannel readyState as React state so consumers
   * (useClipboardSync) can re-run effects when the channel actually opens. The
   * 'open' event fires AFTER pc.connectionState transitions to 'connected', so
   * a connectionState-only effect would miss the transition (CR-04).
   */
  clipboardCtlOpen: boolean;
}

/**
 * Composer hook: composes usePeerConnection, useWebRtcSignaling, and
 * useDataChannels internally and returns the unchanged flat UseWebRtcReturn
 * surface (D-08/D-09/D-10). All consumers (useFilesChannel, useClipboardSync,
 * useStreamStats, DeviceControl destructure) continue to work unchanged.
 *
 * Internal split per D-09:
 * - usePeerConnection: peer lifecycle, reconnect, video, stats
 * - useWebRtcSignaling: handleSignalingMessage
 * - useDataChannels: files + clipboard data-channel setup
 */
export function useWebRtc({ sendMessage }: UseWebRtcOptions): UseWebRtcReturn {
  // AUDIT-ONLY — hook-level render counter for Phase 42.2 hot-path audit. Remove in Plan 04 (D-04).
  const _auditRenderCount = useRef(0);
  _auditRenderCount.current++;
  frontendLogger.timing("profiler", "hook_render", { hook: "useWebRtc", count: _auditRenderCount.current });

  // Data channels owned by useDataChannels; provides setup/cleanup callbacks
  // for usePeerConnection to call during createPeerConnection / cleanupPeerConnection.
  const dataChannels = useDataChannels();

  // Peer connection lifecycle; calls setupDataChannels(pc) before createOffer
  // and cleanupDataChannels() before pc.close() (Spike C ordering).
  const peer = usePeerConnection({
    sendMessage,
    setupDataChannels: dataChannels.setupDataChannels,
    cleanupDataChannels: dataChannels.cleanupDataChannels,
  });

  // Signaling handler; shares the same pcRef as usePeerConnection.
  const signaling = useWebRtcSignaling({ pcRef: peer.pcRef });

  return {
    // --- Peer connection lifecycle (usePeerConnection) ---
    videoRef: peer.videoRef,
    setVideoNode: peer.setVideoNode,
    pcRef: peer.pcRef,
    startWebRtc: peer.startWebRtc,
    stopWebRtc: peer.stopWebRtc,
    retryWebRtc: peer.retryWebRtc,
    connectionState: peer.connectionState,
    hasReceivedFrame: peer.hasReceivedFrame,
    desktopStats: peer.desktopStats,
    // --- Signaling (useWebRtcSignaling) ---
    handleSignalingMessage: signaling.handleSignalingMessage,
    // --- Data channels — files + clipboard (useDataChannels) ---
    filesCtlRef: dataChannels.filesCtlRef,
    filesDataRef: dataChannels.filesDataRef,
    filesClientRef: dataChannels.filesClientRef,
    filesDataChannelRef: dataChannels.filesDataChannelRef,
    filesCtlOpen: dataChannels.filesCtlOpen,
    // clipboardCtlRef is the internal clipboardRef (original line 539 alias preserved)
    clipboardCtlRef: dataChannels.clipboardRef,
    clipboardOriginIdRef: dataChannels.clipboardOriginIdRef,
    clipboardLoopGate: dataChannels.clipboardLoopGateRef.current,
    lastRemoteApplyTimeRef: dataChannels.lastRemoteApplyTimeRef,
    clipboardCtlOpen: dataChannels.clipboardCtlOpen,
  };
}
