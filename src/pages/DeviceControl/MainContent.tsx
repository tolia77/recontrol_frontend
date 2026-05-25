import { useRef, useCallback, useState } from 'react';
import type { MainContentProps, ScalingMode } from './types';
import { computeRealImageCoords } from './utils/coords';
import { buttonName, pressedButtonsFromMask, normalizeWheelToClicks, mapButtonToBackend } from './utils/mouse';
import { mapToVirtualKey } from './utils/keyboard';
import { ManualControls } from './ManualControls';
import { StreamStatsOverlay } from './components/StreamStatsOverlay';
import { Splitter } from './components/FileManager/Splitter';

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
                                                                                                       setVideoNode,
                                                                                                       connectionState,
                                                                                                       hasReceivedFrame,
                                                                                                       retryWebRtc,
                                                                                                       streamStats,
                                                                                                       showStats,
                                                                                                       fileManagerNode,
                                                                                                       assistantPanelNode,
                                                                                                       scenariosPanelNode,
                                                                                                       splitRatio,
                                                                                                       setSplitRatio,
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
                        type: 'mouse.down',
                        payload: {Button: mapButtonToBackend(btn)},
                    });
                } else if (name === 'pointerup') {
                    addAction({
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
            addAction({type: 'keyboard.keyDown', payload: {Key: vk}});
        }
    }, [activeMode, addAction, disabled, hasKeyboard]);

    const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
        if (activeMode !== 'interactive') return;
        if (!hasKeyboard) return;
        e.preventDefault();
        const vk = mapToVirtualKey(e);
        console.log('[keyboard] keyUp', {key: e.key, code: e.code, vk});
        if (typeof addAction === 'function' && !disabled && vk) {
            addAction({type: 'keyboard.keyUp', payload: {Key: vk}});
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
                addAction({type: 'mouse.scroll', payload: {Clicks: clicks}});
            } catch (err) {
                console.warn('Failed to send mouse.scroll', err);
            }
        }
    }, [activeMode, getRealCoordsFromClient, addAction, disabled, hasMouse]);

    // Render the video stream with interactive overlay
    const renderVideoStream = (showOverlay: boolean) => {
        // aspectRatio is computed from the live video dimensions, so it is the
        // one value that can't be a static Tailwind utility — it stays inline.
        const aspectRatio =
            videoRef?.current?.videoWidth && videoRef?.current?.videoHeight
                ? `${videoRef.current.videoWidth}/${videoRef.current.videoHeight}`
                : '16/9';
        const pixelPerfect = scalingMode === '1:1';
        return (
            <div
                ref={videoContainerRef}
                className={`relative flex items-center justify-center bg-[#0a0d18] shadow-[inset_0_2px_4px_0_rgb(0_0_0/0.05)] ${pixelPerfect ? 'w-full overflow-auto' : 'h-full w-full overflow-hidden'}`}
                style={pixelPerfect ? { aspectRatio } : undefined}
            >
                <video
                    ref={setVideoNode ?? videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`pointer-events-none z-[1] bg-black ${pixelPerfect ? 'static h-auto w-auto object-none' : 'absolute inset-0 h-full w-full object-contain'}`}
                />
                <StreamStatsOverlay stats={streamStats ?? null} visible={!!showStats} />
                {showOverlay && (
                    <div
                        ref={overlayRef}
                        className="overlay pointer-events-auto absolute inset-0 z-10 bg-transparent outline-none"
                        onPointerDown={disabled ? undefined : handlePointerDown}
                        onPointerMove={disabled ? undefined : handlePointerMove}
                        onPointerUp={disabled ? undefined : handlePointerUp}
                        onPointerCancel={disabled ? undefined : handlePointerCancel}
                        onWheel={disabled ? undefined : handleWheel}
                        onContextMenu={(e) => { e.preventDefault(); }}
                        tabIndex={0}
                        onKeyDown={disabled ? undefined : handleKeyDown}
                        onKeyUp={disabled ? undefined : handleKeyUp}
                    />
                )}
            </div>
        );
    };

    // Dark 16:9 stage for the idle / connecting / failed / reconnecting states.
    const renderStage = (children: React.ReactNode) => (
        <div className="relative flex aspect-video max-h-full w-full items-center justify-center overflow-hidden bg-[#0a0d18] shadow-[inset_0_2px_4px_0_rgb(0_0_0/0.05)]">
            {children}
        </div>
    );

    // Fills the stage in both dimensions; the video fits inside via object-contain
    // (see renderVideoStream), so the picture scales to whichever dimension binds.
    const streamFrame = (children: React.ReactNode) => (
        <div className="flex w-full flex-1 min-h-0 items-center justify-center">{children}</div>
    );

    // Render stream content based on connection state
    const renderStreamContent = () => {
        if (connectionState === 'idle') {
            return streamFrame(
                renderStage(
                    <div className="relative z-[3] text-center text-[#D1D5DB]">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z" />
                        </svg>
                        <span className="text-lg font-medium">Click Start Stream to begin</span>
                    </div>
                )
            );
        }

        if (connectionState === 'connecting') {
            return streamFrame(
                renderStage(
                    <div className="relative z-[3] text-center text-[#D1D5DB]">
                        <div className="w-8 h-8 mx-auto mb-3 border-2 border-gray-500 border-t-indigo-400 rounded-full animate-spin" />
                        <span className="text-lg font-medium">Connecting...</span>
                    </div>
                )
            );
        }

        if (connectionState === 'connected') {
            return streamFrame(renderVideoStream(true));
        }

        if (connectionState === 'reconnecting') {
            return streamFrame(
                hasReceivedFrame && videoRef ? (
                    <div className="relative h-full w-full">
                        {renderVideoStream(false)}
                        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-black/60">
                            <div className="text-center text-[#D1D5DB]">
                                <div className="w-8 h-8 mx-auto mb-3 border-2 border-gray-500 border-t-indigo-400 rounded-full animate-spin" />
                                <span className="text-lg font-medium">Reconnecting...</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    renderStage(
                        <div className="relative z-[3] text-center text-[#D1D5DB]">
                            <div className="w-8 h-8 mx-auto mb-3 border-2 border-gray-500 border-t-indigo-400 rounded-full animate-spin" />
                            <span className="text-lg font-medium">Reconnecting...</span>
                        </div>
                    )
                )
            );
        }

        if (connectionState === 'failed') {
            return streamFrame(
                renderStage(
                    <div className="relative z-[3] text-center text-[#D1D5DB]">
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
                )
            );
        }

        return null;
    };

    // Phase 20-06 + Phase 21-06: D-01 mutex — at most one of fileManagerNode /
    // assistantPanelNode / scenariosPanelNode is non-null at any time (enforced
    // upstream by rightPaneActive in useFileManagerState). Pick whichever is
    // present so the Splitter's right slot renders the active panel.
    const rightNode = fileManagerNode ?? assistantPanelNode ?? scenariosPanelNode;

    // Manual mode never shows the video stream — render its controls and bail.
    if (activeMode === 'manual') {
        return (
            <div className="flex-1 min-h-0 flex flex-col items-center p-2 overflow-auto bg-[#F3F4F6]">
                <ManualControls disabled={disabled} addAction={addAction} results={terminalResults}
                                processes={processes} processesLoading={processesLoading}
                                requestListProcesses={requestListProcesses} killProcess={killProcess}
                                permissions={permissions}/>
            </div>
        );
    }

    // Interactive mode: ALWAYS render the stream through the Splitter, whether or
    // not a panel is open. Toggling a panel only adds/removes the Splitter's
    // right pane; the left pane (and the live <video> inside it) keeps a stable
    // position in the tree, so React never remounts the video element. Remounting
    // it would drop the painted frame and black out the stream until the next
    // frame arrives — and the desktop sends no frames while the screen is static.
    const showPanel = !!rightNode;

    return (
        <div className="flex-1 min-h-0 bg-background flex flex-col">
            <Splitter
                initialRatio={splitRatio ?? 0.5}
                onRatioChange={setSplitRatio ?? (() => {})}
                left={
                    <div
                        className={
                            showPanel
                                ? 'h-full w-full flex items-stretch justify-center bg-[#0a0d18] p-2 overflow-auto'
                                : 'h-full w-full flex flex-col items-center justify-center overflow-hidden bg-[#0a0d18] p-2'
                        }
                    >
                        {renderStreamContent()}
                    </div>
                }
                right={showPanel ? <div className="h-full w-full">{rightNode}</div> : null}
            />
        </div>
    );
};
