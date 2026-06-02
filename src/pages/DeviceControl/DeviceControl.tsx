import { useState, useEffect, useRef, useCallback } from "react";
import { generateUUID } from "src/utils/uuid";
import TopBar from "./components/Layout/TopBar";
import MainContent from "./components/Layout/MainContent";
import { useGate } from "src/hooks/useGate";
import UpgradeModal from "src/components/ui/UpgradeModal";
import { getUserId } from "src/utils/auth";
import { useToast } from "src/components/ui";
import type { Mode } from "src/pages/DeviceControl/types";
import { devicesService } from "src/services/backend/devicesService";
import { usePermissions } from "./hooks/state/usePermissions";
import { useTerminalSession } from "./hooks/state/useTerminalSession";
import { useStreamControls } from "./hooks/state/useStreamControls";
import { useCableConsumer } from "./hooks/realtime/useCableConsumer";
import { useDeviceSocket } from "./hooks/realtime/useDeviceSocket";
import { useWebRtc } from "./hooks/realtime/useWebRtc";
import { useStreamStats } from "./hooks/realtime/useStreamStats";
import { useFilesChannel } from "./hooks/realtime/useFilesChannel";
import { useClipboardSync } from "./hooks/realtime/useClipboardSync";
import { useClipboardCapability } from "./hooks/useClipboardCapability";
import { useRefusalToastThrottle } from "./hooks/useRefusalToastThrottle";
import { useTranslation } from "react-i18next";
import { useFileManagerState } from "./hooks/state/useFileManagerState";
import { useTransferQueue } from "./hooks/state/useTransferQueue";
import FileManagerPanel from "./components/FileManager/FileManagerPanel";
import AssistantPanel from "./components/Assistant/AssistantPanel";
import ScenariosPanel from "./components/Scenarios/ScenariosPanel";
import { TransferQueue } from "./services/transfer/TransferQueue";
import { createRunUpload } from "./services/transfer/runUpload";
import { createRunDownload } from "./services/transfer/runDownload";
import type { DownloadTransfer } from "./services/transfer/DownloadTransfer";

interface CommandWebSocketProps {
  wsUrl: string;
}

function DeviceControl({ wsUrl }: CommandWebSocketProps) {
  // Orchestrator-level identity state (3 remaining useState after Wave C)
  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState<string>("");
  const [activeMode, setActiveMode] = useState<Mode>("interactive");

  // Feature state sub-hooks (Wave B)
  const terminalSession = useTerminalSession();
  const {
    terminalResults,
    processes,
    processesLoading,
    appendTerminalResult,
    setProcesses,
    setProcessesLoading,
  } = terminalSession;

  // stream stats and FPS state
  const {
    showStats,
    setShowStats,
    scalingMode,
    setScalingMode,
    currentFps,
    setCurrentFps,
    currentResolution,
    setCurrentResolution,
  } = useStreamControls();

  const aiGate = useGate("ai_access");
  const aiGateRef = useRef(aiGate);
  useEffect(() => {
    aiGateRef.current = aiGate;
  }); // sync every render so the stable keydown closure always reads current gate state
  const [showAiUpgradeModal, setShowAiUpgradeModal] = useState(false);

  const {
    permissions,
    permissionsLoading,
    setIsOwner,
    fetchPermissions,
    canSend,
  } = usePermissions();
  const toast = useToast();

  // Stale-closure ref for handleSignalingMessage: useDeviceSocket must be called
  // before useWebRtc (because useWebRtc depends on webRtcSend from deviceSocket),
  // but handleSignalingMessage comes from useWebRtc. A ref bridges the ordering:
  // onSignaling reads from the ref; the ref is updated after useWebRtc resolves.
  const handleSignalingRef = useRef<
    ((command: string, payload: Record<string, unknown>) => void) | null
  >(null);

  // Wave C: socket hook — the lynchpin extraction (D-04/D-05/D-06/D-07)
  const { consumer } = useCableConsumer(wsUrl, deviceId);
  const deviceSocket = useDeviceSocket(consumer, {
    onSignaling: useCallback(
      (command: string, payload: Record<string, unknown>) => {
        handleSignalingRef.current?.(command, payload);
      },
      [],
    ),
    onTerminalOutput: useCallback(
      (chunk: string, sessionId: string, stream: string) => {
        appendTerminalResult({
          id: sessionId,
          status: stream,
          result: chunk,
        });
      },
      [appendTerminalResult],
    ),
    onCommandResult: useCallback(
      (id: string, status: string, result: string) => {
        appendTerminalResult({ id, status, result });
      },
      [appendTerminalResult],
    ),
    onProcessList: useCallback(
      (procs: import("./hooks/state/useTerminalSession").ProcessInfo[], id: string) => {
        setProcesses(procs);
        setProcessesLoading(false);
        void id; // id is used by the dispatcher to delete from pendingCommandsRef
      },
      [setProcesses, setProcessesLoading],
    ),
  });

  const { connected } = deviceSocket;

  // Stable sendMessage wrapper for useWebRtc (Landmine 4 — sendMessage from
  // useDeviceSocket is already stable/memoized; wrap in useCallback so the
  // webRtcSend identity also stays stable across renders).
  // Destructure sendMessage so the useCallback dep is a direct ref rather than
  // a property-access expression. sendMessage is stable (useMemo — Landmine 4).
  const { sendMessage: socketSendMessage } = deviceSocket;
  const webRtcSend = useCallback(
    (command: string, payload: Record<string, unknown>) => {
      socketSendMessage(command, payload);
    },
    [socketSendMessage],
  );

  const {
    videoRef,
    setVideoNode,
    pcRef,
    startWebRtc,
    stopWebRtc,
    retryWebRtc,
    handleSignalingMessage,
    connectionState,
    hasReceivedFrame,
    desktopStats,
    filesClientRef,
    filesDataRef,
    filesDataChannelRef,
    filesCtlOpen,
    clipboardCtlRef,
    clipboardOriginIdRef,
    clipboardLoopGate,
    lastRemoteApplyTimeRef,
    clipboardCtlOpen,
  } = useWebRtc({ sendMessage: webRtcSend });

  // Update the signaling ref so the onSignaling callback (above) always calls
  // the latest handleSignalingMessage from useWebRtc without needing to change
  // the useDeviceSocket options object reference.
  handleSignalingRef.current = handleSignalingMessage;

  const streamStats = useStreamStats(
    pcRef,
    showStats && connectionState === "connected",
    desktopStats,
  );

  // File manager panel (Phase 10) -- Plan 11-04 threads filesDataRef so the
  // upload runner has a live ref to the binary channel; Plan 11-05 also
  // threads filesDataChannelRef so the download runner can reach the chunk
  // router wrapper (registerDownload / unregisterDownload).
  const filesChannel = useFilesChannel(
    filesClientRef,
    connectionState,
    filesDataRef,
    filesDataChannelRef,
    filesCtlOpen,
  );

  // Phase 14: clipboard sync hook. Lives at DeviceControl mount level so isPaused
  // survives WebRTC reconnects within this session (POLICY-05). Phase 16 will mount
  // the pill UI and wire togglePause to it; Phase 14 leaves the return value unused
  // by the JSX (the hook still binds focus/visibility listeners + inbound subscription).
  // Phase 15 CAP-01 / D-18: detect browser-side clipboard capabilities so
  // useClipboardSync can advertise them to the desktop on every channel open.
  const clipboardCaps = useClipboardCapability();
  const clipboardSync = useClipboardSync({
    pcRef,
    connectionState,
    clipboardCtlRef,
    clipboardOriginIdRef,
    loopGate: clipboardLoopGate,
    lastRemoteApplyTimeRef,
    clipboardCtlOpen,
    caps: clipboardCaps,
  });
  // Phase 16: consume useClipboardSync outputs to drive the pill, the first-sync
  // banner, and refusal toasts.
  const {
    isPaused: clipboardIsPaused,
    togglePause: clipboardTogglePause,
    status: clipboardStatus,
    lastSyncAt: clipboardLastSyncAt,
    cachedDesktopCaps: clipboardCachedDesktopCaps,
    lastRefusal: clipboardLastRefusal,
  } = clipboardSync;

  const fireRefusalToast = useRefusalToastThrottle();
  const { t: tClipboard } = useTranslation("clipboard");

  // PILL-06 / D-13: fire a single info toast on the first successful sync of
  // each browser session per device. sessionStorage namespace mirrors Phase
  // 10's per-device-id convention. The literal lives in clipboard:toast.firstSync
  // (en/clipboard.ts, em dash U+2014) — never hardcoded here per Pitfall 1.
  useEffect(() => {
    if (clipboardLastSyncAt == null || clipboardLastSyncAt === 0) return;
    if (!deviceId) return;
    const key = `recontrol.clipboard.firstSyncToasted.${deviceId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage may throw in private browsing / strict modes — fail
      // closed (skip the toast rather than spam on every sync).
      return;
    }
    toast.info(tClipboard("toast.firstSync"));
  }, [clipboardLastSyncAt, deviceId, toast, tClipboard]);

  // PILL-07 / D-12: throttle refusal toasts at most one per 2 seconds per
  // reason category. useRefusalToastThrottle internally suppresses
  // CAPS_UNKNOWN (RESEARCH OQ 2).
  useEffect(() => {
    if (!clipboardLastRefusal) return;
    fireRefusalToast(clipboardLastRefusal.reason);
  }, [clipboardLastRefusal, fireRefusalToast]);

  const {
    state: fmState,
    setSplitRatio: fmSetSplitRatio,
    setRightPaneActive: fmSetRightPaneActive,
    setCurrentPath: fmSetCurrentPath,
    setSort: fmSetSort,
    setShowHidden: fmSetShowHidden,
  } = useFileManagerState(deviceId);

  const filesByItemIdRef = useRef<Map<string, File>>(new Map());
  const activeDownloadRef = useRef<DownloadTransfer | null>(null);
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const channelRequestRef = useRef(filesChannel.request);
  useEffect(() => {
    channelRequestRef.current = filesChannel.request;
  }, [filesChannel.request]);

  const filesClientLiveRef = useRef(filesChannel.filesClient);
  useEffect(() => {
    filesClientLiveRef.current = filesChannel.filesClient;
  }, [filesChannel.filesClient]);

  const filesDataChannelLiveRef = useRef(filesChannel.filesDataChannel);
  useEffect(() => {
    filesDataChannelLiveRef.current = filesChannel.filesDataChannel;
  }, [filesChannel.filesDataChannel]);

  const transferQueueRef = useRef<TransferQueue | null>(null);
  if (transferQueueRef.current === null) {
    transferQueueRef.current = new TransferQueue(
      createRunUpload({
        filesDataRef,
        getRequest: () => channelRequestRef.current,
        getFile: (id) => filesByItemIdRef.current.get(id) ?? null,
      }),
      createRunDownload({
        getRequest: () => channelRequestRef.current,
        getFilesClient: () => filesClientLiveRef.current,
        getFilesDataChannel: () => filesDataChannelLiveRef.current,
        onSuccess: (name) => toastRef.current.info(`Downloaded ${name}`),
        onActiveChange: (active) => {
          activeDownloadRef.current = active;
        },
      }),
    );
  }
  const transferQueue = transferQueueRef.current!;
  const transferSnapshot = useTransferQueue(transferQueue);

  useEffect(() => {
    return transferQueue.subscribe((snap) => {
      const liveIds = new Set(snap.items.map((i) => i.id));
      for (const id of filesByItemIdRef.current.keys()) {
        if (!liveIds.has(id)) filesByItemIdRef.current.delete(id);
      }
    });
  }, [transferQueue]);

  // Orchestrator startup — device id resolution, ownership check, permissions,
  // and initial socket connect. This init useEffect stays in DeviceControl
  // because it is orchestrator-level startup, not socket lifecycle.
  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const paramDeviceId = params.get("device_id");
      if (!paramDeviceId) return;
      setDeviceId(paramDeviceId);
      // Determine ownership first
      try {
        const device = await devicesService.get(paramDeviceId);
        const deviceUserId = device?.user?.id;
        const currentUserId = getUserId();
        const owner =
          deviceUserId &&
          currentUserId &&
          String(deviceUserId) === String(currentUserId);
        setIsOwner(!!owner);
        if (device?.name) setDeviceName(device.name);
        await fetchPermissions(paramDeviceId, !!owner);
      } catch (e) {
        console.warn("Failed to fetch device info for ownership", e);
        // fallback assume not owner but grant full to avoid lockout
        setIsOwner(false);
        await fetchPermissions(paramDeviceId, false);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // sendSingleAction: thin orchestrator combining permission gating (canSend),
  // pending command registration (registerPendingCommand), and send.
  const sendSingleAction = (action: {
    id?: string;
    type: string;
    payload?: Record<string, unknown>;
  }) => {
    if (!canSend(action.type)) {
      console.warn(
        `Blocked command '${action.type}' due to insufficient permissions`,
      );
      return;
    }
    const msg: Record<string, unknown> = {
      command: action.type,
      payload: action.payload ?? {},
    };
    if (action.id) {
      msg.id = action.id;
      deviceSocket.registerPendingCommand(action.id, action.type);
    }
    deviceSocket.sendMessagePayload(msg);
  };

  const handleFpsChange = (fps: number) => {
    setCurrentFps(fps);
    sendSingleAction({
      id: generateUUID(),
      type: "webrtc.set_fps",
      payload: { fps },
    });
  };

  const handleResolutionChange = (resolution: number) => {
    setCurrentResolution(resolution);
    sendSingleAction({
      id: generateUUID(),
      type: "webrtc.set_resolution",
      payload: { resolution },
    });
  };

  const requestListProcesses = () => {
    if (!connected) return;
    if (!permissions?.access_terminal) return; // gate
    setProcessesLoading(true);
    setProcesses([]);
    sendSingleAction({ type: "terminal.listProcesses" });
  };

  const killProcess = (pid: number) => {
    if (!connected || !pid) return;
    if (!permissions?.access_terminal) return; // gate
    setProcesses((prev) => prev.filter((p) => p.Pid !== pid));
    sendSingleAction({ type: "terminal.killProcess", payload: { pid } });
  };

  const overallDisabled = !connected || permissionsLoading || !permissions;

  // Ctrl+Shift+F toggles the file manager panel; Ctrl+Shift+A toggles the
  // AssistantPanel (Phase 20-06, mirrors the F hotkey). Both share the same
  // focus-guard: bail if focus is inside the interactive overlay (which owns
  // its own keyboard capture) or inside any editable element. The overlay is
  // identified by the `.overlay` class (MainContent sets it on the video
  // overlay div). The two hotkeys live in the same useEffect so they share
  // the listener lifecycle.
  const fmSetRightPaneActiveRef = useRef(fmSetRightPaneActive);
  useEffect(() => {
    fmSetRightPaneActiveRef.current = fmSetRightPaneActive;
  }, [fmSetRightPaneActive]);
  const fmRightPaneActiveRef = useRef(fmState.rightPaneActive);
  useEffect(() => {
    fmRightPaneActiveRef.current = fmState.rightPaneActive;
  }, [fmState.rightPaneActive]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isFilesShortcut =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === "F" || e.key === "f");
      const isAssistantShortcut =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === "A" || e.key === "a");
      // Phase 21 UI-01: Ctrl+Shift+S toggles the Scenarios panel.
      const isScenariosShortcut =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key === "S" || e.key === "s");
      if (!isFilesShortcut && !isAssistantShortcut && !isScenariosShortcut)
        return;

      // Guard: don't hijack when focus is inside the interactive overlay
      // or any editable element.
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (active.isContentEditable) return;
        if (active.closest(".overlay")) return;
      }
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest(".overlay")) return;

      e.preventDefault();
      if (isFilesShortcut) {
        // Mutex setter: opening Files closes Assistant; toggling off
        // when already open clears the right pane.
        const next = fmRightPaneActiveRef.current === "files" ? null : "files";
        fmSetRightPaneActiveRef.current(next);
      } else if (isAssistantShortcut) {
        if (!aiGateRef.current.allowed) {
          setShowAiUpgradeModal(true);
          return;
        }
        const next =
          fmRightPaneActiveRef.current === "assistant" ? null : "assistant";
        fmSetRightPaneActiveRef.current(next);
      } else {
        // Phase 21 UI-01: Scenarios mutex toggle.
        const next =
          fmRightPaneActiveRef.current === "scenarios" ? null : "scenarios";
        fmSetRightPaneActiveRef.current(next);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Phase 20-06: gate FileManager on rightPaneActive='files' so the D-01
  // mutex with AssistantPanel works. `fmState.panelOpen` is kept in sync by
  // useFileManagerState (it tracks rightPaneActive === 'files') for any
  // legacy consumer that still reads the boolean.
  const fileManagerNode =
    fmState.rightPaneActive === "files" ? (
      <FileManagerPanel
        deviceId={deviceId}
        channel={filesChannel}
        state={fmState}
        setCurrentPath={fmSetCurrentPath}
        setSort={fmSetSort}
        setShowHidden={fmSetShowHidden}
        queue={transferQueue}
        filesByItemIdRef={filesByItemIdRef}
        activeDownloadRef={activeDownloadRef}
      />
    ) : null;

  // Phase 20-06: AssistantPanel scaffold rendered when rightPaneActive='assistant'.
  // Reuses the existing raw WebSocket (CommandChannel) for the AssistantChannel
  // subscription per RESEARCH §Pattern 4. deviceName falls back to deviceId
  // when the device record has not loaded yet.
  const assistantPanelNode =
    fmState.rightPaneActive === "assistant" ? (
      <AssistantPanel
        deviceId={deviceId}
        consumer={consumer}
        connected={connected}
        deviceName={deviceName || deviceId}
      />
    ) : null;

  // Phase 21-06: ScenariosPanel scaffold mount. Library + editor land in
  // Plans 21-09 / 21-10; for this plan we render a placeholder so the
  // Splitter's right slot has a non-null node when rightPaneActive='scenarios'.
  const scenariosPanelNode =
    fmState.rightPaneActive === "scenarios" ? (
      <ScenariosPanel
        deviceId={deviceId}
        consumer={consumer}
        connected={connected}
        deviceName={deviceName || deviceId}
      />
    ) : null;

  return (
    <div className="command-websocket flex h-dvh w-full flex-col bg-[#F3F4F6] font-sans antialiased">
      <TopBar
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        addAction={sendSingleAction}
        permissions={permissions || undefined}
        disabled={overallDisabled}
        deviceName={deviceName}
        onStartStream={startWebRtc}
        onStopStream={stopWebRtc}
        connectionState={connectionState}
        showStats={showStats}
        onToggleStats={() => setShowStats(!showStats)}
        scalingMode={scalingMode}
        onToggleScaling={() => setScalingMode(scalingMode === "fit" ? "1:1" : "fit")}
        currentFps={currentFps}
        onFpsChange={handleFpsChange}
        currentResolution={currentResolution}
        onResolutionChange={handleResolutionChange}
        onTogglePanel={() =>
          fmSetRightPaneActive(
            fmState.rightPaneActive === "files" ? null : "files",
          )
        }
        panelOpen={fmState.rightPaneActive === "files"}
        onToggleAiPanel={() => {
          if (!aiGate.allowed) {
            setShowAiUpgradeModal(true);
            return;
          }
          fmSetRightPaneActive(
            fmState.rightPaneActive === "assistant" ? null : "assistant",
          );
        }}
        aiPanelOpen={fmState.rightPaneActive === "assistant"}
        onToggleScenarios={() =>
          fmSetRightPaneActive(
            fmState.rightPaneActive === "scenarios" ? null : "scenarios",
          )
        }
        scenariosPanelOpen={fmState.rightPaneActive === "scenarios"}
        transferSnapshot={transferSnapshot}
        onOpenPanel={() => fmSetRightPaneActive("files")}
        clipboardPill={{
          webRtcUp: connectionState === "connected",
          isPaused: clipboardIsPaused,
          togglePause: clipboardTogglePause,
          status: clipboardStatus,
          cachedDesktopCaps: clipboardCachedDesktopCaps,
          lastRefusal: clipboardLastRefusal,
          lastSyncAt: clipboardLastSyncAt,
          browserCaps: clipboardCaps,
        }}
      />
      {showAiUpgradeModal && (
        <UpgradeModal
          feature="ai_access"
          requiredPlan={aiGate.requiredPlan}
          onClose={() => setShowAiUpgradeModal(false)}
        />
      )}
      <main
        className={`flex min-h-0 flex-1 flex-col ${activeMode === "interactive" ? "overflow-hidden" : ""}`}
      >
        <MainContent
          disabled={overallDisabled}
          addAction={sendSingleAction}
          activeMode={activeMode}
          terminalResults={terminalResults}
          processes={processes}
          processesLoading={processesLoading}
          requestListProcesses={requestListProcesses}
          killProcess={killProcess}
          permissions={permissions || undefined}
          videoRef={videoRef}
          setVideoNode={setVideoNode}
          connectionState={connectionState}
          hasReceivedFrame={hasReceivedFrame}
          retryWebRtc={retryWebRtc}
          streamStats={streamStats}
          showStats={showStats}
          scalingMode={scalingMode}
          panelOpen={fmState.rightPaneActive === "files"}
          fileManagerNode={fileManagerNode}
          assistantPanelNode={assistantPanelNode}
          scenariosPanelNode={scenariosPanelNode}
          splitRatio={fmState.splitRatio}
          setSplitRatio={fmSetSplitRatio}
        />
      </main>
    </div>
  );
}

export default DeviceControl;
