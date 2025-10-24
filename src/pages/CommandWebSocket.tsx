import { useEffect, useRef, useState } from "react";
import { getAccessToken, getRefreshToken, saveTokens } from "src/services/backend/utils/auth.ts";
import axios from "axios";

type Message = {
    from: string;
    command: string;
    payload: Record<string, any>;
};

type CommandPayload = {
    device_id: string;
    command: string;
    payload?: Record<string, any>;
};

interface Props {
    wsUrl: string; // e.g., ws://localhost:3000/cable
}

export function CommandWebSocket({ wsUrl }: Props) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [connected, setConnected] = useState(false);
    const [deviceId, setDeviceId] = useState("");

    // --- Refresh Access Token ---
    const refreshAccessToken = async (): Promise<string | null> => {
        try {
            const refreshToken = getRefreshToken();
            if (!refreshToken) return null;

            const res = await axios.post(
                `${import.meta.env.VITE_BACKEND_URL}/auth/refresh`,
                {},
                { headers: { "Refresh-Token": refreshToken } }
            );

            const tokens = res.data ?? {};
            const newAccess =
                tokens.access ||
                tokens.access_token ||
                tokens.accessToken ||
                tokens.token;
            const newRefresh =
                tokens.refresh ||
                tokens.refresh_token ||
                tokens.refreshToken;

            if (newAccess) saveTokens(newAccess, newRefresh ?? null);

            return newAccess;
        } catch (err) {
            console.error("Token refresh failed", err);
            return null;
        }
    };

    // --- Open WebSocket connection ---
    const connectWebSocket = async () => {
        let token = getAccessToken();
        if (!token) {
            token = await refreshAccessToken();
            if (!token) {
                console.warn("No valid token available for WebSocket connection");
                return;
            }
        }

        const urlWithToken = `${wsUrl}?access_token=${encodeURIComponent(token)}`;
        const ws = new WebSocket(urlWithToken);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            setConnected(true);
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
                if (data.type === "reject_subscription") {
                    console.warn("WebSocket subscription rejected, refreshing token...");
                    handleReconnection();
                }
                if (data.message) {
                    setMessages((prev) => [...prev, data.message]);
                }
            } catch (err) {
                console.error("Failed to parse WS message:", err);
            }
        };

        ws.onclose = async (event) => {
            console.log("WebSocket closed", event.reason);
            setConnected(false);

            // Unauthorized or expired token triggers refresh
            if (event.code === 4001 || event.reason.includes("unauthorized")) {
                await handleReconnection();
            } else {
                // Attempt normal reconnect after short delay
                if (!reconnectTimeout.current) {
                    reconnectTimeout.current = setTimeout(() => {
                        connectWebSocket();
                        reconnectTimeout.current = null;
                    }, 3000);
                }
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket error", err);
        };
    };

    // --- Reconnect logic ---
    const handleReconnection = async () => {
        console.log("Attempting WebSocket reconnection...");
        const newToken = await refreshAccessToken();
        if (newToken) {
            connectWebSocket();
        } else {
            console.error("Unable to refresh token, user may need to re-login.");
        }
    };

    // --- Init on mount ---
    useEffect(() => {
        connectWebSocket();
        return () => {
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        };
    }, [wsUrl]);

    // --- Send message to channel ---
    const sendCommand = (payload: CommandPayload) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        wsRef.current.send(
            JSON.stringify({
                command: "message",
                identifier: JSON.stringify({ channel: "CommandChannel" }),
                data: JSON.stringify(payload),
            })
        );
    };

    return (
        <div>
            <h2>WebSocket</h2>
            <p>Status: {connected ? "Connected" : "Disconnected"}</p>

            <label>
                Device ID:{" "}
                <input
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="Enter device ID"
                />
            </label>
            <button
                onClick={() =>
                    sendCommand({
                        device_id: deviceId,
                        command: "ping",
                        payload: { msg: "hello desktop" },
                    })
                }
                disabled={!deviceId}
            >
                Send Ping
            </button>

            <h3>Messages:</h3>
            <ul>
                {messages.map((m, i) => (
                    <li key={i}>
                        <strong>{m.from}</strong>: {m.command} -{" "}
                        {JSON.stringify(m.payload)}
                    </li>
                ))}
            </ul>
        </div>
    );
}
