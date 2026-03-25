import { useRef, useCallback, useState } from 'react';
import type { MainContentProps, ScalingMode } from './types';
import { computeRealImageCoords } from './utils/coords';
import { buttonName, pressedButtonsFromMask, normalizeWheelToClicks, mapButtonToBackend } from './utils/mouse';
import { mapToVirtualKey } from './utils/keyboard';
import { ManualControls } from './ManualControls';
import { StreamControls } from './components/StreamControls';
import { generateUUID } from 'src/utils/uuid';

/**
 * Main Content Area with WebRTC video stream
 */
export const MainContent: React.FC<MainContentProps & { activeMode: 'interactive' | 'manual' }> = ({
                                                                                                       disabled,
                                                                                                       addAction,
                                                                                                       activeMode,
                                                                                                       terminalResults,
                                                                                                       processes,
                                                                                                       processesLoading,
                                                                                                       requestListProcesses,
                                                                                                       killProcess,
                                                                                                       permissions,
                                                                                                       videoRef,
                                                                                                       connectionState,
                                                                                                       hasReceivedFrame,
                                                                                                       retryWebRtc,
                                                                                                   }) => {
    // overlay & container refs
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const videoContainerRef = useRef<HTMLDivElement | null>(null);

    const lastCoordsRef = useRef<{ x: number; y: number } | null>(null);
    const lastMoveSentAtRef = useRef<number>(0);

    // Scaling mode state
    const [scalingMode, setScalingMode] = useState<ScalingMode>('fit');

    const getRealCoordsFromClient = useCallback((clientX: number, clientY: number) => {
        if (videoRef?.current) {
            const video = videoRef.current;
            const container = videoContainerRef.current;
            if (!container) return null;
            const nW = video.videoWidth;
            const nH = video.videoHeight;
            if (!nW || !nH) return null;
            const rect = container.getBoundingClientRect();
            return computeRealImageCoords(rect, nW, nH, clientX, clientY);
        }
        return null;
    }, [videoRef]);

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
                        id: generateUUID(),
                        type: 'mouse.down',
                        payload: {Button: mapButtonToBackend(btn)},
                    });
                } else if (name === 'pointerup') {
                    addAction({
                        id: generateUUID(),
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
                        id: generateUUID(),
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
            addAction({id: generateUUID(), type: 'keyboard.keyDown', payload: {Key: vk}});
        }
    }, [activeMode, addAction, disabled, hasKeyboard]);

    const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
        if (activeMode !== 'interactive') return;
        if (!hasKeyboard) return;
        e.preventDefault();
        const vk = mapToVirtualKey(e);
        console.log('[keyboard] keyUp', {key: e.key, code: e.code, vk});
        if (typeof addAction === 'function' && !disabled && vk) {
            addAction({id: generateUUID(), type: 'keyboard.keyUp', payload: {Key: vk}});
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
                addAction({id: generateUUID(), type: 'mouse.scroll', payload: {Clicks: clicks}});
            } catch (err) {
                console.warn('Failed to send mouse.scroll', err);
            }
        }
    }, [activeMode, getRealCoordsFromClient, addAction, disabled, hasMouse]);

    // Render the video stream with interactive overlay
    const renderVideoStream = (showOverlay: boolean) => (
        <div
            ref={videoContainerRef}
            className="canvas-placeholder"
            style={{
                position: 'relative',
                width: '100%',
                aspectRatio: (videoRef?.current?.videoWidth && videoRef?.current?.videoHeight)
                    ? `${videoRef.current.videoWidth}/${videoRef.current.videoHeight}`
                    : '16/9',
                background: '#111827',
                overflow: scalingMode === '1:1' ? 'auto' : 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
            }}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                    position: scalingMode === '1:1' ? 'relative' : 'absolute',
                    top: 0,
                    left: 0,
                    width: scalingMode === '1:1' ? 'auto' : '100%',
                    height: scalingMode === '1:1' ? 'auto' : '100%',
                    objectFit: scalingMode === '1:1' ? 'none' : 'contain',
                    zIndex: 1,
                    pointerEvents: 'none',
                    background: '#000',
                }}
            />
            {showOverlay && (
                <div
                    ref={overlayRef}
                    className="overlay pointer-events-auto"
                    onPointerDown={disabled ? undefined : handlePointerDown}
                    onPointerMove={disabled ? undefined : handlePointerMove}
                    onPointerUp={disabled ? undefined : handlePointerUp}
                    onPointerCancel={disabled ? undefined : handlePointerCancel}
                    onWheel={disabled ? undefined : handleWheel}
                    onContextMenu={(e) => { e.preventDefault(); }}
                    tabIndex={0}
                    onKeyDown={disabled ? undefined : handleKeyDown}
                    onKeyUp={disabled ? undefined : handleKeyUp}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 10,
                        background: 'transparent',
                        outline: 'none',
                    }}
                />
            )}
        </div>
    );

    // Render stream content based on connection state
    const renderStreamContent = () => {
        if (connectionState === 'idle') {
            // Waiting placeholder
            return (
                <div className="canvas-container w-full" style={{ maxWidth: 1280 }}>
                    <div
                        className="canvas-placeholder"
                        style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '16/9',
                            background: '#111827',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
                        }}
                    >
                        <div style={{ position: 'relative', zIndex: 3, color: '#D1D5DB', textAlign: 'center' }}>
                            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z" />
                            </svg>
                            <span className="text-lg font-medium">Click Start Stream to begin</span>
                        </div>
                    </div>
                </div>
            );
        }

        if (connectionState === 'connecting') {
            // Connecting spinner
            return (
                <div className="canvas-container w-full" style={{ maxWidth: 1280 }}>
                    <div
                        className="canvas-placeholder"
                        style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '16/9',
                            background: '#111827',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
                        }}
                    >
                        <div style={{ position: 'relative', zIndex: 3, color: '#D1D5DB', textAlign: 'center' }}>
                            <div className="w-8 h-8 mx-auto mb-3 border-2 border-gray-500 border-t-indigo-400 rounded-full animate-spin" />
                            <span className="text-lg font-medium">Connecting...</span>
                        </div>
                    </div>
                </div>
            );
        }

        if (connectionState === 'connected') {
            // Live video stream with controls
            return (
                <div className="canvas-container w-full" style={{ maxWidth: 1280 }}>
                    {renderVideoStream(true)}
                    <div className="flex justify-center mt-2">
                        <StreamControls
                            addAction={addAction}
                            scalingMode={scalingMode}
                            onScalingModeChange={setScalingMode}
                            containerRef={videoContainerRef}
                            disabled={disabled}
                        />
                    </div>
                </div>
            );
        }

        if (connectionState === 'reconnecting') {
            // Reconnecting overlay on last frame (or spinner if no frame yet)
            return (
                <div className="canvas-container w-full" style={{ maxWidth: 1280 }}>
                    {hasReceivedFrame && videoRef ? (
                        <div style={{ position: 'relative' }}>
                            {renderVideoStream(false)}
                            {/* Dimmed overlay with reconnecting message */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    background: 'rgba(0, 0, 0, 0.6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 20,
                                    borderRadius: 'inherit',
                                }}
                            >
                                <div style={{ color: '#D1D5DB', textAlign: 'center' }}>
                                    <div className="w-8 h-8 mx-auto mb-3 border-2 border-gray-500 border-t-indigo-400 rounded-full animate-spin" />
                                    <span className="text-lg font-medium">Reconnecting...</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="canvas-placeholder"
                            style={{
                                position: 'relative',
                                width: '100%',
                                aspectRatio: '16/9',
                                background: '#111827',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
                            }}
                        >
                            <div style={{ position: 'relative', zIndex: 3, color: '#D1D5DB', textAlign: 'center' }}>
                                <div className="w-8 h-8 mx-auto mb-3 border-2 border-gray-500 border-t-indigo-400 rounded-full animate-spin" />
                                <span className="text-lg font-medium">Reconnecting...</span>
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        if (connectionState === 'failed') {
            // Error state with retry button
            return (
                <div className="canvas-container w-full" style={{ maxWidth: 1280 }}>
                    <div
                        className="canvas-placeholder"
                        style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '16/9',
                            background: '#111827',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
                        }}
                    >
                        <div style={{ position: 'relative', zIndex: 3, color: '#D1D5DB', textAlign: 'center' }}>
                            <svg className="w-12 h-12 mx-auto mb-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                            <span className="text-lg font-medium block mb-4">Connection failed</span>
                            <button
                                onClick={retryWebRtc}
                                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Retry Connection
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="flex-1 bg-[#F3F4F6] p-2 flex flex-col items-center">
            {activeMode === 'manual' ? (
                <ManualControls disabled={disabled} addAction={addAction} results={terminalResults}
                                processes={processes} processesLoading={processesLoading}
                                requestListProcesses={requestListProcesses} killProcess={killProcess}
                                permissions={permissions}/>
            ) : (
                renderStreamContent()
            )}
        </div>
    );
};
