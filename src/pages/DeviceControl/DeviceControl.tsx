import React, {useState, useEffect, useRef} from "react";
import {uuidv4} from "src/utils/uuid.ts";
import {Sidebar} from "src/pages/DeviceControl/Sidebar.tsx";
import {MainContent} from "src/pages/DeviceControl/MainContent.tsx";
import {getAccessToken, getRefreshToken, saveTokens} from "src/utils/auth.ts";
import {refreshTokenRequest} from "src/services/backend/authRequests.ts";
import type {AccordionSection, Mode, FrameBatch, FrameRegion} from "src/pages/DeviceControl/types.ts";

interface CommandWebSocketProps {
    wsUrl: string;
}

interface InnerMessage {
    id?: string;
    command?: string;
    payload?: Record<string, unknown> & { regions?: Array<{ image: string; isFull?: boolean; x?: number; y?: number; width?: number; height?: number }> };
    status?: string;
    result?: string | number | boolean | null | Record<string, unknown> | Array<unknown>;
}

export function DeviceControl({wsUrl}: CommandWebSocketProps) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isHandlingAuthReconnect = useRef(false);
    const lastDeviceIdRef = useRef<string | null>(null);
    const pendingCommandsRef = useRef<Map<string, string>>(new Map());

    const [connected, setConnected] = useState(false);
    const [deviceId, setDeviceId] = useState("");

    const [activeMode, setActiveMode] = useState<Mode>("interactive");
    const [openAccordion, setOpenAccordion] = useState<AccordionSection | null>(null);

    const [frames, setFrames] = useState<FrameBatch[]>([]);
    const [terminalResults, setTerminalResults] = useState<{ id: string; status: string; result: string }[]>([]);
    const [processes, setProcesses] = useState<{ Pid: number; Name: string; MemoryMB?: number; CpuTime?: string; StartTime?: string }[]>([]);
    const [processesLoading, setProcessesLoading] = useState(false);

    const refreshAccessToken = async (): Promise<string | null> => {
        try {
            const refreshToken = getRefreshToken();
            if (!refreshToken) {
                console.warn("No refresh token available");
                return null;
            }
            const res = await refreshTokenRequest();
            const tokens = res.data ?? {};
            const newAccess = tokens.access_token
            const newRefresh = tokens.refresh_token
            if (newAccess) {
                saveTokens(newAccess, newRefresh ?? null);
            }
            return newAccess ?? null;
        } catch (err) {
            console.error("Token refresh failed", err);
            return null;
        }
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

                        if (cmd === "screen.frame_batch") {
                            const regionsRaw = Array.isArray(payload.regions) ? payload.regions : [];
                            if (regionsRaw.length) {
                                const regions: FrameRegion[] = regionsRaw.map((r) => ({
                                    image: r.image,
                                    isFull: !!r.isFull,
                                    x: Number(r.x) || 0,
                                    y: Number(r.y) || 0,
                                    width: Number(r.width) || 0,
                                    height: Number(r.height) || 0,
                                }));
                                const batch: FrameBatch = {id: uuidv4(), regions};
                                setFrames((prev) => {
                                    const next = [...prev, batch];
                                    return next.slice(-60);
                                });
                            }
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
        const params = new URLSearchParams(window.location.search);
        const paramDeviceId = params.get("device_id");
        if (paramDeviceId) {
            setDeviceId(paramDeviceId);
            lastDeviceIdRef.current = paramDeviceId;
            connectWebSocket(paramDeviceId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const sendSingleAction = (action: { id?: string; type: string; payload?: Record<string, unknown> }) => {
        const msg = {
            id: action.id ?? uuidv4(),
            command: action.type,
            payload: action.payload ?? {},
        };
        // track pending by id to map responses to original command
        pendingCommandsRef.current.set(msg.id, msg.command);
        // keep map from growing unbounded: trim occasionally
        if (pendingCommandsRef.current.size > 200) {
            const firstKey = pendingCommandsRef.current.keys().next().value as string | undefined;
            if (firstKey) pendingCommandsRef.current.delete(firstKey);
        }
        sendMessagePayload(msg);
    };

    const requestListProcesses = () => {
        if (!connected) return;
        setProcessesLoading(true);
        setProcesses([]);
        sendSingleAction({ type: 'terminal.listProcesses' });
    };

    const killProcess = (pid: number) => {
        if (!connected || !pid) return;
        // optimistic remove
        setProcesses(prev => prev.filter(p => p.Pid !== pid));
        sendSingleAction({ type: 'terminal.killProcess', payload: { pid } });
    };

    return (
        <div className="command-websocket flex h-screen w-full font-sans antialiased bg-[#F3F4F6]">
            <Sidebar
                activeMode={activeMode}
                setActiveMode={setActiveMode}
                openAccordion={openAccordion}
                setOpenAccordion={setOpenAccordion}
                addAction={sendSingleAction}
            />
            <main className="flex-1 ml-64">
                <MainContent
                    disabled={!connected}
                    addAction={sendSingleAction}
                    frames={frames}
                    activeMode={activeMode}
                    terminalResults={terminalResults}
                    processes={processes}
                    processesLoading={processesLoading}
                    requestListProcesses={requestListProcesses}
                    killProcess={killProcess}
                />
            </main>
        </div>
    );
}
