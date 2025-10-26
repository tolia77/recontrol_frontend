import React, { useState } from "react";
import { uuidv4 } from "src/utils/uuid";

// Common components
interface Message {
    from: string;
    command: string;
    payload: Record<string, any>;
}

interface Props {
    messages: Message[];
}

export function MessagesList({ messages }: Props) {
    return (
        <div className="messages-container">
            <h3>Messages:</h3>
            <ul className="messages-list">
                {messages.map((m, i) => (
                    <li key={i} className="message-item">
                        <strong className="message-sender">{m.from}</strong>: {m.command} -
                        <pre className="message-payload">{JSON.stringify(m.payload)}</pre>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function DeviceConnect({ deviceId, setDeviceId, connected, isConnecting, onConnect }: {
    deviceId: string;
    setDeviceId: (v: string) => void;
    connected: boolean;
    isConnecting: boolean;
    onConnect: () => void;
}) {
    const disabled = connected || isConnecting;

    return (
        <div className="device-connect">
            <label className="input-label">
                Device ID:
                <input
                    className="small-input"
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="Enter device ID"
                    disabled={disabled}
                />
            </label>
            <button className="btn-primary" onClick={onConnect} disabled={!deviceId || disabled}>
                {isConnecting ? "Connecting..." : "Connect"}
            </button>
        </div>
    );
}

// Interactive Mode Components
export function InteractiveMode({ disabled, addAction }: {
    disabled: boolean;
    addAction: (a: any) => void;
}) {
    const [activeTool, setActiveTool] = useState<string>("select");

    const tools = [
        { id: "select", label: "Select", icon: "🔍" },
        { id: "click", label: "Click", icon: "👆" },
        { id: "type", label: "Type", icon: "⌨️" },
        { id: "drag", label: "Drag", icon: "↔️" },
        { id: "right-click", label: "Right Click", icon: "🖱️" }
    ];

    return (
        <div className="interactive-mode">
            {/* Menu Bar */}
            <div className="menu-bar">
                <div className="menu-section">
                    <span className="menu-title">File</span>
                    <span className="menu-title">Edit</span>
                    <span className="menu-title">View</span>
                    <span className="menu-title">Tools</span>
                </div>
                <div className="menu-section">
                    <span className="status-indicator">
                        Status: {disabled ? "Disconnected" : "Connected"}
                    </span>
                </div>
            </div>

            {/* Toolbar */}
            <div className="toolbar">
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
                        onClick={() => setActiveTool(tool.id)}
                        disabled={disabled}
                    >
                        <span className="tool-icon">{tool.icon}</span>
                        {tool.label}
                    </button>
                ))}
            </div>

            {/* Canvas Area */}
            <div className="canvas-container">
                <div className="canvas-placeholder">
                    <div className="canvas-content">
                        <span className="canvas-text">Interactive Canvas Area (16:9)</span>
                        <span className="canvas-subtext">
                            Selected: {tools.find(t => t.id === activeTool)?.label}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
                <h4>Quick Actions</h4>
                <div className="action-buttons">
                    <button className="btn-secondary" onClick={() => addAction({
                        id: uuidv4(),
                        type: "mouse.click",
                        payload: { button: "Left" }
                    })} disabled={disabled}>
                        Left Click
                    </button>
                    <button className="btn-secondary" onClick={() => addAction({
                        id: uuidv4(),
                        type: "mouse.rightClick",
                        payload: {}
                    })} disabled={disabled}>
                        Right Click
                    </button>
                    <button className="btn-secondary" onClick={() => addAction({
                        id: uuidv4(),
                        type: "keyboard.press",
                        payload: { key: "Enter" }
                    })} disabled={disabled}>
                        Press Enter
                    </button>
                </div>
            </div>
        </div>
    );
}

// Manual Mode Components
export function ManualMode({ disabled, addAction }: {
    disabled: boolean;
    addAction: (a: any) => void;
}) {
    const [activeSection, setActiveSection] = useState<"keyboard" | "mouse" | "terminal">("keyboard");

    // Keyboard state
    const [kbdKey, setKbdKey] = useState("A");
    const [kbdHoldMs, setKbdHoldMs] = useState<number | "">("");

    // Mouse state
    const [mouseDeltaX, setMouseDeltaX] = useState<number>(0);
    const [mouseDeltaY, setMouseDeltaY] = useState<number>(0);
    const [mouseButton, setMouseButton] = useState<"Left" | "Right" | "Middle">("Left");
    const [mouseDelayMs, setMouseDelayMs] = useState<number | "">("");

    // Terminal state
    const [termCommand, setTermCommand] = useState("");
    const [termTimeout, setTermTimeout] = useState<number | "">("");
    const [termPid, setTermPid] = useState<number | "">("");
    const [termFileName, setTermFileName] = useState("");
    const [termArgs, setTermArgs] = useState("");
    const [termRedirectOutput, setTermRedirectOutput] = useState(false);
    const [termPath, setTermPath] = useState("");
    const [termForceKill, setTermForceKill] = useState(false);

    return (
        <div className="manual-mode">
            <div className="mode-header">
                <h3>Manual Action Builder</h3>
                <div className="section-tabs">
                    <button
                        className={`tab-btn ${activeSection === "keyboard" ? "active" : ""}`}
                        onClick={() => setActiveSection("keyboard")}
                    >
                        Keyboard
                    </button>
                    <button
                        className={`tab-btn ${activeSection === "mouse" ? "active" : ""}`}
                        onClick={() => setActiveSection("mouse")}
                    >
                        Mouse
                    </button>
                    <button
                        className={`tab-btn ${activeSection === "terminal" ? "active" : ""}`}
                        onClick={() => setActiveSection("terminal")}
                    >
                        Terminal
                    </button>
                </div>
            </div>

            <div className="section-content">
                {activeSection === "keyboard" && (
                    <div className="keyboard-section">
                        <div className="input-group">
                            <label className="input-label">
                                Key:
                                <input
                                    className="small-input"
                                    value={kbdKey}
                                    onChange={(e) => setKbdKey(e.target.value)}
                                    disabled={disabled}
                                />
                            </label>
                            <label className="input-label">
                                Hold (ms):
                                <input
                                    className="small-input"
                                    type="number"
                                    value={kbdHoldMs}
                                    onChange={(e) => setKbdHoldMs(e.target.value === "" ? "" : Number(e.target.value))}
                                    disabled={disabled}
                                />
                            </label>
                        </div>
                        <div className="action-buttons">
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "keyboard.keyDown",
                                payload: { key: kbdKey }
                            })} disabled={disabled}>
                                Key Down
                            </button>
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "keyboard.keyUp",
                                payload: { key: kbdKey }
                            })} disabled={disabled}>
                                Key Up
                            </button>
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "keyboard.press",
                                payload: {
                                    key: kbdKey,
                                    ...(kbdHoldMs !== "" ? { holdMs: Number(kbdHoldMs) } : {})
                                }
                            })} disabled={disabled}>
                                Press Key
                            </button>
                        </div>
                    </div>
                )}

                {activeSection === "mouse" && (
                    <div className="mouse-section">
                        <div className="input-group">
                            <label className="input-label">
                                Delta X:
                                <input
                                    className="small-input"
                                    type="number"
                                    value={mouseDeltaX}
                                    onChange={(e) => setMouseDeltaX(Number(e.target.value))}
                                    disabled={disabled}
                                />
                            </label>
                            <label className="input-label">
                                Delta Y:
                                <input
                                    className="small-input"
                                    type="number"
                                    value={mouseDeltaY}
                                    onChange={(e) => setMouseDeltaY(Number(e.target.value))}
                                    disabled={disabled}
                                />
                            </label>
                            <label className="input-label">
                                Button:
                                <select
                                    className="small-input"
                                    value={mouseButton}
                                    onChange={(e) => setMouseButton(e.target.value as any)}
                                    disabled={disabled}
                                >
                                    <option>Left</option>
                                    <option>Right</option>
                                    <option>Middle</option>
                                </select>
                            </label>
                            <label className="input-label">
                                Delay (ms):
                                <input
                                    className="small-input"
                                    type="number"
                                    value={mouseDelayMs}
                                    onChange={(e) => setMouseDelayMs(e.target.value === "" ? "" : Number(e.target.value))}
                                    disabled={disabled}
                                />
                            </label>
                        </div>
                        <div className="action-buttons">
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "mouse.move",
                                payload: { deltaX: mouseDeltaX, deltaY: mouseDeltaY }
                            })} disabled={disabled}>
                                Move
                            </button>
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "mouse.click",
                                payload: {
                                    button: mouseButton,
                                    ...(mouseDelayMs !== "" ? { delayMs: Number(mouseDelayMs) } : {})
                                }
                            })} disabled={disabled}>
                                Click
                            </button>
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "mouse.doubleClick",
                                payload: {
                                    ...(mouseDelayMs !== "" ? { delayMs: Number(mouseDelayMs) } : {})
                                }
                            })} disabled={disabled}>
                                Double Click
                            </button>
                            <button className="btn-secondary" onClick={() => addAction({
                                id: uuidv4(),
                                type: "mouse.scroll",
                                payload: { clicks: mouseDeltaY }
                            })} disabled={disabled}>
                                Scroll
                            </button>
                        </div>
                    </div>
                )}

                {activeSection === "terminal" && (
                    <div className="terminal-section">
                        <div className="terminal-subsection">
                            <h4>Command Execution</h4>
                            <div className="input-group">
                                <label className="input-label">
                                    Command:
                                    <input
                                        className="small-input"
                                        value={termCommand}
                                        onChange={(e) => setTermCommand(e.target.value)}
                                        disabled={disabled}
                                    />
                                </label>
                                <label className="input-label">
                                    Timeout (ms):
                                    <input
                                        className="small-input"
                                        type="number"
                                        value={termTimeout}
                                        onChange={(e) => setTermTimeout(e.target.value === "" ? "" : Number(e.target.value))}
                                        disabled={disabled}
                                    />
                                </label>
                            </div>
                            <div className="action-buttons">
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.execute",
                                    payload: {
                                        command: termCommand,
                                        ...(termTimeout !== "" ? { timeout: Number(termTimeout) } : {})
                                    }
                                })} disabled={disabled}>
                                    Execute
                                </button>
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.powershell",
                                    payload: {
                                        command: termCommand,
                                        ...(termTimeout !== "" ? { timeout: Number(termTimeout) } : {})
                                    }
                                })} disabled={disabled}>
                                    PowerShell
                                </button>
                            </div>
                        </div>

                        <div className="terminal-subsection">
                            <h4>Process Management</h4>
                            <div className="input-group">
                                <label className="input-label">
                                    PID:
                                    <input
                                        className="small-input"
                                        type="number"
                                        value={termPid}
                                        onChange={(e) => setTermPid(e.target.value === "" ? "" : Number(e.target.value))}
                                        disabled={disabled}
                                    />
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={termForceKill}
                                        onChange={(e) => setTermForceKill(e.target.checked)}
                                        disabled={disabled}
                                    />
                                    Force Kill
                                </label>
                            </div>
                            <div className="action-buttons">
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.killProcess",
                                    payload: { pid: Number(termPid), force: termForceKill }
                                })} disabled={disabled}>
                                    Kill Process
                                </button>
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.listProcesses",
                                    payload: {}
                                })} disabled={disabled}>
                                    List Processes
                                </button>
                            </div>
                        </div>

                        <div className="terminal-subsection">
                            <h4>System Commands</h4>
                            <div className="input-group">
                                <label className="input-label">
                                    Working Directory:
                                    <input
                                        className="small-input"
                                        value={termPath}
                                        onChange={(e) => setTermPath(e.target.value)}
                                        disabled={disabled}
                                    />
                                </label>
                            </div>
                            <div className="action-buttons">
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.getCwd",
                                    payload: {}
                                })} disabled={disabled}>
                                    Get CWD
                                </button>
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.setCwd",
                                    payload: { path: termPath }
                                })} disabled={disabled}>
                                    Set CWD
                                </button>
                                <button className="btn-secondary" onClick={() => addAction({
                                    id: uuidv4(),
                                    type: "terminal.whoAmI",
                                    payload: {}
                                })} disabled={disabled}>
                                    WhoAmI
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export function ActionsList({ actions, removeAction, clearActions, sendActions, disabled }: {
    actions: any[];
    removeAction: (idx: number) => void;
    clearActions: () => void;
    sendActions: () => void;
    disabled: boolean;
}) {
    return (
        <div className="actions-list">
            <div className="actions-header">
                <h3>Pending Actions ({actions.length})</h3>
                <div className="action-controls">
                    <button className="btn-primary" onClick={sendActions} disabled={disabled || actions.length === 0}>
                        Send Actions
                    </button>
                    <button className="btn-secondary" onClick={clearActions} disabled={actions.length === 0}>
                        Clear All
                    </button>
                </div>
            </div>

            <ol className="actions-items">
                {actions.map((a, i) => (
                    <li key={a.id ?? i} className="action-item">
                        <pre className="action-preview">{JSON.stringify(a, null, 2)}</pre>
                        <button className="btn-secondary" onClick={() => removeAction(i)} disabled={disabled}>
                            Remove
                        </button>
                    </li>
                ))}
            </ol>
        </div>
    );
}

// Main Component
import { useEffect, useRef } from "react";
import { getAccessToken, getRefreshToken, saveTokens } from "src/utils/auth.ts";
import axios from "axios";

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

    // WebSocket and connection logic remains the same...
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
                        setDeviceId={setDeviceId}
                        connected={connected}
                        isConnecting={isConnecting}
                        onConnect={() => connectWebSocket()}
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