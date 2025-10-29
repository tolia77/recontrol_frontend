import React, {useRef, useState, useCallback} from 'react';
import type {MainContentProps} from './types.ts';

/**
 * Main Content Area
 */
export const MainContent: React.FC<MainContentProps> = ({
                                                            disabled,
                                                            addAction,
                                                            frames = [],
                                                        }) => {
    // get latest full-frame (jpg) if any
    const latestFrame = frames && frames.length ? frames[frames.length - 1] : null;

    // Refs and state for pointer handling and image natural size
    const containerRef = useRef<HTMLDivElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [naturalSize, setNaturalSize] = useState<{w: number; h: number} | null>(null);

    const onImageLoad = useCallback(() => {
        const img = imgRef.current;
        if (img) {
            setNaturalSize({w: img.naturalWidth, h: img.naturalHeight});
        }
    }, []);

    const getRealCoordsFromClient = useCallback((clientX: number, clientY: number) => {
        const container = containerRef.current;
        const img = imgRef.current;
        if (!container || !img) return null;

        const rect = container.getBoundingClientRect();
        const nW = img.naturalWidth || naturalSize?.w || 1;
        const nH = img.naturalHeight || naturalSize?.h || 1;

        // compute scale used by object-fit: contain
        const scale = Math.min(rect.width / nW, rect.height / nH);
        const dispW = nW * scale;
        const dispH = nH * scale;
        const offsetX = (rect.width - dispW) / 2;
        const offsetY = (rect.height - dispH) / 2;

        const relX = clientX - rect.left - offsetX;
        const relY = clientY - rect.top - offsetY;

        // convert to natural image coordinates and clamp
        const x = Math.max(0, Math.min(nW, (relX / dispW) * nW));
        const y = Math.max(0, Math.min(nH, (relY / dispH) * nH));

        return {
            x,
            y,
            debug: {clientX, clientY, rect, nW, nH, dispW, dispH, offsetX, offsetY},
        };
    }, [naturalSize]);

    const handlePointerEvent = useCallback((e: React.PointerEvent, name: string) => {
        e.preventDefault();
        const coords = getRealCoordsFromClient(e.clientX, e.clientY);
        if (!coords) return;
        console.log(`[screen-image] ${name}`, {
            x: Math.round(coords.x),
            y: Math.round(coords.y),
            debug: coords.debug,
        });
    }, [getRealCoordsFromClient]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        // ensure we keep receiving pointer events
        try {
            (e.target as Element).setPointerCapture(e.pointerId);
        } catch (err) {
            // ignore if not supported
        }
        handlePointerEvent(e, 'pointerdown');
    }, [handlePointerEvent]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        handlePointerEvent(e, 'pointermove');
    }, [handlePointerEvent]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        try {
            (e.target as Element).releasePointerCapture(e.pointerId);
        } catch (err) {
            // ignore if not supported
        }
        handlePointerEvent(e, 'pointerup');
    }, [handlePointerEvent]);

    return (
        <div className="flex-1 bg-[#F3F4F6] p-8 flex flex-col items-center">
            {/* Canvas Area */}
            <div className="canvas-container w-full" style={{ maxWidth: 1280 }}>
                <div
                    ref={containerRef}
                    className="canvas-placeholder"
                    style={{
                        position: 'relative',
                        width: '100%',
                        // enforce 16:9 aspect ratio visually
                        aspectRatio: '16/9',
                        background: '#111827',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '0.75rem',
                        boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
                    }}
                >
                    {/* render latest full-frame JPEG as background/full image */}
                    {latestFrame && (
                        <>
                            <img
                                ref={imgRef}
                                src={`data:image/jpeg;base64,${latestFrame.image}`}
                                alt="screen-frame"
                                onLoad={onImageLoad}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    zIndex: 1,
                                    // pointer events disabled on the image itself; overlay will receive events
                                    pointerEvents: 'none',
                                }}
                            />

                            {/* transparent overlay to capture pointer events */}
                            <div
                                className="overlay pointer-events-auto"
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    zIndex: 10,
                                    // keep overlay invisible but interactive
                                    background: 'transparent',
                                }}
                            />
                        </>
                    )}

                    {!latestFrame && (
                        <div
                            className="canvas-content"
                            style={{
                                position: 'relative',
                                zIndex: 3,
                                color: '#D1D5DB', // Light gray text
                            }}
                        >
              <span className="canvas-text text-lg font-medium">
                Interactive Canvas Area
              </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions (Only Stream Buttons) */}
            <div className="quick-actions mt-6">
                <div className="action-buttons flex gap-4">
                    <button
                        className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium shadow hover:bg-[#1E3A8A] disabled:bg-[#D1D5DB] disabled:text-[#8F8F8F] disabled:cursor-not-allowed transition-colors"
                        onClick={() =>
                            addAction({
                                id: crypto.randomUUID(),
                                type: 'screen.start',
                                payload: {},
                            })
                        }
                        disabled={disabled}
                    >
                        Start Screen Stream
                    </button>
                    <button
                        className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium shadow hover:bg-[#1E3A8A] disabled:bg-[#D1D5DB] disabled:text-[#8F8F8F] disabled:cursor-not-allowed transition-colors"
                        onClick={() =>
                            addAction({
                                id: crypto.randomUUID(),
                                type: 'screen.stop',
                                payload: {},
                            })
                        }
                        disabled={disabled}
                    >
                        Stop Screen Stream
                    </button>
                </div>
            </div>
        </div>
    );
};
