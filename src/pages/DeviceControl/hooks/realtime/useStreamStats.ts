import { useState, useEffect } from "react";
import { frontendLogger } from "src/utils/logger";

export interface StreamStats {
  codec: string;
  fps: number;
  resolution: string;
  framesSkipped?: number;
  encoder?: string;
  framesDecoded?: number;
  framesReceived?: number;
  framesDropped?: number;
  keyFramesDecoded?: number;
  freezeCount?: number | null;
  totalFreezesDuration?: number;
  totalDecodeTime?: number;
  jitter?: number;
  packetsLost?: number;
  packetsReceived?: number;
  bytesReceived?: number;
  rtt?: number | null;
}

export function useStreamStats(
  pcRef: React.RefObject<RTCPeerConnection | null>,
  enabled: boolean,
  desktopStats?: { framesSkipped: number; encoder?: string } | null,
): StreamStats | null {
  const [stats, setStats] = useState<StreamStats | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStats(null);
      return;
    }

    // RTT values accumulated across stat types within a single poll pass
    let roundTripTime: number | null = null;
    let currentRoundTripTime: number | null = null;

    const interval = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;

      // Reset RTT accumulator each poll pass
      roundTripTime = null;
      currentRoundTripTime = null;

      try {
        const report = await pc.getStats();
        report.forEach((stat: Record<string, unknown>) => {
          if (stat.type === "inbound-rtp" && stat.kind === "video") {
            const codecId = stat.codecId as string | undefined;
            let codec = "unknown";
            if (codecId) {
              const codecStat = report.get(codecId) as
                | Record<string, unknown>
                | undefined;
              if (codecStat?.mimeType) {
                codec = (codecStat.mimeType as string).replace("video/", "");
              }
            }

            // Extended field reads — all defensive with ?? null so a closed/early
            // PC or a browser that doesn't support the field returns null rather than
            // undefined (which JSON.stringify would drop from the log entry).
            const framesDecoded = (stat.framesDecoded as number | undefined) ?? null;
            const framesReceived = (stat.framesReceived as number | undefined) ?? null;
            const framesPerSecond = (stat.framesPerSecond as number | undefined) ?? 0;
            const keyFramesDecoded = (stat.keyFramesDecoded as number | undefined) ?? null;
            // freezeCount is an Open Question (not all browsers expose it) — defensive null
            const freezeCount = (stat.freezeCount as number | undefined) ?? null;
            const totalFreezesDuration = (stat.totalFreezesDuration as number | undefined) ?? null;
            const totalDecodeTime = (stat.totalDecodeTime as number | undefined) ?? null;
            const jitter = (stat.jitter as number | undefined) ?? null;
            const packetsLost = (stat.packetsLost as number | undefined) ?? null;
            const packetsReceived = (stat.packetsReceived as number | undefined) ?? null;
            const bytesReceived = (stat.bytesReceived as number | undefined) ?? null;

            // framesDropped is NOT a spec field — compute as framesReceived - framesDecoded (RF-2)
            const framesDropped =
              framesReceived !== null && framesDecoded !== null
                ? framesReceived - framesDecoded
                : null;

            setStats({
              codec,
              fps: framesPerSecond,
              resolution:
                stat.frameWidth && stat.frameHeight
                  ? `${stat.frameWidth}x${stat.frameHeight}`
                  : "unknown",
              framesSkipped: desktopStats?.framesSkipped,
              encoder: desktopStats?.encoder,
              framesDecoded: framesDecoded ?? undefined,
              framesReceived: framesReceived ?? undefined,
              framesDropped: framesDropped ?? undefined,
              keyFramesDecoded: keyFramesDecoded ?? undefined,
              freezeCount,
              totalFreezesDuration: totalFreezesDuration ?? undefined,
              totalDecodeTime: totalDecodeTime ?? undefined,
              jitter: jitter ?? undefined,
              packetsLost: packetsLost ?? undefined,
              packetsReceived: packetsReceived ?? undefined,
              bytesReceived: bytesReceived ?? undefined,
              rtt: roundTripTime ?? currentRoundTripTime,
            });

            // Log the full health field set via frontendLogger.timing (silent, ring-buffered)
            frontendLogger.timing("webrtc", "stats_poll", {
              framesDecoded,
              framesReceived,
              framesDropped,
              framesPerSecond,
              keyFramesDecoded,
              freezeCount,
              totalFreezesDuration,
              totalDecodeTime,
              jitter,
              packetsLost,
              packetsReceived,
              bytesReceived,
              rtt: roundTripTime ?? currentRoundTripTime,
            });
          }

          // ICE-layer RTT (STUN ping/pong) — always available once ICE succeeds
          if (stat.type === "candidate-pair" && stat.state === "succeeded") {
            currentRoundTripTime =
              (stat.currentRoundTripTime as number | undefined) ?? null;
          }

          // RTCP-based RTT — more accurate for media-path latency; may be null early
          if (stat.type === "remote-inbound-rtp") {
            roundTripTime = (stat.roundTripTime as number | undefined) ?? null;
          }
        });
      } catch {
        // PC may have been closed between check and getStats
      }
    }, 2000); // 2 s cadence (RF-2 — halves overhead vs 1 s for always-on period)

    return () => clearInterval(interval);
  }, [pcRef, enabled, desktopStats]);

  return stats;
}
