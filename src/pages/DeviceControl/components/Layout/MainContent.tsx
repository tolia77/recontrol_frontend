import { useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { MainContentProps } from "src/pages/DeviceControl/types";
import { computeRealImageCoords } from "src/pages/DeviceControl/utils/coords";
import {
  buttonName,
  pressedButtonsFromMask,
  normalizeWheelToClicks,
  mapButtonToBackend,
} from "src/pages/DeviceControl/utils/mouse";
import { mapToVirtualKey } from "src/pages/DeviceControl/utils/keyboard";
import ManualControls from "src/pages/DeviceControl/components/Manual/ManualControls";
import StreamStatsOverlay from "src/pages/DeviceControl/components/Stream/StreamStatsOverlay";
import Splitter from "src/pages/DeviceControl/components/FileManager/Splitter";
import { useTouchGestures } from "src/pages/DeviceControl/hooks/useTouchGestures";
import { useVirtualCursor } from "src/pages/DeviceControl/hooks/useVirtualCursor";
import VirtualCursorOverlay from "src/pages/DeviceControl/components/GestureEngine/VirtualCursorOverlay";

/**
 * Main Content Area with WebRTC video stream
 */
const MainContent: React.FC<
  MainContentProps & { activeMode: "interactive" | "manual" }
> = ({
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
  scalingMode = "fit",
  fileManagerNode,
  assistantPanelNode,
  scenariosPanelNode,
  splitRatio,
  setSplitRatio,
  isMobile = false,
}) => {
  const { t } = useTranslation("deviceControl");

  // overlay & container refs
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

  // --- Mobile gesture engine (Plans 01/02) ---
  // cursorRef: threaded to both useVirtualCursor (to mutate style.transform) and
  // VirtualCursorOverlay (to attach the DOM ref). No React state — direct DOM writes.
  const cursorRef = useRef<HTMLDivElement | null>(null);

  const cursor = useVirtualCursor({ addAction, disabled });

  // Coordinate accessors for the gesture hook (S2: same wiring as getRealCoordsFromClient)
  const getRect = useCallback(
    () => videoContainerRef.current?.getBoundingClientRect() ?? null,
    [],
  );
  const getIntrinsic = useCallback(() => {
    const v = videoRef?.current;
    return v && v.videoWidth ? { nW: v.videoWidth, nH: v.videoHeight } : null;
  }, [videoRef]);

  const touchHandlers = useTouchGestures({
    addAction,
    disabled,
    getRect,
    getIntrinsic,
    cursor,
  });

  // Wrapped pointer handlers: on top of touchHandlers, synchronously update
  // the cursor DOM element (D-08 direct DOM mutation, no re-render latency).
  // On first touch reveal the cursor (opacity 0 → 1); on each move update transform.
  const mobilePtrDown = useCallback(
    (e: React.PointerEvent<Element>) => {
      touchHandlers.onPointerDown(e);
      // Reveal cursor on first touch
      if (cursorRef.current) {
        cursorRef.current.style.opacity = "1";
      }
    },
    [touchHandlers],
  );

  const mobilePtrMove = useCallback(
    (e: React.PointerEvent<Element>) => {
      touchHandlers.onPointerMove(e);
      // After the hook has accumulated the new position, update the DOM cursor.
      // cursor.getPos() returns the post-accumulate position.
      if (cursorRef.current) {
        const rect = getRect();
        const intrinsic = getIntrinsic();
        if (rect && intrinsic) {
          const pos = cursor.getPos();
          // Convert from intrinsic remote px back to CSS px for the overlay.
          const scale = Math.min(rect.width / intrinsic.nW, rect.height / intrinsic.nH);
          // The video is centered inside videoContainerRef (object-contain).
          const displayW = intrinsic.nW * scale;
          const displayH = intrinsic.nH * scale;
          const offsetX = (rect.width - displayW) / 2;
          const offsetY = (rect.height - displayH) / 2;
          const cssX = offsetX + pos.x * scale;
          const cssY = offsetY + pos.y * scale;
          cursorRef.current.style.transform = `translate(${cssX}px, ${cssY}px) translate(-50%, -50%)`;
        }
      }
    },
    [touchHandlers, cursor, getRect, getIntrinsic],
  );

  const lastCoordsRef = useRef<{ x: number; y: number } | null>(null);
  // Latest pointer position awaiting send, coalesced to one send per animation
  // frame (~60Hz) so fast mouse motion stays smooth without flooding the wire.
  const pendingMoveRef = useRef<{ x: number; y: number } | null>(null);
  const moveRafRef = useRef<number | null>(null);

  const getRealCoordsFromClient = useCallback(
    (clientX: number, clientY: number) => {
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
    },
    [videoRef],
  );

  // Helper: check permission for mouse/keyboard/scroll events
  const hasMouse = !!permissions?.access_mouse;
  const hasKeyboard = !!permissions?.access_keyboard;

  const handlePointerEvent = useCallback(
    (e: React.PointerEvent, name: string) => {
      if (activeMode !== "interactive") return;
      // Disallow pointer actions without mouse permission
      if (!hasMouse) return;
      e.preventDefault?.();
      const coords = getRealCoordsFromClient(e.clientX, e.clientY);
      if (!coords) return;

      const btn = e.button;
      const btnName = buttonName(btn);
      const pressed = pressedButtonsFromMask(e.buttons);

      // Skip logging for pointermove: it fires at the raw event rate (60-120Hz)
      // and console.log at that frequency adds measurable jank.
      if (name !== "pointermove") {
        console.log(`[screen-canvas] ${name}`, {
          button: btn,
          buttonName: btnName,
          pressedButtonsMask: e.buttons,
          pressedButtons: pressed,
          x: Math.round(coords.x),
          y: Math.round(coords.y),
          debug: coords.debug,
        });
      }

      if (typeof addAction === "function" && !disabled) {
        try {
          if (name === "pointerdown") {
            lastCoordsRef.current = {
              x: Math.round(coords.x),
              y: Math.round(coords.y),
            };
            addAction({
              type: "mouse.down",
              payload: { Button: mapButtonToBackend(btn) },
            });
          } else if (name === "pointerup") {
            addAction({
              type: "mouse.up",
              payload: { Button: mapButtonToBackend(btn) },
            });
            lastCoordsRef.current = null;
          } else if (name === "pointermove") {
            const curX = Math.round(coords.x);
            const curY = Math.round(coords.y);
            lastCoordsRef.current = { x: curX, y: curY };
            pendingMoveRef.current = { x: curX, y: curY };
            if (moveRafRef.current == null) {
              moveRafRef.current = requestAnimationFrame(() => {
                moveRafRef.current = null;
                const p = pendingMoveRef.current;
                pendingMoveRef.current = null;
                if (p && typeof addAction === "function" && !disabled) {
                  addAction({
                    type: "mouse.move",
                    payload: { X: p.x, Y: p.y },
                  });
                }
              });
            }
          }
        } catch (err) {
          console.warn("Failed to send mouse action", err);
        }
      }
    },
    [activeMode, getRealCoordsFromClient, addAction, disabled, hasMouse],
  );

  useEffect(
    () => () => {
      if (moveRafRef.current != null) cancelAnimationFrame(moveRafRef.current);
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (activeMode !== "interactive") return;
      // Disallow keyboard without permission
      if (!hasKeyboard) return;
      e.preventDefault();
      const vk = mapToVirtualKey(e);
      console.log("[keyboard] keyDown", { key: e.key, code: e.code, vk });
      if (typeof addAction === "function" && !disabled && vk) {
        addAction({ type: "keyboard.keyDown", payload: { Key: vk } });
      }
    },
    [activeMode, addAction, disabled, hasKeyboard],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent) => {
      if (activeMode !== "interactive") return;
      if (!hasKeyboard) return;
      e.preventDefault();
      const vk = mapToVirtualKey(e);
      console.log("[keyboard] keyUp", { key: e.key, code: e.code, vk });
      if (typeof addAction === "function" && !disabled && vk) {
        addAction({ type: "keyboard.keyUp", payload: { Key: vk } });
      }
    },
    [activeMode, addAction, disabled, hasKeyboard],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeMode !== "interactive") return;
      if (!hasMouse) return;
      e.preventDefault();
      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch (err) {
        console.warn(err);
      }
      overlayRef.current?.focus();
      handlePointerEvent(e, "pointerdown");
    },
    [activeMode, handlePointerEvent, hasMouse],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      handlePointerEvent(e, "pointermove");
    },
    [handlePointerEvent],
  );
  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch (err) {
        console.warn(err);
      }
      handlePointerEvent(e, "pointerup");
    },
    [handlePointerEvent],
  );
  const handlePointerCancel = useCallback(
    (e: React.PointerEvent) => {
      handlePointerEvent(e, "pointercancel");
    },
    [handlePointerEvent],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (activeMode !== "interactive") return;
      if (!hasMouse) return;
      e.preventDefault();
      e.stopPropagation?.();
      const coords = getRealCoordsFromClient(e.clientX, e.clientY);
      if (!coords) return;
      const clicks = normalizeWheelToClicks(e.deltaY, e.deltaMode);
      console.log("[screen-canvas] wheel", {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaMode: e.deltaMode,
        clicks,
        x: Math.round(coords.x),
        y: Math.round(coords.y),
        debug: coords.debug,
      });
      if (typeof addAction === "function" && !disabled && clicks !== 0) {
        try {
          addAction({ type: "mouse.scroll", payload: { Clicks: clicks } });
        } catch (err) {
          console.warn("Failed to send mouse.scroll", err);
        }
      }
    },
    [activeMode, getRealCoordsFromClient, addAction, disabled, hasMouse],
  );

  // Render the video stream with interactive overlay
  const renderVideoStream = (showOverlay: boolean) => {
    // aspectRatio is computed from the live video dimensions, so it is the
    // one value that can't be a static Tailwind utility — it stays inline.
    const aspectRatio =
      videoRef?.current?.videoWidth && videoRef?.current?.videoHeight
        ? `${videoRef.current.videoWidth}/${videoRef.current.videoHeight}`
        : "16/9";
    const pixelPerfect = scalingMode === "1:1";
    return (
      <div
        ref={videoContainerRef}
        className={`relative flex items-center justify-center bg-[#0a0d18] shadow-[inset_0_2px_4px_0_rgb(0_0_0/0.05)] ${pixelPerfect ? "w-full overflow-auto" : "h-full w-full overflow-hidden"}`}
        style={pixelPerfect ? { aspectRatio } : undefined}
      >
        <video
          ref={setVideoNode ?? videoRef}
          autoPlay
          playsInline
          muted
          className={`pointer-events-none z-[1] bg-black ${pixelPerfect ? "static h-auto w-auto object-none" : "absolute inset-0 h-full w-full object-contain"}`}
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
            onContextMenu={(e) => {
              e.preventDefault();
            }}
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
    <div className="flex min-h-0 w-full flex-1 items-center justify-center">
      {children}
    </div>
  );

  // Render stream content based on connection state
  const renderStreamContent = () => {
    if (connectionState === "idle") {
      return streamFrame(
        renderStage(
          <div className="relative z-[3] text-center text-[#D1D5DB]">
            <svg
              className="mx-auto mb-3 h-12 w-12 opacity-40"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25A2.25 2.25 0 0 1 5.25 3h13.5A2.25 2.25 0 0 1 21 5.25Z"
              />
            </svg>
            <span className="text-lg font-medium">{t("stream.idle")}</span>
          </div>,
        ),
      );
    }

    if (connectionState === "connecting") {
      return streamFrame(
        renderStage(
          <div className="relative z-[3] text-center text-[#D1D5DB]">
            <div className="border-darkgray border-t-secondary mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2" />
            <span className="text-lg font-medium">
              {t("stream.connecting")}
            </span>
          </div>,
        ),
      );
    }

    if (connectionState === "connected") {
      return streamFrame(renderVideoStream(true));
    }

    if (connectionState === "reconnecting") {
      return streamFrame(
        hasReceivedFrame && videoRef ? (
          <div className="relative h-full w-full">
            {renderVideoStream(false)}
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-black/60">
              <div className="text-center text-[#D1D5DB]">
                <div className="border-darkgray border-t-secondary mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2" />
                <span className="text-lg font-medium">
                  {t("stream.reconnecting")}
                </span>
              </div>
            </div>
          </div>
        ) : (
          renderStage(
            <div className="relative z-[3] text-center text-[#D1D5DB]">
              <div className="border-darkgray border-t-secondary mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2" />
              <span className="text-lg font-medium">Reconnecting...</span>
            </div>,
          )
        ),
      );
    }

    if (connectionState === "failed") {
      return streamFrame(
        renderStage(
          <div className="relative z-[3] text-center text-[#D1D5DB]">
            <svg
              className="mx-auto mb-3 h-12 w-12 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <span className="mb-4 block text-lg font-medium">
              {t("stream.failed")}
            </span>
            <button
              onClick={retryWebRtc}
              className="bg-secondary rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            >
              {t("stream.retryConnection")}
            </button>
          </div>,
        ),
      );
    }

    return null;
  };

  // Phase 20-06 + Phase 21-06: D-01 mutex — at most one of fileManagerNode /
  // assistantPanelNode / scenariosPanelNode is non-null at any time (enforced
  // upstream by rightPaneActive in useFileManagerState). Pick whichever is
  // present so the Splitter's right slot renders the active panel.
  const rightNode = fileManagerNode ?? assistantPanelNode ?? scenariosPanelNode;

  // Mobile branch (DCTL-01, RESEARCH Pattern 1A):
  // Render the SAME renderStreamContent() output (which contains the ONE <video>
  // node via renderVideoStream) at a stable tree position. The gesture overlay
  // and VirtualCursorOverlay are siblings in the wrapper; the <video> is NEVER
  // duplicated into a second ternary branch.
  // Desktop stats overlay is NOT surfaced on mobile (D-04).
  if (isMobile) {
    return (
      <div className="relative h-full w-full bg-[#0a0d18]">
        {/* Stream content — the single <video> lives here via renderStreamContent */}
        {renderStreamContent()}
        {/* Gesture overlay: absolute inset-0 touch-action:none z-10 (36-UI-SPEC §D) */}
        <div
          className="overlay absolute inset-0 z-10 bg-transparent outline-none"
          style={{ touchAction: "none" }}
          onPointerDown={disabled ? undefined : mobilePtrDown}
          onPointerMove={disabled ? undefined : mobilePtrMove}
          onPointerUp={disabled ? undefined : touchHandlers.onPointerUp}
          onPointerCancel={disabled ? undefined : touchHandlers.onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          tabIndex={-1}
        />
        {/* Virtual cursor overlay — z-20 sibling, positioned by direct DOM mutation */}
        <VirtualCursorOverlay cursorRef={cursorRef} />
      </div>
    );
  }

  // Manual mode never shows the video stream — render its controls and bail.
  if (activeMode === "manual") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center overflow-auto bg-[#F3F4F6] p-2">
        <ManualControls
          disabled={disabled}
          addAction={addAction}
          results={terminalResults}
          processes={processes}
          processesLoading={processesLoading}
          requestListProcesses={requestListProcesses}
          killProcess={killProcess}
          permissions={permissions}
        />
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
    <div className="bg-background flex min-h-0 flex-1 flex-col">
      <Splitter
        initialRatio={splitRatio ?? 0.5}
        onRatioChange={setSplitRatio ?? (() => {})}
        left={
          <div
            className={
              showPanel
                ? "flex h-full w-full items-stretch justify-center overflow-auto bg-[#0a0d18] p-2"
                : "flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#0a0d18] p-2"
            }
          >
            {renderStreamContent()}
          </div>
        }
        right={
          showPanel ? <div className="h-full w-full">{rightNode}</div> : null
        }
      />
    </div>
  );
};

export default MainContent;
