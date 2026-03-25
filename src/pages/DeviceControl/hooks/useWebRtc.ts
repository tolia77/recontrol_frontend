import { useRef, useCallback, useState, useEffect } from 'react';

export type WebRtcConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

interface UseWebRtcOptions {
  sendMessage: (command: string, payload: Record<string, unknown>) => void;
}

export interface UseWebRtcReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startWebRtc: () => void;
  stopWebRtc: () => void;
  retryWebRtc: () => void;
  handleSignalingMessage: (command: string, payload: Record<string, unknown>) => void;
  connectionState: WebRtcConnectionState;
  hasReceivedFrame: boolean;
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
      if (event.streams[0]) {
        streamRef.current = event.streams[0];
        attachStream();
      }
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
    pc.addTransceiver('video', { direction: 'recvonly' });

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
    startWebRtc,
    stopWebRtc,
    retryWebRtc,
    handleSignalingMessage,
    connectionState,
    hasReceivedFrame,
  };
}
