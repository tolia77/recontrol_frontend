import React, { useState, useEffect, useRef } from "react";
import { uuidv4 } from "src/utils/uuid";
import DeviceConnect from "src/components/DeviceConnect";
import ActionsList from "src/components/ActionsList";
import MessagesList from "src/components/MessagesList";
import InteractiveMode from "src/components/InteractiveMode";
import ManualMode from "src/components/ManualMode";
import { getAccessToken, getRefreshToken, saveTokens } from "src/utils/auth.ts";
import axios from "axios";

// Common components
interface Message {
    from: string;
    command: string;
    payload: Record<string, any>;
}

interface CommandWebSocketProps {
    wsUrl: string;
}


export function CommandWebSocket({ wsUrl }: CommandWebSocketProps) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isHandlingAuthReconnect = useRef(false);

    const [messages, setMessages] = useState<Message[]>([]);
    const [connected, setConnected] = useState(false);
    const [deviceId, setDeviceId] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);
    const [mode, setMode] = useState<"interactive" | "manual">("interactive");

    // Actions state
    const [actions, setActions] = useState<any[]>([]);

    const refreshAccessToken = async (): Promise<string | null> => {
        try {
            const refreshToken = getRefreshToken();
            if (!refreshToken) {
                console.warn("No refresh token available");
                return null;
            }

            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/auth/refresh`,
                {},
                { headers: { "Refresh-Token": refreshToken } }
            );

            const tokens = res.data ?? {};
            const newAccess = tokens.access_token;
            const newRefresh = tokens.refresh_token;

            if (newAccess) {
                saveTokens(newAccess, newRefresh ?? null);
            }

            return newAccess;
        } catch (err) {
            console.error("Token refresh failed", err);
            return null;
        }
    };

    const connectWebSocket = async (deviceIdParam?: string) => {
        const idToUse = deviceIdParam ?? deviceId;
        if (!idToUse) {
            console.warn("Cannot connect: deviceId is missing.");
            return;
        }
        if (wsRef.current && wsRef.current.readyState < 2) {
            console.warn("WebSocket connection already in progress.");
            return;
        }

        setIsConnecting(true);

        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = null;
        }

        let token = getAccessToken();
        if (!token) {
            console.log("No access token, attempting refresh before connect...");
            token = await refreshAccessToken();
            if (!token) {
                console.error("No valid token available for WebSocket connection");
                setIsConnecting(false);
                return;
            }
        }

        const urlWithToken = `${wsUrl}?access_token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(idToUse)}`;
        const ws = new WebSocket(urlWithToken);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            setConnected(true);
            setIsConnecting(false);
            isHandlingAuthReconnect.current = false;

            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }

            ws.send(
                JSON.stringify({
                    command: "subscribe",
                    identifier: JSON.stringify({ channel: "CommandChannel" }),
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

                if (data.message) {
                    setMessages((prev) => [...prev, data.message]);
                }
            } catch (err) {
                console.error("Failed to parse WS message:", err);
            }
        };

        ws.onclose = async (event) => {
            console.log("WebSocket closed", event.code, event.reason);
            setConnected(false);
            setIsConnecting(false);

            if (isHandlingAuthReconnect.current) {
                console.log("Auth reconnect in progress, skipping default onclose logic.");
                return;
            }

            if (event.code === 4001 || event.reason.includes("unauthorized")) {
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

        const newToken = await refreshAccessToken();
        if (newToken) {
            connectWebSocket();
        } else {
            console.error("Unable to refresh token, user may need to re-login.");
            isHandlingAuthReconnect.current = false;
            setIsConnecting(false);
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
            connectWebSocket(paramDeviceId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Action handlers
    const addAction = (action: any) => {
        setActions((s) => [...s, action]);
    };

    const removeAction = (idx: number) => setActions((s) => s.filter((_, i) => i !== idx));
    const clearActions = () => setActions([]);

    const sendMessagePayload = (payloadObj: any) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("Cannot send message, WebSocket is not open.");
            return;
        }

        wsRef.current.send(
            JSON.stringify({
                command: "message",
                identifier: JSON.stringify({ channel: "CommandChannel" }),
                data: JSON.stringify(payloadObj),
            })
        );
    };

    const sendSingleAction = (action: any) => {
        const msg = {
            ...(action.id ? { id: action.id } : {}),
            command: action.type,
            payload: action.payload ?? {},
        };
        sendMessagePayload(msg);
    };

    const sendActions = () => {
        if (!actions.length) {
            console.warn("No actions to send.");
            return;
        }
        actions.forEach((a) => {
            try {
                sendSingleAction(a);
            } catch (err) {
                console.error("Failed to send action", a, err);
            }
        });
        setActions([]);
    };

    return (
        <div className="command-websocket">
            <div className="app-header">
                <h2>Remote Control Interface</h2>
                <div className="header-controls">
                    <DeviceConnect
                        deviceId={deviceId}
                        connected={connected}
                        isConnecting={isConnecting}
                    />

                    <div className="mode-selector">
                        <button
                            className={`mode-btn ${mode === "interactive" ? "active" : ""}`}
                            onClick={() => setMode("interactive")}
                        >
                            Interactive Mode
                        </button>
                        <button
                            className={`mode-btn ${mode === "manual" ? "active" : ""}`}
                            onClick={() => setMode("manual")}
                        >
                            Manual Mode
                        </button>
                    </div>
                </div>
            </div>

            <div className="app-content">
                <div className="main-panel">
                    {mode === "interactive" ? (
                        <InteractiveMode disabled={!connected} addAction={addAction} />
                    ) : (
                        <ManualMode disabled={!connected} addAction={addAction} />
                    )}
                </div>

                <div className="side-panel">
                    <ActionsList
                        actions={actions}
                        removeAction={removeAction}
                        clearActions={clearActions}
                        sendActions={sendActions}
                        disabled={!connected}
                    />

                    <MessagesList messages={messages} />
                </div>
            </div>
        </div>
    );
}