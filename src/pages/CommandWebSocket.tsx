import { useEffect, useRef, useState } from "react";
import { getAccessToken, getRefreshToken, saveTokens } from "src/utils/auth.ts";
import axios from "axios";

type Message = {
    from: string;
    command: string;
    payload: Record<string, any>;
};

interface Props {
    wsUrl: string;
}

export function CommandWebSocket({ wsUrl }: Props) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isHandlingAuthReconnect = useRef(false); // Flag to prevent reconnect race conditions
    const [messages, setMessages] = useState<Message[]>([]);
    const [connected, setConnected] = useState(false);
    const [deviceId, setDeviceId] = useState("");
    const [isConnecting, setIsConnecting] = useState(false);

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

    // --- Update: accept optional deviceId param so we can auto-connect with URL param ---
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

        // use idToUse when building the ws URL
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
                    isHandlingAuthReconnect.current = true; // Set flag
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
            console.log(event);
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
            // Error will likely be followed by onclose, which handles reconnect
        };
    };

    // --- Reconnect logic ---
    const handleReconnection = async () => {
        console.log("Attempting WebSocket reconnection (auth)...");
        isHandlingAuthReconnect.current = true; // Mark that we are handling an auth failure

        const newToken = await refreshAccessToken();
        if (newToken) {
            connectWebSocket(); // This will connect with the new token
        } else {
            console.error("Unable to refresh token, user may need to re-login.");
            isHandlingAuthReconnect.current = false; // Failed, clear flag
            setIsConnecting(false); // Ensure UI is not stuck
        }
    };

    // --- Cleanup on unmount ---
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

    // --- New: on mount, read device_id query param and auto-fill + connect ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const paramDeviceId = params.get("device_id");
        if (paramDeviceId) {
            setDeviceId(paramDeviceId);
            // start connecting immediately with the provided id
            connectWebSocket(paramDeviceId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Send message to channel ---
    const sendCommand = (command: string, payload?: Record<string, any>) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.warn("Cannot send command, WebSocket is not open.");
            return;
        }

        wsRef.current.send(
            JSON.stringify({
                command: "message",
                identifier: JSON.stringify({ channel: "CommandChannel" }),
                data: JSON.stringify({ command, payload }),
            })
        );
    };

    return (
        <div>
            <h2>WebSocket</h2>
            <p>Status: {connected ? "Connected" : isConnecting ? "Connecting..." : "Disconnected"}</p>

            <label>
                Device ID:{" "}
                <input
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="Enter device ID"
                    disabled={connected || isConnecting}
                />
            </label>
            <button
                onClick={() => connectWebSocket()}
                disabled={!deviceId || connected || isConnecting}
            >
                Connect
            </button>

            <button
                onClick={() => sendCommand("ping", { msg: "hello desktop" })}
                disabled={!connected}
            >
                Send Ping
            </button>

            <h3>Messages:</h3>
            <ul>
                {messages.map((m, i) => (
                    <li key={i}>
                        <strong>{m.from}</strong>: {m.command} - {JSON.stringify(m.payload)}
                    </li>
                ))}
            </ul>
        </div>
    );
}