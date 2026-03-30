import { useState, useEffect } from 'react';

export interface StreamStats {
    codec: string;
    fps: number;
    resolution: string;
    framesSkipped?: number;
    isIdle?: boolean;
}

export function useStreamStats(
    pcRef: React.RefObject<RTCPeerConnection | null>,
    enabled: boolean,
    desktopStats?: { framesSkipped: number; isIdle: boolean } | null,
): StreamStats | null {
    const [stats, setStats] = useState<StreamStats | null>(null);

    useEffect(() => {
        if (!enabled) {
            setStats(null);
            return;
        }

        const interval = setInterval(async () => {
            const pc = pcRef.current;
            if (!pc) return;

            try {
                const report = await pc.getStats();
                report.forEach((stat: Record<string, unknown>) => {
                    if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
                        const codecId = stat.codecId as string | undefined;
                        let codec = 'unknown';
                        if (codecId) {
                            const codecStat = report.get(codecId) as Record<string, unknown> | undefined;
                            if (codecStat?.mimeType) {
                                codec = (codecStat.mimeType as string).replace('video/', '');
                            }
                        }
                        setStats({
                            codec,
                            fps: (stat.framesPerSecond as number) ?? 0,
                            resolution: stat.frameWidth && stat.frameHeight
                                ? `${stat.frameWidth}x${stat.frameHeight}`
                                : 'unknown',
                            framesSkipped: desktopStats?.framesSkipped,
                            isIdle: desktopStats?.isIdle,
                        });
                    }
                });
            } catch {
                // PC may have been closed between check and getStats
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [pcRef, enabled, desktopStats]);

    return stats;
}
