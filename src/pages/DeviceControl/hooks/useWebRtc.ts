import { useRef, useCallback, useState, useEffect } from 'react';

export type WebRtcConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface UseWebRtcOptions {
  sendMessage: (command: string, payload: Record<string, unknown>) => void;
}

export interface UseWebRtcReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  pcRef: React.RefObject<RTCPeerConnection | null>;
  startWebRtc: () => void;
  stopWebRtc: () => void;
  retryWebRtc: () => void;
  handleSignalingMessage: (command: string, payload: Record<string, unknown>) => void;
  connectionState: WebRtcConnectionState;
  hasReceivedFrame: boolean;
  desktopStats: { framesSkipped: number } | null;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

const MAX_BACKOFF_MS = 8000;
const TOTAL_TIMEOUT_MS = 20000;

export function useWebRtc({ sendMessage }: UseWebRtcOptions): UseWebRtcReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [connectionState, setConnectionState] = useState<WebRtcConnectionState>('idle');
  const [hasReceivedFrame, setHasReceivedFrame] = useState(false);
  const [desktopStats, setDesktopStats] = useState<{ framesSkipped: number } | null>(null);

  // Reconnect tracking refs
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectStartRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const isReconnectingRef = useRef(false);
  const wasConnectedRef = useRef(false);

  // Whenever the video element mounts or the stream changes, attach it
  const attachStream = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.ondatachannel = null;
      pc.close();
      pcRef.current = null;
    }
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    cleanupPeerConnection();

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage('webrtc.ice_candidate', {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    pc.ontrack = (event) => {
      // SIPSorcery may not include MSID in SDP, so event.streams can be empty.
      // Fall back to creating a MediaStream from the track directly.
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      streamRef.current = stream;
      attachStream();
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;

      if (state === 'connected') {
        setConnectionState('connected');
        wasConnectedRef.current = true;
        isReconnectingRef.current = false;
        retryCountRef.current = 0;
        clearReconnectTimer();
        // Video element may have just mounted -- try attaching the stream
        setTimeout(attachStream, 50);
      } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        // Only attempt reconnect if we were previously connected or connecting
        if (wasConnectedRef.current && !isReconnectingRef.current) {
          attemptReconnect();
        } else if (!isReconnectingRef.current) {
          // Never connected, go to failed
          setConnectionState('failed');
        }
      }
    };

    // Add a recvonly transceiver to receive video from the desktop client
    const transceiver = pc.addTransceiver('video', { direction: 'recvonly' });

    // Prefer H.264 codec, VP8 fallback, preserve RTX/RED/FEC
    const capabilities = RTCRtpReceiver.getCapabilities('video');
    if (capabilities) {
      const h264Codecs = capabilities.codecs.filter(c => c.mimeType === 'video/H264');
      const vp8Codecs = capabilities.codecs.filter(c => c.mimeType === 'video/VP8');
      const otherCodecs = capabilities.codecs.filter(c =>
        c.mimeType !== 'video/H264' && c.mimeType !== 'video/VP8'
      );
      transceiver.setCodecPreferences([...h264Codecs, ...vp8Codecs, ...otherCodecs]);
    }

    pc.ondatachannel = (event) => {
      if (event.channel.label === 'stats') {
        event.channel.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            setDesktopStats({ framesSkipped: data.skipped });
          } catch { /* ignore parse errors */ }
        };
      }
    };

    pc.createOffer().then((offer) => {
      return pc.setLocalDescription(offer).then(() => {
        sendMessage('webrtc.offer', { sdp: offer.sdp });
      });
    });
  }, [sendMessage, cleanupPeerConnection, attachStream, clearReconnectTimer]);

  const attemptReconnect = useCallback(() => {
    // Check if we've exceeded the total timeout
    const now = Date.now();
    if (reconnectStartRef.current === 0) {
      reconnectStartRef.current = now;
    }

    const elapsed = now - reconnectStartRef.current;
    if (elapsed >= TOTAL_TIMEOUT_MS) {
      // Timeout reached -- go to failed
      setConnectionState('failed');
      isReconnectingRef.current = false;
      reconnectStartRef.current = 0;
      retryCountRef.current = 0;
      cleanupPeerConnection();
      return;
    }

    isReconnectingRef.current = true;
    setConnectionState('reconnecting');

    // Exponential backoff: 1s, 2s, 4s, 8s max
    const backoff = Math.min(1000 * Math.pow(2, retryCountRef.current), MAX_BACKOFF_MS);
    retryCountRef.current += 1;

    clearReconnectTimer();
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      // Check timeout again before retrying
      const elapsedNow = Date.now() - reconnectStartRef.current;
      if (elapsedNow >= TOTAL_TIMEOUT_MS) {
        setConnectionState('failed');
        isReconnectingRef.current = false;
        reconnectStartRef.current = 0;
        retryCountRef.current = 0;
        cleanupPeerConnection();
        return;
      }
      createPeerConnection();
    }, backoff);
  }, [cleanupPeerConnection, clearReconnectTimer, createPeerConnection]);

  const startWebRtc = useCallback(() => {
    clearReconnectTimer();
    isReconnectingRef.current = false;
    wasConnectedRef.current = false;
    reconnectStartRef.current = 0;
    retryCountRef.current = 0;
    setHasReceivedFrame(false);
    setDesktopStats(null);
    setConnectionState('connecting');
    createPeerConnection();
  }, [createPeerConnection, clearReconnectTimer]);

  const stopWebRtc = useCallback(() => {
    clearReconnectTimer();
    isReconnectingRef.current = false;
    wasConnectedRef.current = false;
    reconnectStartRef.current = 0;
    retryCountRef.current = 0;
    sendMessage('webrtc.stop', {});
    cleanupPeerConnection();
    setConnectionState('idle');
    setHasReceivedFrame(false);
    setDesktopStats(null);
  }, [sendMessage, cleanupPeerConnection, clearReconnectTimer]);

  const retryWebRtc = useCallback(() => {
    clearReconnectTimer();
    isReconnectingRef.current = false;
    wasConnectedRef.current = false;
    reconnectStartRef.current = 0;
    retryCountRef.current = 0;
    setConnectionState('connecting');
    createPeerConnection();
  }, [createPeerConnection, clearReconnectTimer]);

  const handleSignalingMessage = useCallback((command: string, payload: Record<string, unknown>) => {
    const pc = pcRef.current;
    if (!pc) return;

    if (command === 'webrtc.answer') {
      const sdp = payload.sdp as string;
      pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    } else if (command === 'webrtc.ice_candidate') {
      const candidate = payload.candidate as string;
      const sdpMid = (payload.sdpMid as string) || '0';
      const sdpMLineIndex = (payload.sdpMLineIndex as number) || 0;
      pc.addIceCandidate(new RTCIceCandidate({ candidate, sdpMid, sdpMLineIndex }));
    }
  }, []);

  // Track first frame via video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlaying = () => {
      setHasReceivedFrame(true);
    };

    video.addEventListener('playing', onPlaying);
    return () => {
      video.removeEventListener('playing', onPlaying);
    };
  }, [connectionState]);

  // Re-attach stream whenever connectionState becomes connected (video element may have just mounted)
  useEffect(() => {
    if (connectionState === 'connected') {
      const timer = setTimeout(attachStream, 100);
      return () => clearTimeout(timer);
    }
  }, [connectionState, attachStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimer();
      cleanupPeerConnection();
    };
  }, [clearReconnectTimer, cleanupPeerConnection]);

  return {
    videoRef,
    pcRef,
    startWebRtc,
    stopWebRtc,
    retryWebRtc,
    handleSignalingMessage,
    connectionState,
    hasReceivedFrame,
    desktopStats,
  };
}
