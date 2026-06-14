import { useCallback, useRef } from "react";
import type React from "react";
import { frontendLogger } from "src/utils/logger";

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
  // Phase 42.1 Fix 1 (FINDINGS): remote ICE candidates can arrive BEFORE the
  // answer is applied (the desktop trickles a local candidate ~60ms before it
  // sends the answer, and the slow ~1.49s offer handling widens the window).
  // Calling addIceCandidate with a null remoteDescription throws
  // "InvalidStateError: The remote description was null". Buffer candidates
  // until setRemoteDescription(answer) resolves, then flush them — mirroring
  // the desktop's existing "buffering ICE candidate (peer connection not ready)".
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const handleSignalingMessage = useCallback(
    (command: string, payload: Record<string, unknown>) => {
      const pc = pcRef.current;
      if (!pc) return;

      // Log command name + safe structural ICE fields only (no SDP body, no raw candidate string).
      frontendLogger.log('info', 'webrtc', command, {
        sdpMid: payload.sdpMid as string | undefined,
        sdpMLineIndex: payload.sdpMLineIndex as number | undefined,
      });

      if (command === "webrtc.answer") {
        const sdp = payload.sdp as string;
        pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }))
          .then(() => {
            // Remote description is applied — flush any candidates that arrived first.
            const pending = pendingCandidatesRef.current;
            pendingCandidatesRef.current = [];
            for (const init of pending) {
              pc.addIceCandidate(new RTCIceCandidate(init)).catch((err) => {
                console.error("[webrtc] buffered addIceCandidate failed:", err);
                // Phase 42.1 Fix C: TEMPORARY un-redacted candidate string so we can
                // identify which candidate Chrome rejects (OperationError). Remove
                // the `candidate` field once the OperationError root cause is fixed.
                frontendLogger.log('error', 'webrtc', 'ice_candidate_flush_failed', {
                  err: String(err),
                  candidate: init.candidate,
                  sdpMid: init.sdpMid,
                });
              });
            }
          })
          .catch((err) => {
            console.error("[webrtc] setRemoteDescription failed:", err);
            frontendLogger.log('error', 'webrtc', `${command}_failed`, { err: String(err) });
          });
      } else if (command === "webrtc.ice_candidate") {
        const candidate = payload.candidate as string;
        const sdpMid = (payload.sdpMid as string) || "0";
        const sdpMLineIndex = (payload.sdpMLineIndex as number) || 0;
        const init: RTCIceCandidateInit = { candidate, sdpMid, sdpMLineIndex };

        // Apply immediately only once the remote description exists; otherwise buffer.
        if (pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(init)).catch((err) => {
            console.error("[webrtc] addIceCandidate failed:", err);
            // Phase 42.1 Fix C: TEMPORARY un-redacted candidate string for diagnosis.
            frontendLogger.log('error', 'webrtc', `${command}_failed`, {
              err: String(err),
              candidate: init.candidate,
              sdpMid: init.sdpMid,
            });
          });
        } else {
          pendingCandidatesRef.current.push(init);
          frontendLogger.log('info', 'webrtc', 'ice_candidate_buffered', { sdpMid, sdpMLineIndex });
        }
      }
    },
    // pcRef and pendingCandidatesRef are ref objects — stable; empty deps is correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { handleSignalingMessage };
}
