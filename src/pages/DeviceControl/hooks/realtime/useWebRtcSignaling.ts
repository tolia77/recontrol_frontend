import { useCallback } from "react";
import type React from "react";

/**
 * Handles incoming WebRTC signaling messages (webrtc.answer, webrtc.ice_candidate).
 * Internal to useWebRtc (D-09). Takes the pcRef owned by usePeerConnection so
 * it operates on the live RTCPeerConnection without needing to own it.
 */

interface UseWebRtcSignalingOptions {
  pcRef: React.RefObject<RTCPeerConnection | null>;
}

export interface UseWebRtcSignalingReturn {
  handleSignalingMessage: (
    command: string,
    payload: Record<string, unknown>,
  ) => void;
}

export function useWebRtcSignaling({
  pcRef,
}: UseWebRtcSignalingOptions): UseWebRtcSignalingReturn {
  // Source: useWebRtc.ts lines 470–490 — copied verbatim
  const handleSignalingMessage = useCallback(
    (command: string, payload: Record<string, unknown>) => {
      const pc = pcRef.current;
      if (!pc) return;

      if (command === "webrtc.answer") {
        const sdp = payload.sdp as string;
        pc.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp }),
        );
      } else if (command === "webrtc.ice_candidate") {
        const candidate = payload.candidate as string;
        const sdpMid = (payload.sdpMid as string) || "0";
        const sdpMLineIndex = (payload.sdpMLineIndex as number) || 0;
        pc.addIceCandidate(
          new RTCIceCandidate({ candidate, sdpMid, sdpMLineIndex }),
        );
      }
    },
    // pcRef is a ref object — stable reference; empty deps array is correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { handleSignalingMessage };
}
