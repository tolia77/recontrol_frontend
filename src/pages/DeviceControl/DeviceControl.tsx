import React, { useState, useEffect, useRef } from "react";
import { uuidv4 } from "src/utils/uuid.ts";
// Imports for old UI (DeviceConnect, ActionsList, MessagesList, InteractiveMode, ManualMode) removed.
// Import new UI components from App.jsx
import { Sidebar, MainContent } from "src/pages/DeviceControl/Interactive.tsx"; // Assuming App.jsx is in the same folder
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

// --- Types from App.jsx (Redefined here) ---
// NOTE: Ideally, these would be exported from App.jsx
type Mode = 'interactive' | 'manual';
type AccordionSection = 'power' | 'terminal' | 'processes';


export function DeviceControl({ wsUrl }: CommandWebSocketProps) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isHandlingAuthReconnect = useRef(false);

    // Removed messages state
    const [connected, setConnected] = useState(false);
    const [deviceId, setDeviceId] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);

    // State for new Sidebar UI
    const [activeMode, setActiveMode] = useState<Mode>("interactive");
    const [openAccordion, setOpenAccordion] = useState<AccordionSection | null>(null);

    // Removed Actions state
    // const [actions, setActions] = useState<any[]>([]);

    // Screen frames and tiles state
    const [frames, setFrames] = useState<{ id: string; image: string }[]>([]);
    const [tiles, setTiles] = useState<any[]>([]);

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
                    // inspect incoming message command for screen images first
                    try {
                        const msg = data.message as Message & any;
                        const cmd = msg.command;
                        const payload = msg.payload ?? {};

                        if (cmd === "screen.frame") {
                            // payload expected to have { image: "<base64 jpg>" }
                            const imgBase64 = payload.image ?? (typeof payload === "string" ? payload : undefined);
                            if (imgBase64) {
                                // store only latest frame to avoid accumulating previous images
                                setFrames([{ id: uuidv4(), image: imgBase64 }]);
                            }
                            // do not add to messages list
                            return;
                        } else if (cmd === "screen.tile") {
                            // payload expected to have { x, y, width, height, image: "<base64 png>" }
                            setTiles((prev) => [...prev, { id: uuidv4(), ...(payload || {}) }]);
                            // do not add to messages list
                            return;
                        }
                    } catch (e) {
                        // non-fatal
                        console.warn("Failed to process screen image message", e);
                    }

                    // Removed setMessages call
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
    // Removed addAction, removeAction, clearActions, and sendActions

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
            // Use uuidv4 if id is not provided, though MainContent should provide one
            id: action.id ?? uuidv4(),
            command: action.type,
            payload: action.payload ?? {},
        };
        sendMessagePayload(msg);
    };

    // New UI rendering
    return (
        <div className="command-websocket flex h-screen w-full font-sans antialiased bg-[#F3F4F6]">
            <Sidebar
                activeMode={activeMode}
                // The setActiveMode prop is still needed by the Sidebar component
                setActiveMode={setActiveMode}
                openAccordion={openAccordion}
                setOpenAccordion={setOpenAccordion}
            />
            {/* Main content area with margin-left to account for the sidebar width */}
            <main className="flex-1 ml-64">
                <MainContent
                    disabled={!connected}
                    // Pass sendSingleAction as the addAction prop
                    addAction={sendSingleAction}
                    frames={frames}
                    tiles={tiles}
                />
            </main>
        </div>
    );
}
