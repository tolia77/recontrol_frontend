import React, {useRef, useState, useCallback, useEffect} from 'react';
import type {MainContentProps, FrameBatch, FrameRegion} from './types.ts';
import {computeRealImageCoords} from './utils/coords.ts';
import {buttonName, pressedButtonsFromMask, normalizeWheelToClicks, mapButtonToBackend} from './utils/mouse.ts';
import {mapToVirtualKey} from './utils/keyboard.ts';
import {ScreenCanvas} from './ScreenCanvas.tsx';
import {QuickActions} from './QuickActions.tsx';
import {ManualControls} from './ManualControls.tsx';

/**
 * Main Content Area with region-based frame compositing
 */
export const MainContent: React.FC<MainContentProps & { activeMode: 'interactive' | 'manual' }> = ({
                                                                                                       disabled,
                                                                                                       addAction,
                                                                                                       frames = [],
                                                                                                       activeMode,
                                                                                                       terminalResults,
                                                                                                       processes,
                                                                                                       processesLoading,
                                                                                                       requestListProcesses,
                                                                                                       killProcess,
                                                                                                       permissions,
                                                                                                   }) => {
    // region-based frames: latest batch
    const latestBatch: FrameBatch | null = frames.length ? frames[frames.length - 1] : null;

    // canvas & overlay refs
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);

    // natural size from first full frame region encountered
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
    const lastCoordsRef = useRef<{ x: number; y: number } | null>(null);
    const lastMoveSentAtRef = useRef<number>(0);

    // Derived natural size when a full region appears for the first time (only in interactive mode)
    useEffect(() => {
        if (activeMode !== 'interactive') return;
        if (!latestBatch) return;
        if (!naturalSize) {
            const fullRegion = latestBatch.regions.find(r => r.isFull && r.width > 0 && r.height > 0);
            if (fullRegion) {
                setNaturalSize({w: fullRegion.width, h: fullRegion.height});
            } else {
                // Fallback: infer extents from current batch if possible
                let maxRight = 0;
                let maxBottom = 0;
                for (const r of latestBatch.regions) {
                    const right = (r.x || 0) + (r.width || 0);
                    const bottom = (r.y || 0) + (r.height || 0);
                    if (right > maxRight) maxRight = right;
                    if (bottom > maxBottom) maxBottom = bottom;
                }
                if (maxRight > 0 && maxBottom > 0) {
                    setNaturalSize({w: maxRight, h: maxBottom});
                }
            }
        }
    }, [activeMode, latestBatch, naturalSize]);

    // Composite regions onto the canvas whenever a new batch arrives (only in interactive mode)
    useEffect(() => {
        if (activeMode !== 'interactive') return;
        if (!latestBatch || !naturalSize) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ensure canvas size matches natural size
        if (canvas.width !== naturalSize.w || canvas.height !== naturalSize.h) {
            canvas.width = naturalSize.w;
            canvas.height = naturalSize.h;
        }

        // Draw each region
        latestBatch.regions.forEach((region: FrameRegion) => {
            try {
                if (!region.image) return;
                const img = new Image();
                img.onload = () => {
                    // If full frame flag, optionally clear before drawing full frame
                    if (region.isFull) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                    ctx.drawImage(img, region.x, region.y, region.width, region.height);
                };
                img.onerror = (e) => {
                    console.warn('Failed to load region image', e);
                };
                img.src = `data:image/jpeg;base64,${region.image}`;
            } catch (err) {
                console.warn('Error drawing region', err);
            }
        });
    }, [activeMode, latestBatch, naturalSize]);

    const getRealCoordsFromClient = useCallback((clientX: number, clientY: number) => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas || !naturalSize) return null;

        const rect = container.getBoundingClientRect();
        const nW = naturalSize.w;
        const nH = naturalSize.h;

        return computeRealImageCoords(rect, nW, nH, clientX, clientY);
    }, [naturalSize]);

    // Helper: check permission for mouse/keyboard/scroll events
    const hasMouse = !!permissions?.access_mouse;
    const hasKeyboard = !!permissions?.access_keyboard;

    const handlePointerEvent = useCallback((e: React.PointerEvent, name: string) => {
        if (activeMode !== 'interactive') return;
        // Disallow pointer actions without mouse permission
        if (!hasMouse) return;
        e.preventDefault?.();
        const coords = getRealCoordsFromClient(e.clientX, e.clientY);
        if (!coords) return;

        const btn = e.button;
        const btnName = buttonName(btn);
        const pressed = pressedButtonsFromMask(e.buttons);

        console.log(`[screen-canvas] ${name}`, {
            button: btn,
            buttonName: btnName,
            pressedButtonsMask: e.buttons,
            pressedButtons: pressed,
            x: Math.round(coords.x),
            y: Math.round(coords.y),
            debug: coords.debug,
        });

        if (typeof addAction === 'function' && !disabled) {
            try {
                if (name === 'pointerdown') {
                    lastCoordsRef.current = {x: Math.round(coords.x), y: Math.round(coords.y)};
                    addAction({
                        id: crypto.randomUUID(),
                        type: 'mouse.down',
                        payload: {Button: mapButtonToBackend(btn)},
                    });
                } else if (name === 'pointerup') {
                    addAction({
                        id: crypto.randomUUID(),
                        type: 'mouse.up',
                        payload: {Button: mapButtonToBackend(btn)},
                    });
                    lastCoordsRef.current = null;
                } else if (name === 'pointermove') {
                    const curX = Math.round(coords.x);
                    const curY = Math.round(coords.y);
                    lastCoordsRef.current = {x: curX, y: curY};
                    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    if (now - lastMoveSentAtRef.current < 100) return; // throttle
                    lastMoveSentAtRef.current = now;
                    addAction({
                        id: crypto.randomUUID(),
                        type: 'mouse.move',
                        payload: {X: curX, Y: curY},
                    });
                }
            } catch (err) {
                console.warn('Failed to send mouse action', err);
            }
        }
    }, [activeMode, getRealCoordsFromClient, addAction, disabled, hasMouse]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (activeMode !== 'interactive') return;
        // Disallow keyboard without permission
        if (!hasKeyboard) return;
        e.preventDefault();
        const vk = mapToVirtualKey(e);
        console.log('[keyboard] keyDown', {key: e.key, code: e.code, vk});
        if (typeof addAction === 'function' && !disabled && vk) {
            addAction({id: crypto.randomUUID(), type: 'keyboard.keyDown', payload: {Key: vk}});
        }
    }, [activeMode, addAction, disabled, hasKeyboard]);

    const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
        if (activeMode !== 'interactive') return;
        if (!hasKeyboard) return;
        e.preventDefault();
        const vk = mapToVirtualKey(e);
        console.log('[keyboard] keyUp', {key: e.key, code: e.code, vk});
        if (typeof addAction === 'function' && !disabled && vk) {
            addAction({id: crypto.randomUUID(), type: 'keyboard.keyUp', payload: {Key: vk}});
        }
    }, [activeMode, addAction, disabled, hasKeyboard]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (activeMode !== 'interactive') return;
        if (!hasMouse) return;
        e.preventDefault();
        try {
            (e.target as Element).setPointerCapture(e.pointerId);
        } catch (err) {
            console.warn(err);
        }
        overlayRef.current?.focus();
        handlePointerEvent(e, 'pointerdown');
    }, [activeMode, handlePointerEvent, hasMouse]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        handlePointerEvent(e, 'pointermove');
    }, [handlePointerEvent]);
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        try {
            (e.target as Element).releasePointerCapture(e.pointerId);
        } catch (err) {
            console.warn(err);
        }
        handlePointerEvent(e, 'pointerup');
    }, [handlePointerEvent]);
    const handlePointerCancel = useCallback((e: React.PointerEvent) => {
        handlePointerEvent(e, 'pointercancel');
    }, [handlePointerEvent]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (activeMode !== 'interactive') return;
        if (!hasMouse) return;
        e.preventDefault();
        e.stopPropagation?.();
        const coords = getRealCoordsFromClient(e.clientX, e.clientY);
        if (!coords) return;
        const clicks = normalizeWheelToClicks(e.deltaY, e.deltaMode);
        console.log('[screen-canvas] wheel', {
            deltaX: e.deltaX,
            deltaY: e.deltaY,
            deltaMode: e.deltaMode,
            clicks,
            x: Math.round(coords.x),
            y: Math.round(coords.y),
            debug: coords.debug
        });
        if (typeof addAction === 'function' && !disabled && clicks !== 0) {
            try {
                addAction({id: crypto.randomUUID(), type: 'mouse.scroll', payload: {Clicks: clicks}});
            } catch (err) {
                console.warn('Failed to send mouse.scroll', err);
            }
        }
    }, [activeMode, getRealCoordsFromClient, addAction, disabled, hasMouse]);

    const width = naturalSize?.w || 0;
    const height = naturalSize?.h || 0;

    return (
        <div className="flex-1 bg-[#F3F4F6] p-8 flex flex-col items-center">
            {activeMode === 'manual' ? (
                <ManualControls disabled={disabled} addAction={addAction} results={terminalResults} processes={processes} processesLoading={processesLoading} requestListProcesses={requestListProcesses} killProcess={killProcess} permissions={permissions}/>
            ) : (
                <ScreenCanvas
                    latestBatch={latestBatch}
                    containerRef={containerRef}
                    canvasRef={canvasRef}
                    overlayRef={overlayRef}
                    width={width}
                    height={height}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onWheel={handleWheel}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyUp}
                    disabled={disabled || !naturalSize}
                />
            )}
            {permissions?.see_screen && <QuickActions disabled={disabled} addAction={addAction}/>}
        </div>
    );
};
