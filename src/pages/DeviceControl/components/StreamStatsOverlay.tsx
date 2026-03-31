import type { StreamStats } from '../hooks/useStreamStats';

interface StreamStatsOverlayProps {
    stats: StreamStats | null;
    visible: boolean;
}

export function StreamStatsOverlay({ stats, visible }: StreamStatsOverlayProps) {
    if (!visible || !stats) return null;

    return (
        <div
            style={{
                position: 'absolute',
                top: 8,
                left: 8,
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#fff',
                padding: '6px 10px',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'monospace',
                zIndex: 15,
                pointerEvents: 'none',
                lineHeight: 1.5,
            }}
        >
            <div>Codec: {stats.codec}</div>
            <div>Encoder: {stats.encoder ?? '-'}</div>
            <div>FPS: {Math.round(stats.fps)}</div>
            <div>Res: {stats.resolution}</div>
            <div>Skipped: {stats.framesSkipped != null ? stats.framesSkipped : '-'}</div>
        </div>
    );
}
