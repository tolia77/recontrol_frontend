import React, {useRef, useState, useCallback} from 'react';
import type {MainContentProps} from './types.ts';
import {computeRealImageCoords} from './utils/coords.ts';
import {buttonName, pressedButtonsFromMask, normalizeWheelToClicks, mapButtonToBackend} from './utils/mouse.ts';
import {mapToVirtualKey} from './utils/keyboard.ts';
import {ScreenCanvas} from './ScreenCanvas.tsx';
import {QuickActions} from './QuickActions.tsx';
import { ManualControls } from './ManualControls.tsx';

/**
 * Main Content Area
 */
export const MainContent: React.FC<MainContentProps & { activeMode: 'interactive' | 'manual' }> = ({
                                                            disabled,
                                                            addAction,
                                                            frames = [],
                                                            activeMode,
                                                        }) => {
    // Manual mode rendering
    if (activeMode === 'manual') {
        return <ManualControls disabled={disabled} addAction={addAction} />;
    }

    // Interactive mode (existing)
    // get latest full-frame (jpg) if any
    const latestFrame = frames && frames.length ? frames[frames.length - 1] : null;

    // Refs and state for pointer handling and image natural size
    const containerRef = useRef<HTMLDivElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [naturalSize, setNaturalSize] = useState<{w: number; h: number} | null>(null);
    const lastCoordsRef = useRef<{x: number; y: number} | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);

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

        return computeRealImageCoords(rect, nW, nH, clientX, clientY);
    }, [naturalSize]);

    const handlePointerEvent = useCallback((e: React.PointerEvent, name: string) => {
        // do not stop default UX unless necessary; we still want to report events
        e.preventDefault?.();
        const coords = getRealCoordsFromClient(e.clientX, e.clientY);
        if (!coords) return;

        // e.button indicates the button associated with this event (for down/up)
        // e.buttons is a mask of all currently pressed buttons
        const btn = typeof e.button === 'number' ? e.button : undefined;
        const btnName = buttonName(btn);
        const pressed = pressedButtonsFromMask(e.buttons);

        console.log(`[screen-image] ${name}`, {
            button: btn,
            buttonName: btnName,
            pressedButtonsMask: e.buttons,
            pressedButtons: pressed,
            x: Math.round(coords.x),
            y: Math.round(coords.y),
            debug: coords.debug,
        });

        // Send commands to backend via addAction for down, up and move
        if (typeof addAction === 'function' && !disabled) {
            try {
                if (name === 'pointerdown') {
                    // set last coords so subsequent moves have a reference
                    lastCoordsRef.current = { x: Math.round(coords.x), y: Math.round(coords.y) };
                    addAction({
                        id: crypto.randomUUID(),
                        type: 'mouse.down',
                        payload: {
                            Button: mapButtonToBackend(btn),
                        },
                    });
                } else if (name === 'pointerup') {
                    addAction({
                        id: crypto.randomUUID(),
                        type: 'mouse.up',
                        payload: {
                            Button: mapButtonToBackend(btn),
                        },
                    });
                    // clear tracking on up
                    lastCoordsRef.current = null;
                } else if (name === 'pointermove') {
                    // compute absolute coordinates on the real image and send them
                    const curX = Math.round(coords.x);
                    const curY = Math.round(coords.y);
                    // update last coords for potential other use
                    lastCoordsRef.current = { x: curX, y: curY };

                    addAction({
                        id: crypto.randomUUID(),
                        type: 'mouse.move',
                        payload: {
                            // send absolute coordinates (integers)
                            X: curX,
                            Y: curY,
                        },
                    });
                }
            } catch (err) {
                console.warn('Failed to send mouse action', err);
            }
        }
    }, [getRealCoordsFromClient, buttonName, pressedButtonsFromMask, addAction, disabled]);

    // NEW: keyboard handlers
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // prevent browser shortcuts while controlling remote device
        e.preventDefault();
        const vk = mapToVirtualKey(e);
        console.log('[keyboard] keyDown', { key: e.key, code: e.code, vk });

        if (typeof addAction === 'function' && !disabled && vk) {
            addAction({
                id: crypto.randomUUID(),
                type: 'keyboard.keyDown',
                payload: { Key: vk },
            });
        }
    }, [addAction, disabled, mapToVirtualKey]);

    const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
        e.preventDefault();
        const vk = mapToVirtualKey(e);
        console.log('[keyboard] keyUp', { key: e.key, code: e.code, vk });

        if (typeof addAction === 'function' && !disabled && vk) {
            addAction({
                id: crypto.randomUUID(),
                type: 'keyboard.keyUp',
                payload: { Key: vk },
            });
        }
    }, [addAction, disabled, mapToVirtualKey]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        // prevent default immediately (helps block native context menu on some browsers)
        e.preventDefault();
        // ensure we keep receiving pointer events
        try {
            (e.target as Element).setPointerCapture(e.pointerId);
        } catch (err) {
            console.warn(err)
        }
        // NEW: focus overlay to capture subsequent keyboard events
        overlayRef.current?.focus();
        handlePointerEvent(e, 'pointerdown');
    }, [handlePointerEvent]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        handlePointerEvent(e, 'pointermove');
    }, [handlePointerEvent]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        try {
            (e.target as Element).releasePointerCapture(e.pointerId);
        } catch (err) {
            console.warn(err)
        }
        handlePointerEvent(e, 'pointerup');
    }, [handlePointerEvent]);

    const handlePointerCancel = useCallback((e: React.PointerEvent) => {
        handlePointerEvent(e, 'pointercancel');
    }, [handlePointerEvent]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation?.();

        const coords = getRealCoordsFromClient(e.clientX, e.clientY);
        if (!coords) return;

        const clicks = normalizeWheelToClicks(e.deltaY, e.deltaMode);

        console.log('[screen-image] wheel', {
            deltaX: e.deltaX,
            deltaY: e.deltaY,
            deltaMode: e.deltaMode,
            clicks,
            x: Math.round(coords.x),
            y: Math.round(coords.y),
            debug: coords.debug,
        });

        // send mouse.scroll action to backend
        if (typeof addAction === 'function' && !disabled && clicks !== 0) {
            try {
                addAction({
                    id: crypto.randomUUID(),
                    type: 'mouse.scroll',
                    payload: {
                        Clicks: clicks,
                    },
                });
            } catch (err) {
                console.warn('Failed to send mouse.scroll action', err);
            }
        }
    }, [getRealCoordsFromClient, addAction, disabled]);

    return (
        <div className="flex-1 bg-[#F3F4F6] p-8 flex flex-col items-center">
            <ScreenCanvas
                latestFrame={latestFrame}
                containerRef={containerRef}
                imgRef={imgRef}
                overlayRef={overlayRef}
                onImageLoad={onImageLoad}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onWheel={handleWheel}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
            />
            <QuickActions disabled={disabled} addAction={addAction} />
        </div>
    );
};
