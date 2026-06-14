import { useCallback, useEffect, useRef, useState } from "react";
import { turnService } from "src/services/backend/turnService";
import { frontendLogger } from "src/utils/logger";
import type React from "react";
import type { WebRtcConnectionState } from "./useWebRtc";

/**
 * Owns the WebRTC peer connection lifecycle: pcRef, videoRef/setVideoNode,
 * start/stop/retryWebRtc, connectionState, hasReceivedFrame, desktopStats,
 * and the reconnect/backoff state machine. Internal to useWebRtc (D-09).
 *
 * Receives setupDataChannels(pc) and cleanupDataChannels() from useDataChannels
 * via the options object (callback injection pattern). cleanupPeerConnection
 * calls cleanupDataChannels() BEFORE pc.close() to preserve Spike C ordering
 * (Landmine 6 / 09-SPIKE-FINDINGS.md: dc.close() from this side does not
 * propagate to SIPSorcery, so pc.close() drives teardown).
 */

interface UsePeerConnectionOptions {
  sendMessage: (command: string, payload: Record<string, unknown>) => void;
  setupDataChannels: (pc: RTCPeerConnection) => void;
  cleanupDataChannels: () => void;
}

export interface UsePeerConnectionReturn {
  pcRef: React.RefObject<RTCPeerConnection | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setVideoNode: (node: HTMLVideoElement | null) => void;
  startWebRtc: () => void;
  stopWebRtc: () => void;
  retryWebRtc: () => void;
  connectionState: WebRtcConnectionState;
  hasReceivedFrame: boolean;
  desktopStats: {
    framesSkipped: number;
    encoder?: string;
    seq?: number;
    rtpTs?: number;
    captureUs?: number;
    encodeUs?: number;
    fps?: number;
    nulls?: number;
    sentBytes?: number;
  } | null;
}

// STUN-only fallback. Used if the backend's /turn_credentials endpoint is
// unreachable (network outage, Cloudflare API hiccup, dev env without TURN env
// vars). Same-LAN peers still connect via host candidates; cross-NAT peers
// behind symmetric NATs will fail without TURN, which matches pre-TURN behavior.
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

const MAX_BACKOFF_MS = 8000;
const TOTAL_TIMEOUT_MS = 45000;
// Per-attempt watchdog: if the newly created pc never reaches "connected" within
// this window (e.g. peer is offline, no remote description -> no ICE events),
// re-enter attemptReconnect so the 45s budget check fires even without a
// connectionstatechange event. Stored in the same reconnectTimerRef slot so
// clearReconnectTimer / stopWebRtc / connected-branch already cover cleanup.
const WATCHDOG_MS = 9000;

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const credentials = await turnService.getCredentials();
    if (credentials?.ice_servers?.length) return credentials.ice_servers;
    console.warn(
      "[webrtc] /turn_credentials returned empty list, falling back to STUN-only",
    );
    return FALLBACK_ICE_SERVERS;
  } catch (err) {
    console.warn(
      "[webrtc] /turn_credentials failed, falling back to STUN-only:",
      err,
    );
    return FALLBACK_ICE_SERVERS;
  }
}

export function usePeerConnection({
  sendMessage,
  setupDataChannels,
  cleanupDataChannels,
}: UsePeerConnectionOptions): UsePeerConnectionReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Reconnect tracking refs
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectStartRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const isReconnectingRef = useRef(false);
  const wasConnectedRef = useRef(false);

  // Generation counter so an in-flight TURN-credentials fetch from a superseded
  // createPeerConnection call (e.g. user clicked retry mid-fetch) is discarded
  // instead of clobbering the live peer connection.
  const pcGenRef = useRef(0);

  // requestVideoFrameCallback id — tracks the pending one-shot rvfc registration
  // so it can be cancelled in cleanupPeerConnection (T-42.1-16 mitigation).
  const rvfcIdRef = useRef<number | null>(null);

  const [connectionState, setConnectionState] =
    useState<WebRtcConnectionState>("idle");
  const [hasReceivedFrame, setHasReceivedFrame] = useState(false);
  const [desktopStats, setDesktopStats] = useState<{
    framesSkipped: number;
    encoder?: string;
    seq?: number;
    rtpTs?: number;
    captureUs?: number;
    encodeUs?: number;
    fps?: number;
    nulls?: number;
    sentBytes?: number;
  } | null>(null);

  // Whenever the video element mounts or the stream changes, attach it
  const attachStream = useCallback(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, []);

  /**
   * Per-rendered-frame callback (T-42.1-15 mitigation: body is ONLY logger enqueue
   * + re-register; no awaits, no DOM work, no JSON.stringify in this callback).
   * One-shot API — re-register at the end of each call (RESEARCH Pitfall 3).
   */
  const attachRvfc = useCallback((video: HTMLVideoElement) => {
    const onFrame = (
      now: DOMHighResTimeStamp,
      metadata: VideoFrameCallbackMetadata,
    ) => {
      frontendLogger.timing("webrtc", "frame_rendered", {
        rtpTimestamp: metadata.rtpTimestamp,
        captureTime: metadata.captureTime,
        receiveTime: metadata.receiveTime,
        presentationTime: metadata.presentationTime,
        paintTs: now,
        presentedFrames: metadata.presentedFrames,
      });
      // Re-register for next frame (rvfc is one-shot — Pitfall 3)
      rvfcIdRef.current = video.requestVideoFrameCallback(onFrame);
    };
    rvfcIdRef.current = video.requestVideoFrameCallback(onFrame);
  }, []);

  /**
   * Cancel the pending rvfc registration (T-42.1-16 mitigation).
   * Must be called BEFORE pc.close() in cleanupPeerConnection.
   */
  const detachRvfc = useCallback((video: HTMLVideoElement) => {
    if (rvfcIdRef.current !== null) {
      video.cancelVideoFrameCallback(rvfcIdRef.current);
      rvfcIdRef.current = null;
    }
  }, []);

  // Callback ref: parent layout swaps (e.g. opening the file manager panel)
  // remount the <video> element. Re-attach srcObject every time the node
  // changes so the live MediaStream binds to the new DOM node.
  const setVideoNode = useCallback(
    (node: HTMLVideoElement | null) => {
      // Detach rvfc from the old node before switching
      if (videoRef.current && videoRef.current !== node) {
        detachRvfc(videoRef.current);
      }
      videoRef.current = node;
      if (node && streamRef.current) {
        node.srcObject = streamRef.current;
        // Attach rvfc to the new node now that it has a srcObject
        attachRvfc(node);
      }
    },
    [attachRvfc, detachRvfc],
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    // Invalidate any in-flight TURN-credentials fetch. A createPeerConnection
    // call awaiting fetchIceServers() captured a generation before this
    // teardown; bumping the counter here makes its gen !== pcGenRef.current
    // guard fail so it bails instead of resurrecting a pc (and re-sending
    // webrtc.offer) after stop / 45s-timeout / unmount.
    pcGenRef.current++;

    // Cancel any pending requestVideoFrameCallback BEFORE closing the PC
    // (T-42.1-16 mitigation — rvfc must not fire after teardown).
    if (videoRef.current) {
      detachRvfc(videoRef.current);
    }

    // Dispose data-channel wrappers BEFORE closing the RTCPeerConnection.
    // Spike C ordering (Landmine 6): cleanupDataChannels() runs first,
    // then pc.close() below drives the actual channel teardown on both sides.
    cleanupDataChannels();

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
  }, [cleanupDataChannels, detachRvfc]);

  const createPeerConnection = useCallback(async () => {
    cleanupPeerConnection();

    const gen = ++pcGenRef.current;
    const iceServers = await fetchIceServers();
    if (gen !== pcGenRef.current) {
      // A later createPeerConnection call superseded us while awaiting TURN
      // credentials. Drop this attempt; the newer one owns the lifecycle.
      return;
    }

    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage("webrtc.ice_candidate", {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    pc.ontrack = (event) => {
      // Phase 42.1 Fix B (FINDINGS): the browser's jitter/playout buffer added
      // ~220ms (p95 278ms) of receive->present latency — the dominant perceived
      // lag for a remote-control stream. Bias the receiver toward minimal
      // buffering: playoutDelayHint (Chromium, seconds; 0 = minimize) and the
      // spec'd jitterBufferTarget (ms). Wrapped in try/catch — non-Chromium
      // browsers don't implement these and would otherwise throw.
      try {
        const r = event.receiver as RTCRtpReceiver & {
          playoutDelayHint?: number;
          jitterBufferTarget?: number | null;
        };
        r.playoutDelayHint = 0;
        r.jitterBufferTarget = 0;
      } catch {
        // Receiver latency hints unsupported on this browser — ignore.
      }

      // SIPSorcery may not include MSID in SDP, so event.streams can be empty.
      // Fall back to creating a MediaStream from the track directly.
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      streamRef.current = stream;
      attachStream();
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;

      if (state === "connected") {
        setConnectionState("connected");
        wasConnectedRef.current = true;
        isReconnectingRef.current = false;
        retryCountRef.current = 0;
        // Reset the 45s episode budget: each disconnect episode gets a fresh
        // TOTAL_TIMEOUT_MS window. Without this, the second disconnect of a
        // session measures elapsed time from the FIRST episode's start and
        // insta-fails with zero retries.
        reconnectStartRef.current = 0;
        clearReconnectTimer();
        // Video element may have just mounted -- try attaching the stream
        setTimeout(attachStream, 50);
      } else if (
        state === "failed" ||
        state === "disconnected" ||
        state === "closed"
      ) {
        // first failure after a good connection: start a reconnect episode.
        // Once an episode is active, the per-attempt watchdog (armed in
        // attemptReconnect) drives re-entry and the 45s budget check -- a
        // pending timer always occupies reconnectTimerRef during an episode,
        // so failure events on the retry pc are intentionally not re-driven
        // here (that path is unreachable and was removed).
        if (wasConnectedRef.current && !isReconnectingRef.current) {
          attemptReconnect();
        } else if (!isReconnectingRef.current) {
          // Never connected and not reconnecting -> fail immediately
          setConnectionState("failed");
        }
      }
    };

    // Add a recvonly transceiver to receive video from the desktop client
    const transceiver = pc.addTransceiver("video", { direction: "recvonly" });

    // Prefer H.264 codec, VP8 fallback, preserve RTX/RED/FEC
    const capabilities = RTCRtpReceiver.getCapabilities("video");
    if (capabilities) {
      const h264Codecs = capabilities.codecs.filter(
        (c) => c.mimeType === "video/H264",
      );
      const vp8Codecs = capabilities.codecs.filter(
        (c) => c.mimeType === "video/VP8",
      );
      const otherCodecs = capabilities.codecs.filter(
        (c) => c.mimeType !== "video/H264" && c.mimeType !== "video/VP8",
      );
      transceiver.setCodecPreferences([
        ...h264Codecs,
        ...vp8Codecs,
        ...otherCodecs,
      ]);
    }

    pc.ondatachannel = (event) => {
      if (event.channel.label === "stats") {
        event.channel.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data as string) as {
              skipped?: number;
              encoder?: string;
              resolution?: string;
              seq?: number;
              rtpTs?: number;
              captureUs?: number;
              encodeUs?: number;
              fps?: number;
              nulls?: number;
              sentBytes?: number;
            };

            // Log extended desktop stats for cross-side correlation (D-08)
            frontendLogger.timing("webrtc", "desktop_stats", {
              skipped: data.skipped,
              encoder: data.encoder,
              resolution: data.resolution,
              seq: data.seq,
              rtpTs: data.rtpTs,
              captureUs: data.captureUs,
              encodeUs: data.encodeUs,
              fps: data.fps,
              nulls: data.nulls,
              sentBytes: data.sentBytes,
            });

            setDesktopStats({
              framesSkipped: data.skipped ?? 0,
              encoder: data.encoder,
              seq: data.seq,
              rtpTs: data.rtpTs,
              captureUs: data.captureUs,
              encodeUs: data.encodeUs,
              fps: data.fps,
              nulls: data.nulls,
              sentBytes: data.sentBytes,
            });
          } catch {
            /* ignore parse errors */
          }
        };
      }
    };

    // Set up data channels (files-ctl, files-data, clipboard) via the
    // callback injected by useDataChannels. Must happen BEFORE createOffer
    // so the channels appear in the initial SDP offer's single SCTP m-section.
    setupDataChannels(pc);

    pc.createOffer()
      .then((offer) => {
        return pc.setLocalDescription(offer).then(() => {
          sendMessage("webrtc.offer", { sdp: offer.sdp });
        });
      })
      .catch((err: unknown) => {
        // Without this, a rejection in createOffer/setLocalDescription dies as
        // an unhandled promise rejection and the UI stays stuck on 'connecting'
        // with no clue why.
        console.error("[webrtc] createOffer/setLocalDescription failed:", err);
        frontendLogger.log("error", "webrtc", "create_offer_failed", {
          err: String(err),
        });
        setConnectionState("failed");
      });
  }, [
    sendMessage,
    cleanupPeerConnection,
    attachStream,
    clearReconnectTimer,
    setupDataChannels,
  ]);

  const attemptReconnect = useCallback(() => {
    // Check if we've exceeded the total timeout
    const now = Date.now();
    if (reconnectStartRef.current === 0) {
      reconnectStartRef.current = now;
    }

    const elapsed = now - reconnectStartRef.current;
    if (elapsed >= TOTAL_TIMEOUT_MS) {
      // Timeout reached -- go to failed
      setConnectionState("failed");
      isReconnectingRef.current = false;
      reconnectStartRef.current = 0;
      retryCountRef.current = 0;
      cleanupPeerConnection();
      return;
    }

    isReconnectingRef.current = true;
    setConnectionState("reconnecting");

    // Exponential backoff: 1s, 2s, 4s, 8s max
    const backoff = Math.min(
      1000 * Math.pow(2, retryCountRef.current),
      MAX_BACKOFF_MS,
    );
    retryCountRef.current += 1;

    clearReconnectTimer();
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      // Check timeout again before retrying
      const elapsedNow = Date.now() - reconnectStartRef.current;
      if (elapsedNow >= TOTAL_TIMEOUT_MS) {
        setConnectionState("failed");
        isReconnectingRef.current = false;
        reconnectStartRef.current = 0;
        retryCountRef.current = 0;
        cleanupPeerConnection();
        return;
      }
      void createPeerConnection();
      // Per-attempt watchdog: arm a timer (in the same reconnectTimerRef slot)
      // that re-enters attemptReconnect if the new pc never reaches "connected".
      // This ensures the 45s elapsed check fires even when the peer is offline
      // and no connectionstatechange event ever fires (pc stays in "new" forever).
      // Reusing reconnectTimerRef means clearReconnectTimer(), stopWebRtc(),
      // retryWebRtc(), the connected branch, and the unmount cleanup all cancel
      // this watchdog with no extra code.
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (pcRef.current?.connectionState !== "connected") {
          attemptReconnect();
        }
      }, WATCHDOG_MS);
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
    setConnectionState("connecting");
    void createPeerConnection();
  }, [createPeerConnection, clearReconnectTimer]);

  const stopWebRtc = useCallback(() => {
    clearReconnectTimer();
    isReconnectingRef.current = false;
    wasConnectedRef.current = false;
    reconnectStartRef.current = 0;
    retryCountRef.current = 0;
    sendMessage("webrtc.stop", {});
    cleanupPeerConnection();
    setConnectionState("idle");
    setHasReceivedFrame(false);
    setDesktopStats(null);
  }, [sendMessage, cleanupPeerConnection, clearReconnectTimer]);

  const retryWebRtc = useCallback(() => {
    clearReconnectTimer();
    isReconnectingRef.current = false;
    wasConnectedRef.current = false;
    reconnectStartRef.current = 0;
    retryCountRef.current = 0;
    setConnectionState("connecting");
    void createPeerConnection();
  }, [createPeerConnection, clearReconnectTimer]);

  // Track first frame via video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlaying = () => {
      setHasReceivedFrame(true);
    };

    video.addEventListener("playing", onPlaying);
    return () => {
      video.removeEventListener("playing", onPlaying);
    };
  }, [connectionState]);

  // Re-attach stream whenever connectionState becomes connected (video element may have just mounted)
  useEffect(() => {
    if (connectionState === "connected") {
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
    pcRef,
    videoRef,
    setVideoNode,
    startWebRtc,
    stopWebRtc,
    retryWebRtc,
    connectionState,
    hasReceivedFrame,
    desktopStats,
  };
}
