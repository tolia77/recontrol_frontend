import { lazy, Suspense, useState, useEffect, useRef, useCallback, useReducer } from "react";
import { useNavigate } from "react-router";
import { generateUUID } from "src/utils/uuid";
import { frontendLogger } from "src/utils/logger";
import TopBar from "./components/Layout/TopBar";
import MainContent from "./components/Layout/MainContent";
import GestureToolbar from "./components/GestureToolbar/GestureToolbar";
import DeviceControlBottomSheet from "./components/BottomSheet/DeviceControlBottomSheet";
import { useMobileDetect } from "src/hooks/useMobileDetect";
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
import { prefetchIceServers } from "./hooks/realtime/usePeerConnection";
import { useStreamStats } from "./hooks/realtime/useStreamStats";
import { useFilesChannel } from "./hooks/realtime/useFilesChannel";
import { useAssistantChannel } from "./hooks/realtime/useAssistantChannel";
import type { AssistantBroadcast } from "./hooks/realtime/useAssistantChannel";
import {
  initialTranscriptState,
  transcriptReducer,
} from "./components/Assistant/transcriptReducer";
import { useClipboardSync } from "./hooks/realtime/useClipboardSync";
import { useClipboardCapability } from "./hooks/useClipboardCapability";
import { useOrientation } from "./hooks/useOrientation";
import { useRefusalToastThrottle } from "./hooks/useRefusalToastThrottle";
import { useTranslation } from "react-i18next";
import { useFileManagerState } from "./hooks/state/useFileManagerState";
import { useTransferQueue } from "./hooks/state/useTransferQueue";
import FileManagerPanel from "./components/FileManager/FileManagerPanel";
// S-02c: AssistantPanel lazy-loaded — mermaid/streamdown only downloaded when AI panel opens
const AssistantPanel = lazy(() => import("./components/Assistant/AssistantPanel"));
import ScenariosPanel from "./components/Scenarios/ScenariosPanel";
import { TransferQueue } from "./services/transfer/TransferQueue";
import { createRunUpload } from "./services/transfer/runUpload";
import { createRunDownload } from "./services/transfer/runDownload";
import type { DownloadTransfer } from "./services/transfer/DownloadTransfer";

interface CommandWebSocketProps {
  wsUrl: string;
}

function DeviceControl({ wsUrl }: CommandWebSocketProps) {
  const isMobile = useMobileDetect();
  const { isLandscape } = useOrientation();
  const navigate = useNavigate();

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
    appendStreamChunk,
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
        // Merge streamed chunks into one growing transcript per session so the
        // output panel shows the whole readout, not just the last fragment.
        appendStreamChunk(sessionId, stream, chunk);
      },
      [appendStreamChunk],
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

  // Assistant conversation lives at page level, NOT inside AssistantPanel.
  // The panel unmounts on every right-pane switch (D-01 mutex); if the
  // transcript reducer and the AssistantChannel subscription lived there, a
  // pane switch would wipe the visible chat AND tear down the server-side
  // channel instance that owns the conversation history (2026-06-05 design:
  // context lives for the subscription lifetime). Lifting both here scopes
  // the conversation to the device-control session — it clears on leaving
  // the page (CHAT-11), not on opening the file manager.
  const [assistantState, dispatchAssistantTranscript] = useReducer(
    transcriptReducer,
    initialTranscriptState,
  );
  const onAssistantBroadcast = useCallback((msg: AssistantBroadcast): void => {
    dispatchAssistantTranscript({ type: "broadcast", broadcast: msg });
  }, []);
  // On reconnect (after the reactive token-refresh cycle drops and reopens the
  // cable), clear the stale connection_lost banner so the panel stops telling
  // the user to refresh a connection that has already recovered.
  const onAssistantReconnect = useCallback((): void => {
    dispatchAssistantTranscript({ type: "connection_restored" });
  }, []);
  // Gate on ai_access: a null consumer skips the subscription entirely, so
  // AI-less tiers never trigger the guaranteed subscribe→reject round trip.
  const { dispatch: assistantDispatch } = useAssistantChannel({
    consumer: aiGate.allowed ? consumer : null,
    onBroadcast: onAssistantBroadcast,
    onReconnect: onAssistantReconnect,
  });

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
    // DC-RS-01: ref instead of state — stats-channel ticks no longer re-render root
    desktopStatsRef,
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
    desktopStatsRef,
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
  const { t } = useTranslation("deviceControl");
  const { t: tClipboard } = useTranslation("clipboard");
  const { t: tAssistant } = useTranslation("assistant");

  // 80% AI-quota Toast — fires once when the reducer flips the flag (at most
  // once per run; the reducer resets it on submit_prompt). Lives here, not in
  // AssistantPanel: the panel remounts on pane switches, and a panel-local
  // mount ref would re-fire the toast on every reopen while the lifted flag
  // is still true. We only fire on the false→true transition.
  const quotaWarningShownRef = useRef(false);
  useEffect(() => {
    if (assistantState.quotaWarningShown && !quotaWarningShownRef.current) {
      quotaWarningShownRef.current = true;
      toast.warning(
        tAssistant("quota.warningToast", {
          defaultValue: "You've used 80% of today's AI quota.",
        }),
      );
    } else if (!assistantState.quotaWarningShown && quotaWarningShownRef.current) {
      quotaWarningShownRef.current = false;
    }
  }, [assistantState.quotaWarningShown, toast, tAssistant]);

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
      // S-04: prefetch TURN credentials in parallel with device/permissions fetch
      // so the result is cached before the user clicks "Start Stream". The fetch
      // fires here and the result is stored in the module-level cache in
      // usePeerConnection; createPeerConnection() reuses it with no extra request.
      prefetchIceServers();
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

  // REL-12: force a keyframe on orientation change so the decoder recovers
  // immediately instead of waiting for the next natural IDR frame (Phase 36 deferred UAT).
  // prevIsLandscapeRef guards against firing on initial mount and on unrelated re-renders.
  // The ref is updated BEFORE the connected check so a rotation while disconnected
  // does not queue a stale send when connectionState later becomes "connected".
  const prevIsLandscapeRef = useRef(isLandscape);
  useEffect(() => {
    if (prevIsLandscapeRef.current === isLandscape) return;
    prevIsLandscapeRef.current = isLandscape;
    if (connectionState !== "connected") return;
    sendSingleAction({ type: "webrtc.request_keyframe", payload: {} });
  }, [isLandscape, connectionState]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestListProcesses = () => {
    if (!connected) return;
    if (!permissions?.access_terminal) return; // gate
    setProcessesLoading(true);
    setProcesses([]);
    sendSingleAction({ id: generateUUID(), type: "terminal.listProcesses" });
  };

  const killProcess = (pid: number) => {
    if (!connected || !pid) return;
    if (!permissions?.access_terminal) return; // gate
    setProcesses((prev) => prev.filter((p) => p.Pid !== pid));
    sendSingleAction({ type: "terminal.killProcess", payload: { pid } });
  };

  const overallDisabled = !connected || permissionsLoading || !permissions;

  // T-37-WIRE-01: permission gate for mobile typing (access_keyboard → GestureToolbar)
  const canUseKeyboard = !!permissions?.access_keyboard;

  // Tracks whether the Assistant input is focused on mobile — drives sheet forceFullHeight
  const [assistantForceFullHeight, setAssistantForceFullHeight] = useState(false);

  // --- Mobile-specific helpers ---

  /**
   * openPanel: sets rightPaneActive (mutex; one-at-a-time enforced by useFileManagerState).
   * The sheet opens automatically because rightPaneActive !== null → open={true}.
   */
  const openPanel = (p: "files" | "assistant" | "scenarios") => {
    fmSetRightPaneActive(p);
  };

  /**
   * handleDisconnect: mirrors the desktop TopBar disconnect/back behavior.
   * Stops the WebRTC stream then navigates away.
   */
  const handleDisconnect = useCallback(() => {
    stopWebRtc();
    navigate("/devices");
  }, [stopWebRtc, navigate]);

  /**
   * sheetTitle: derived from the currently active panel name (I18N-01).
   */
  const sheetTitle =
    fmState.rightPaneActive === "files"
      ? t("mobile.sheet.filesTitle")
      : fmState.rightPaneActive === "assistant"
        ? t("mobile.sheet.assistantTitle")
        : fmState.rightPaneActive === "scenarios"
          ? t("mobile.sheet.scenariosTitle")
          : "";

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
        isMobile={isMobile}
      />
    ) : null;

  // Phase 20-06: AssistantPanel rendered when rightPaneActive='assistant'.
  // The panel is presentational — transcript state and the AssistantChannel
  // subscription are lifted to this component (see assistantState above) so
  // the conversation survives the panel unmounting on pane switches.
  // deviceName falls back to deviceId when the device record has not loaded.
  // S-02c: AssistantPanel is lazy — Suspense boundary shows nothing while the chunk loads.
  const assistantPanelNode =
    fmState.rightPaneActive === "assistant" ? (
      <Suspense fallback={null}>
        <AssistantPanel
          deviceId={deviceId}
          state={assistantState}
          dispatchTranscript={dispatchAssistantTranscript}
          dispatch={assistantDispatch}
          deviceName={deviceName || deviceId}
          isMobile={isMobile}
          onFullHeightChange={setAssistantForceFullHeight}
        />
      </Suspense>
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

  // Diagnostic log export (phase 42.1, D-07): always-available floating trigger
  // that dumps the frontendLogger ring buffer to a JSONL download. Positioned
  // bottom-left to stay clear of the mobile GestureToolbar FAB cluster (bottom-right).
  const downloadLogsButton = (
    <button
      type="button"
      onClick={() => frontendLogger.download()}
      title="Download diagnostic logs (JSONL)"
      className="fixed bottom-3 left-3 z-40 rounded-md bg-black/60 px-3 py-1.5 text-xs font-medium text-white/90 shadow-lg backdrop-blur transition-colors hover:bg-black/80"
    >
      Download Logs
    </button>
  );

  // UpgradeModal is shared — always rendered regardless of mobile/desktop path (z-50)
  const upgradeModal = showAiUpgradeModal ? (
    <UpgradeModal
      feature="ai_access"
      requiredPlan={aiGate.requiredPlan}
      onClose={() => setShowAiUpgradeModal(false)}
    />
  ) : null;

  // Mobile render path (DCTL-01): full-width stream + GestureToolbar FAB + BottomSheet.
  // CRITICAL: <video> lives only inside MainContent's single stream path; no <video>
  // is added here. Branch strictly on isMobile; no md:/lg:/touch-screen: utilities (S5).
  if (isMobile) {
    return (
      <div className="command-websocket flex h-dvh w-full flex-col bg-[#0a0d18] font-sans antialiased">
        {upgradeModal}
        {downloadLogsButton}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MainContent
            disabled={overallDisabled}
            addAction={sendSingleAction}
            activeMode="interactive"
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
            showStats={false}
            scalingMode="fit"
            panelOpen={false}
            fileManagerNode={fileManagerNode}
            assistantPanelNode={assistantPanelNode}
            scenariosPanelNode={scenariosPanelNode}
            splitRatio={fmState.splitRatio}
            setSplitRatio={fmSetSplitRatio}
            isMobile={true}
            onStartStream={startWebRtc}
          />
        </main>
        {/* FAB cluster — overlays the stream, bottom-right, z-40 (36-UI-SPEC §B) */}
        <GestureToolbar
          addAction={sendSingleAction}
          disabled={overallDisabled}
          rightPaneActive={fmState.rightPaneActive}
          onSelectPanel={openPanel}
          aiAllowed={aiGate.allowed}
          onAiBlocked={() => setShowAiUpgradeModal(true)}
          onDisconnect={handleDisconnect}
          deviceName={deviceName}
          canUseKeyboard={canUseKeyboard}
        />
        {/* Always-mounted sheet — never unmounts (DCTL-02, T-36-08) */}
        <DeviceControlBottomSheet
          open={fmState.rightPaneActive !== null}
          onClose={() => { fmSetRightPaneActive(null); setAssistantForceFullHeight(false); }}
          title={sheetTitle}
          forceFullHeight={assistantForceFullHeight}
        >
          {fileManagerNode ?? assistantPanelNode ?? scenariosPanelNode}
        </DeviceControlBottomSheet>
      </div>
    );
  }

  // Desktop render path — byte-for-byte the prior layout (TopBar + main + MainContent).
  return (
    <div className="command-websocket flex h-dvh w-full flex-col bg-surface-muted font-sans antialiased">
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
      {upgradeModal}
      {downloadLogsButton}
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
