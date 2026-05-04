import { useState, useEffect, useRef, useCallback } from 'react';
import { generateUUID } from 'src/utils/uuid';
import { Sidebar } from 'src/pages/DeviceControl/Sidebar';
import { MainContent } from 'src/pages/DeviceControl/MainContent';
import { getAccessToken, getUserId } from 'src/utils/auth';
import { refreshAccessTokenOnce } from 'src/services/backend/config';
import { useToast } from 'src/components/ui';
import type { AccordionSection, Mode, CommandAction } from 'src/pages/DeviceControl/types';
import { getMyDeviceSharesForDeviceRequest } from 'src/services/backend/deviceSharesRequests';
import { getDeviceRequest } from 'src/services/backend/devicesRequests';
import type { DeviceShare } from 'src/types/global';
import { useWebRtc } from './hooks/useWebRtc';
import { useStreamStats } from './hooks/useStreamStats';
import { useFilesChannel } from './hooks/useFilesChannel';
import { useFileManagerState } from './hooks/useFileManagerState';
import { useTransferQueue } from './hooks/useTransferQueue';
import { FileManagerPanel } from './components/FileManager/FileManagerPanel';
import {
    TransferQueue,
    createRunUpload,
    createRunDownload,
} from './services/transfer';
import type { DownloadTransfer } from './services/transfer';

interface CommandWebSocketProps {
    wsUrl: string;
}

interface InnerMessage {
    id?: string;
    command?: string;
    payload?: Record<string, unknown>;
    status?: string;
    result?: string | number | boolean | null | Record<string, unknown> | Array<unknown>;
}

// Derived permissions interface for easier gating
interface DevicePermissions {
    see_screen: boolean;
    see_system_info: boolean;
    access_mouse: boolean;
    access_keyboard: boolean;
    access_terminal: boolean;
    manage_power: boolean;
    // convenience compound flags
    any_input: boolean; // mouse or keyboard
    any_screen: boolean; // currently same as see_screen
}

export function DeviceControl({wsUrl}: CommandWebSocketProps) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isHandlingAuthReconnect = useRef(false);
    const lastDeviceIdRef = useRef<string | null>(null);
    const pendingCommandsRef = useRef<Map<string, string>>(new Map());

    const [connected, setConnected] = useState(false);
    const [deviceId, setDeviceId] = useState("");
    const [deviceName, setDeviceName] = useState<string>("");

    const [activeMode, setActiveMode] = useState<Mode>("interactive");
    const [openAccordion, setOpenAccordion] = useState<AccordionSection | null>(null);

    const [terminalResults, setTerminalResults] = useState<{ id: string; status: string; result: string }[]>([]);
    const [processes, setProcesses] = useState<{ Pid: number; Name: string; MemoryMB?: number; CpuTime?: string; StartTime?: string }[]>([]);
    const [processesLoading, setProcessesLoading] = useState(false);

    // stream stats and FPS state
    const [showStats, setShowStats] = useState(false);
    const [currentFps, setCurrentFps] = useState(24);
    const [currentResolution, setCurrentResolution] = useState(1080);

    // permissions state
    const [permissionsLoading, setPermissionsLoading] = useState(false);
    const [permissions, setPermissions] = useState<DevicePermissions | null>(null);
    const [isOwner, setIsOwner] = useState<boolean>(false);
    const toast = useToast();

    const buildPermissions = (share: DeviceShare | null): DevicePermissions => {
        const pg = share?.permissions_group;
        const ownDefaults: DevicePermissions = {
            see_screen: true,
            see_system_info: true,
            access_mouse: true,
            access_keyboard: true,
            access_terminal: true,
            manage_power: true,
            any_input: true,
            any_screen: true,
        };
        if (!pg) return ownDefaults;
        return {
            see_screen: !!pg.see_screen,
            see_system_info: !!pg.see_system_info,
            access_mouse: !!pg.access_mouse,
            access_keyboard: !!pg.access_keyboard,
            access_terminal: !!pg.access_terminal,
            manage_power: !!pg.manage_power,
            any_input: !!pg.access_mouse || !!pg.access_keyboard,
            any_screen: !!pg.see_screen,
        };
    };

    const fetchPermissions = async (devId: string, ownerOverride: boolean) => {
        if (!devId) return;
        setPermissionsLoading(true);
        try {
            if (ownerOverride) {
                setPermissions(buildPermissions(null)); // full access
                return;
            }
            const res = await getMyDeviceSharesForDeviceRequest(devId);
            const share = res.data.items && res.data.items.length ? res.data.items[0] : null;
            setPermissions(buildPermissions(share));
        } catch (e) {
            console.warn('Failed to load device permissions', e);
            setPermissions(buildPermissions(null));
        } finally {
            setPermissionsLoading(false);
        }
    };

    const refreshAccessToken = async (): Promise<string | null> => {
        return refreshAccessTokenOnce();
    };

    const connectWebSocket = async (deviceIdParam?: string | null) => {
        const idToUse = (deviceIdParam ?? lastDeviceIdRef.current ?? deviceId) || "";

        // Persist last known device id for future reconnects
        lastDeviceIdRef.current = idToUse;

        if (wsRef.current && wsRef.current.readyState < 2) {
            console.warn("WebSocket connection already in progress.");
            return;
        }

        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = null;
        }

        const token = getAccessToken();
        if (!token) {
            console.error("No valid token available for WebSocket connection");
            return;
        }

        const urlWithToken = `${wsUrl}?access_token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(idToUse)}`;
        const ws = new WebSocket(urlWithToken);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            setConnected(true);
            isHandlingAuthReconnect.current = false;

            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }

            ws.send(
                JSON.stringify({
                    command: "subscribe",
                    identifier: JSON.stringify({channel: "CommandChannel"}),
                })
            );
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === "ping") {
                    return;
                }

                if (data.type === "reject_subscription") {
                    console.warn("WebSocket subscription rejected, refreshing token...");
                    isHandlingAuthReconnect.current = true;
                    handleReconnection();
                    return;
                }

                if (data.type === "disconnect" && data.reason === "unauthorized") {
                    console.warn("WebSocket 'unauthorized' message received, refreshing token...");
                    isHandlingAuthReconnect.current = true;
                    handleReconnection();
                    return;
                }

                const stringifyResult = (val: unknown): string => {
                    try {
                        if (val === null || val === undefined) return String(val);
                        if (typeof val === 'string') return val;
                        if (typeof val === 'object') return JSON.stringify(val, null, 2);
                        return String(val);
                    } catch {
                        try {
                            return String(val);
                        } catch {
                            return '';
                        }
                    }
                };

                const handleInnerMessage = (inner: unknown) => {
                    try {
                        if (!inner || typeof inner !== 'object') return;
                        const msg = inner as InnerMessage;
                        const cmd = msg.command;
                        const payload = msg.payload ?? {};
                        const originalCmd = msg.id ? pendingCommandsRef.current.get(msg.id) : undefined;

                        // WebRTC signaling
                        if (cmd === 'webrtc.answer' || cmd === 'webrtc.ice_candidate') {
                            handleSignalingMessage(cmd, payload);
                            return;
                        }

                        // streaming terminal output chunks
                        if (cmd === 'terminal.output') {
                            const chunk = (payload as Record<string, unknown>).data as string;
                            const sessionId = (payload as Record<string, unknown>).sessionId as string;
                            const stream = (payload as Record<string, unknown>).stream as string || 'stdout';
                            if (chunk) {
                                setTerminalResults(prev => {
                                    const next = [...prev, {id: sessionId || 'stream', status: stream, result: chunk}];
                                    return next.slice(-100);
                                });
                            }
                            return;
                        }

                        // terminal & misc results
                        if (msg.status && msg.id && Object.prototype.hasOwnProperty.call(msg, 'result')) {
                            const resultStr = stringifyResult(msg.result);
                            setTerminalResults(prev => {
                                const next = [...prev, {id: msg.id as string, status: msg.status as string, result: resultStr}];
                                return next.slice(-100);
                            });
                            // detect processes list by original command id mapping
                            const isProc = (r: unknown): r is { Pid: number; Name: string; MemoryMB?: number; CpuTime?: string; StartTime?: string } => {
                                return !!r && typeof r === 'object' && 'Pid' in (r as Record<string, unknown>) && 'Name' in (r as Record<string, unknown>);
                            };
                            if (originalCmd === 'terminal.listProcesses') {
                                if (Array.isArray(msg.result)) {
                                    const proc = msg.result.filter(isProc);
                                    setProcesses(proc);
                                } else {
                                    setProcesses([]);
                                }
                                setProcessesLoading(false);
                                // cleanup mapping for this id
                                pendingCommandsRef.current.delete(msg.id);
                            }
                        }
                    } catch (e) {
                        console.warn("Failed to process inner message", e);
                    }
                };

                // ActionCable-style direct message envelope
                if (data && typeof data.message === 'object' && data.message !== null) {
                    handleInnerMessage(data.message);
                    return;
                }

                // ActionCable-style wrapper where our payload is inside `data` string
                if (data.command === "message" && typeof data.data === "string") {
                    try {
                        const inner = JSON.parse(data.data);
                        handleInnerMessage(inner);
                    } catch (e) {
                        console.warn("Failed parsing inner data for message", e);
                    }
                    return;
                }
            } catch (err) {
                console.error("Failed to parse WS message:", err);
            }
        };

        ws.onclose = async (event) => {
            console.log("WebSocket closed", event.code, event.reason);
            setConnected(false);

            if (isHandlingAuthReconnect.current) {
                console.log("Auth reconnect in progress, skipping default onclose logic.");
                return;
            }

            if (event.code === 4001 || (event.reason || "").includes("unauthorized")) {
                console.warn("WebSocket closed due to auth, attempting token refresh...");
                await handleReconnection();
                return;
            }

            if (!reconnectTimeout.current) {
                console.log("Scheduling reconnect in 3s...");
                reconnectTimeout.current = setTimeout(() => {
                    reconnectTimeout.current = null;
                    connectWebSocket();
                }, 3000);
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket error", err);
        };
    };

    const handleReconnection = async () => {
        console.log("Attempting WebSocket reconnection (auth)...");
        isHandlingAuthReconnect.current = true;

        if (wsRef.current && wsRef.current.readyState < 2) {
            wsRef.current.close(4001, "Reauth - closing old socket");
        }

        const newToken = await refreshAccessToken();
        if (newToken) {
            connectWebSocket(lastDeviceIdRef.current ?? deviceId);
        } else {
            console.error("Unable to refresh token, user may need to re-login.");
            isHandlingAuthReconnect.current = false;
        }
    };

    useEffect(() => {
        return () => {
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
            }
            if (wsRef.current) {
                wsRef.current.close(1000, "Component unmounting");
                wsRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        const init = async () => {
            const params = new URLSearchParams(window.location.search);
            const paramDeviceId = params.get("device_id");
            if (!paramDeviceId) return;
            setDeviceId(paramDeviceId);
            lastDeviceIdRef.current = paramDeviceId;
            // Determine ownership first
            try {
                const deviceRes = await getDeviceRequest(paramDeviceId);
                const deviceUserId = deviceRes.data?.user?.id;
                const currentUserId = getUserId();
                const owner = deviceUserId && currentUserId && String(deviceUserId) === String(currentUserId);
                setIsOwner(!!owner);
                if (deviceRes.data?.name) setDeviceName(deviceRes.data.name);
                await fetchPermissions(paramDeviceId, !!owner);
            } catch (e) {
                console.warn('Failed to fetch device info for ownership', e);
                // fallback assume not owner but grant full to avoid lockout
                setIsOwner(false);
                await fetchPermissions(paramDeviceId, false);
            }
            // Connect after permissions resolved
            connectWebSocket(paramDeviceId);
        };
        void init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // gating logic for outgoing commands based on permissions
    const canSend = (type: string): boolean => {
        if (!permissions) return false; // still loading
        if (isOwner) return true; // owners bypass all restrictions
        if (type.startsWith('screen.')) return permissions.see_screen;
        if (type.startsWith('mouse.')) return permissions.access_mouse;
        if (type.startsWith('keyboard.')) return permissions.access_keyboard;
        if (type.startsWith('terminal.')) return permissions.access_terminal;
        if (type.startsWith('power.')) return permissions.manage_power;
        return true;
    };

    const sendMessagePayload = (payloadObj: unknown) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("Cannot send message, WebSocket is not open.");
            return;
        }

        wsRef.current.send(
            JSON.stringify({
                command: "message",
                identifier: JSON.stringify({channel: "CommandChannel"}),
                data: JSON.stringify(payloadObj),
            })
        );
    };

    const sendWebRtcSignal = useCallback((command: string, payload: Record<string, unknown>) => {
        sendMessagePayload({ command, payload });
    }, []);

    const { videoRef, setVideoNode, pcRef, startWebRtc, stopWebRtc, retryWebRtc, handleSignalingMessage, connectionState, hasReceivedFrame, desktopStats, filesClientRef, filesDataRef, filesDataChannelRef } = useWebRtc({ sendMessage: sendWebRtcSignal });
    const streamStats = useStreamStats(pcRef, showStats && connectionState === 'connected', desktopStats);

    // File manager panel (Phase 10) -- Plan 11-04 threads filesDataRef so the
    // upload runner has a live ref to the binary channel; Plan 11-05 also
    // threads filesDataChannelRef so the download runner can reach the chunk
    // router wrapper (registerDownload / unregisterDownload).
    const filesChannel = useFilesChannel(filesClientRef, connectionState, filesDataRef, filesDataChannelRef);
    const {
        state: fmState,
        setPanelOpen: fmSetPanelOpen,
        setSplitRatio: fmSetSplitRatio,
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

    const sendSingleAction = (action: { id?: string; type: string; payload?: Record<string, unknown> }) => {
        if (!canSend(action.type)) {
            console.warn(`Blocked command '${action.type}' due to insufficient permissions`);
            return;
        }
        const msg: Record<string, unknown> = {
            command: action.type,
            payload: action.payload ?? {},
        };
        if (action.id) {
            msg.id = action.id;
            pendingCommandsRef.current.set(action.id, action.type);
            if (pendingCommandsRef.current.size > 200) {
                const firstKey = pendingCommandsRef.current.keys().next().value as string | undefined;
                if (firstKey) pendingCommandsRef.current.delete(firstKey);
            }
        }
        sendMessagePayload(msg);
    };

    const handleFpsChange = (fps: number) => {
        setCurrentFps(fps);
        sendSingleAction({ id: generateUUID(), type: 'webrtc.set_fps', payload: { fps } });
    };

    const handleResolutionChange = (resolution: number) => {
        setCurrentResolution(resolution);
        sendSingleAction({ id: generateUUID(), type: 'webrtc.set_resolution', payload: { resolution } });
    };

    const requestListProcesses = () => {
        if (!connected) return;
        if (!permissions?.access_terminal) return; // gate
        setProcessesLoading(true);
        setProcesses([]);
        sendSingleAction({ type: 'terminal.listProcesses' });
    };

    const killProcess = (pid: number) => {
        if (!connected || !pid) return;
        if (!permissions?.access_terminal) return; // gate
        setProcesses(prev => prev.filter(p => p.Pid !== pid));
        sendSingleAction({ type: 'terminal.killProcess', payload: { pid } });
    };

    const overallDisabled = !connected || permissionsLoading || !permissions;

    // Ctrl+Shift+F toggles the file manager panel. Guard: bail if focus is
    // inside the interactive overlay (which owns its own keyboard capture) or
    // inside any editable element. The overlay is identified by the
    // `.overlay` class (MainContent sets it on the video overlay div).
    const fmSetPanelOpenRef = useRef(fmSetPanelOpen);
    useEffect(() => { fmSetPanelOpenRef.current = fmSetPanelOpen; }, [fmSetPanelOpen]);
    const fmPanelOpenRef = useRef(fmState.panelOpen);
    useEffect(() => { fmPanelOpenRef.current = fmState.panelOpen; }, [fmState.panelOpen]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const isTargetShortcut =
                (e.ctrlKey || e.metaKey) &&
                e.shiftKey &&
                (e.key === 'F' || e.key === 'f');
            if (!isTargetShortcut) return;

            // Guard: don't hijack when focus is inside the interactive overlay
            // or any editable element.
            const active = document.activeElement as HTMLElement | null;
            if (active) {
                const tag = active.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                if (active.isContentEditable) return;
                if (active.closest('.overlay')) return;
            }
            const target = e.target as HTMLElement | null;
            if (target && target.closest && target.closest('.overlay')) return;

            e.preventDefault();
            fmSetPanelOpenRef.current(!fmPanelOpenRef.current);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    const fileManagerNode = fmState.panelOpen ? (
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

    return (
        <div className="command-websocket flex h-screen w-full font-sans antialiased bg-[#F3F4F6]">
            <Sidebar
                activeMode={activeMode}
                setActiveMode={setActiveMode}
                openAccordion={openAccordion}
                setOpenAccordion={setOpenAccordion}
                addAction={sendSingleAction}
                permissions={permissions || undefined}
                disabled={overallDisabled}
                deviceName={deviceName}
                onStartStream={startWebRtc}
                onStopStream={stopWebRtc}
                connectionState={connectionState}
                showStats={showStats}
                onToggleStats={() => setShowStats(s => !s)}
                currentFps={currentFps}
                onFpsChange={handleFpsChange}
                currentResolution={currentResolution}
                onResolutionChange={handleResolutionChange}
                onTogglePanel={() => fmSetPanelOpen(!fmState.panelOpen)}
                panelOpen={fmState.panelOpen}
                transferSnapshot={transferSnapshot}
                onOpenPanel={() => fmSetPanelOpen(true)}
            />
            <main className={`flex-1 ml-64 ${activeMode === 'interactive' ? 'overflow-hidden' : ''}`}>
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
                    panelOpen={fmState.panelOpen}
                    fileManagerNode={fileManagerNode}
                    splitRatio={fmState.splitRatio}
                    setSplitRatio={fmSetSplitRatio}
                />
            </main>
        </div>
    );
}
