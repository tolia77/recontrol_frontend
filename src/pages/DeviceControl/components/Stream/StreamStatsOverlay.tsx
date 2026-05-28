import type { StreamStats } from "../../hooks/realtime/useStreamStats";

interface StreamStatsOverlayProps {
  stats: StreamStats | null;
  visible: boolean;
}

export function StreamStatsOverlay({
  stats,
  visible,
}: StreamStatsOverlayProps) {
  if (!visible || !stats) return null;

  return (
    <div className="pointer-events-none absolute top-2 left-2 z-[15] rounded bg-black/70 px-2.5 py-1.5 font-mono text-xs leading-normal text-white">
      <div>Codec: {stats.codec}</div>
      <div>Encoder: {stats.encoder ?? "-"}</div>
      <div>FPS: {Math.round(stats.fps)}</div>
      <div>Res: {stats.resolution}</div>
      <div>
        Skipped: {stats.framesSkipped != null ? stats.framesSkipped : "-"}
      </div>
    </div>
  );
}
