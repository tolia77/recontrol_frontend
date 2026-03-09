import { useRef, useCallback, useState, useEffect } from 'react';

interface UseWebRtcOptions {
  sendMessage: (command: string, payload: Record<string, unknown>) => void;
}

interface UseWebRtcReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  startWebRtc: () => void;
  stopWebRtc: () => void;
  handleSignalingMessage: (command: string, payload: Record<string, unknown>) => void;
  isConnected: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

export function useWebRtc({ sendMessage }: UseWebRtcOptions): UseWebRtcReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Whenever the video element mounts or the stream changes, attach it
  const attachStream = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, []);

  const cleanup = useCallback(() => {
    const pc = pcRef.current;
    if (pc) {
      pc.close();
      pcRef.current = null;
    }
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsConnected(false);
  }, []);

  const startWebRtc = useCallback(() => {
    cleanup();

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
      const connected = pc.connectionState === 'connected';
      setIsConnected(connected);
      if (connected) {
        // Video element may have just mounted — try attaching the stream
        setTimeout(attachStream, 50);
      }
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanup();
      }
    };

    // Add a recvonly transceiver to receive video from the Windows client
    pc.addTransceiver('video', { direction: 'recvonly' });

    pc.createOffer().then((offer) => {
      return pc.setLocalDescription(offer).then(() => {
        sendMessage('webrtc.offer', { sdp: offer.sdp });
      });
    });
  }, [sendMessage, cleanup, attachStream]);

  const stopWebRtc = useCallback(() => {
    sendMessage('webrtc.stop', {});
    cleanup();
  }, [sendMessage, cleanup]);

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

  // Re-attach stream whenever isConnected changes (video element may have just mounted)
  useEffect(() => {
    if (isConnected) {
      // Small delay to let React render the <video> element
      const timer = setTimeout(attachStream, 100);
      return () => clearTimeout(timer);
    }
  }, [isConnected, attachStream]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return { videoRef, startWebRtc, stopWebRtc, handleSignalingMessage, isConnected };
}
