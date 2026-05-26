import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAccessToken } from "src/utils/auth";
import { refreshAccessTokenOnce } from "src/services/backend/config";
import type { ProcessInfo } from "../state/useTerminalSession";

/**
 * Decode a JWT access token's `exp` claim and report whether it is already
 * expired or within `skewSeconds` of expiring. Best-effort: malformed tokens
 * are treated as expired so callers refresh rather than connect with a bad
 * token. Access tokens are short-lived (~1 min), so this gate lets the socket
 * refresh proactively before (re)connecting instead of eating a guaranteed
 * unauthorized rejection and retry.
 */
function isAccessTokenExpired(token: string, skewSeconds = 10): boolean {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    if (typeof json.exp !== "number") return true;
    return Date.now() >= (json.exp - skewSeconds) * 1000;
  } catch {
    return true;
  }
}

function stringifyResult(val: unknown): string {
  try {
    if (val === null || val === undefined) return String(val);
    if (typeof val === "string") return val;
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    return String(val);
  } catch {
    try {
      return String(val);
    } catch {
      return "";
    }
  }
}

interface InnerMessage {
  id?: string;
  command?: string;
  payload?: Record<string, unknown>;
  status?: string;
  result?:
    | string
    | number
    | boolean
    | null
    | Record<string, unknown>
    | Array<unknown>;
}

export interface UseDeviceSocketOptions {
  wsUrl: string;
  onSignaling: (command: string, payload: Record<string, unknown>) => void;
  onTerminalOutput: (chunk: string, sessionId: string, stream: string) => void;
  onCommandResult: (id: string, status: string, result: string) => void;
  onProcessList: (procs: ProcessInfo[], id: string) => void;
}

export interface UseDeviceSocketReturn {
  connected: boolean;
  activeSocket: WebSocket | null;
  sendMessage: (command: string, payload: Record<string, unknown>) => void;
  sendMessagePayload: (payloadObj: unknown) => void;
  registerPendingCommand: (id: string, type: string) => void;
  connect: (deviceId?: string | null) => Promise<void>;
}

/**
 * Full WebSocket lifecycle hook for the DeviceControl command channel.
 *
 * Per D-04: owns the ENTIRE WS lifecycle (connect, proactive token-refresh,
 * reconnect/backoff, heartbeat, auth-reconnect path, and the onmessage
 * dispatcher). DeviceControl keeps none of the connection machinery.
 *
 * Per D-05: the single connection-state guard lives in sendMessagePayload;
 * no other branch checks readyState.
 *
 * Per D-06: inbound messages are routed via injected typed callbacks
 * (onSignaling / onTerminalOutput / onCommandResult / onProcessList).
 * This hook is pure transport + dispatch — it owns no feature state.
 *
 * Per D-07: activeSocket is exposed as React state (not just wsRef) so
 * effect-based channel hooks (AssistantChannel, ScenariosChannel) deterministically
 * re-subscribe on every reconnect. The identity-guarded close is preserved verbatim.
 */
export function useDeviceSocket(
  opts: UseDeviceSocketOptions,
): UseDeviceSocketReturn {
  const { wsUrl, onSignaling, onTerminalOutput, onCommandResult, onProcessList } = opts;

  // Stale-closure ref mirrors so the dispatcher always calls the latest callbacks
  const onSignalingRef = useRef(onSignaling);
  useEffect(() => { onSignalingRef.current = onSignaling; }, [onSignaling]);
  const onTerminalOutputRef = useRef(onTerminalOutput);
  useEffect(() => { onTerminalOutputRef.current = onTerminalOutput; }, [onTerminalOutput]);
  const onCommandResultRef = useRef(onCommandResult);
  useEffect(() => { onCommandResultRef.current = onCommandResult; }, [onCommandResult]);
  const onProcessListRef = useRef(onProcessList);
  useEffect(() => { onProcessListRef.current = onProcessList; }, [onProcessList]);

  // Refs — must precede state per the refs-before-state pattern
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHandlingAuthReconnect = useRef(false);
  const lastDeviceIdRef = useRef<string | null>(null);
  // pendingCommandsRef maps command id → original command type so the dispatcher
  // can recognise terminal.listProcesses results (Landmine 2 / D-05 resolution).
  const pendingCommandsRef = useRef<Map<string, string>>(new Map());

  // activeSocket MUST be React state (not just wsRef) so effect-based channel hooks
  // deterministically re-subscribe on reconnect. See D-07.
  const [connected, setConnected] = useState(false);
  const [activeSocket, setActiveSocket] = useState<WebSocket | null>(null);

  // wsUrl ref so connectWebSocket closure always gets the current value
  const wsUrlRef = useRef(wsUrl);
  useEffect(() => { wsUrlRef.current = wsUrl; }, [wsUrl]);

  const refreshAccessToken = async (): Promise<string | null> => {
    return refreshAccessTokenOnce();
  };

  const connectWebSocket = useCallback(async (deviceIdParam?: string | null) => {
    const idToUse =
      (deviceIdParam ?? lastDeviceIdRef.current ?? "") || "";

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

    // Access tokens live ~1 minute, so on a reconnect the stored token is
    // almost always stale. Refresh proactively instead of connecting with an
    // expired token and eating a guaranteed unauthorized rejection + retry.
    let token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      token = await refreshAccessTokenOnce();
    }
    if (!token) {
      console.error("No valid token available for WebSocket connection");
      return;
    }

    const urlWithToken = `${wsUrlRef.current}?access_token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(idToUse)}`;
    const ws = new WebSocket(urlWithToken);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
      // Expose the now-OPEN socket as state so effect-based channel hooks
      // (AssistantChannel / ScenariosChannel) deterministically (re)subscribe
      // on this socket. See the activeSocket declaration for full rationale.
      setActiveSocket(ws);
      isHandlingAuthReconnect.current = false;

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      ws.send(
        JSON.stringify({
          command: "subscribe",
          identifier: JSON.stringify({ channel: "CommandChannel" }),
        }),
      );

      // Backend uses a TTL'd cache entry refreshed by these heartbeats
      // to derive the device's "used" status. Without this, the row
      // would flip back to "active" 45s after page open.
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(
          JSON.stringify({
            command: "message",
            identifier: JSON.stringify({ channel: "CommandChannel" }),
            data: JSON.stringify({ command: "heartbeat" }),
          }),
        );
      }, 15000);
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
          void handleReconnection();
          return;
        }

        if (data.type === "disconnect" && data.reason === "unauthorized") {
          console.warn(
            "WebSocket 'unauthorized' message received, refreshing token...",
          );
          isHandlingAuthReconnect.current = true;
          void handleReconnection();
          return;
        }

        const handleInnerMessage = (inner: unknown) => {
          try {
            if (!inner || typeof inner !== "object") return;
            const msg = inner as InnerMessage;
            const cmd = msg.command;
            const payload = msg.payload ?? {};
            const originalCmd = msg.id
              ? pendingCommandsRef.current.get(msg.id)
              : undefined;

            // WebRTC signaling
            if (cmd === "webrtc.answer" || cmd === "webrtc.ice_candidate") {
              onSignalingRef.current(cmd, payload);
              return;
            }

            // streaming terminal output chunks
            if (cmd === "terminal.output") {
              const chunk = (payload as Record<string, unknown>).data as string;
              const sessionId = (payload as Record<string, unknown>)
                .sessionId as string;
              const stream =
                ((payload as Record<string, unknown>).stream as string) ||
                "stdout";
              if (chunk) {
                onTerminalOutputRef.current(chunk, sessionId || "stream", stream);
              }
              return;
            }

            // terminal & misc results
            if (
              msg.status &&
              msg.id &&
              Object.prototype.hasOwnProperty.call(msg, "result")
            ) {
              const resultStr = stringifyResult(msg.result);
              onCommandResultRef.current(
                msg.id as string,
                msg.status as string,
                resultStr,
              );
              // detect processes list by original command id mapping
              const isProc = (
                r: unknown,
              ): r is ProcessInfo => {
                return (
                  !!r &&
                  typeof r === "object" &&
                  "Pid" in (r as Record<string, unknown>) &&
                  "Name" in (r as Record<string, unknown>)
                );
              };
              if (originalCmd === "terminal.listProcesses") {
                if (Array.isArray(msg.result)) {
                  const proc = msg.result.filter(isProc);
                  onProcessListRef.current(proc, msg.id as string);
                } else {
                  onProcessListRef.current([], msg.id as string);
                }
                // cleanup mapping for this id
                pendingCommandsRef.current.delete(msg.id);
              }
            }
          } catch (e) {
            console.warn("Failed to process inner message", e);
          }
        };

        // ActionCable-style direct message envelope
        if (data && typeof data.message === "object" && data.message !== null) {
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
      // Drop the socket from state so effect-based channel hooks unsubscribe
      // and go idle until the next socket opens. Guard on identity so a late
      // close from a superseded socket cannot clear a newer live one.
      setActiveSocket((prev) => (prev === ws ? null : prev));

      if (isHandlingAuthReconnect.current) {
        console.log(
          "Auth reconnect in progress, skipping default onclose logic.",
        );
        return;
      }

      if (
        event.code === 4001 ||
        (event.reason || "").includes("unauthorized")
      ) {
        console.warn(
          "WebSocket closed due to auth, attempting token refresh...",
        );
        await handleReconnection();
        return;
      }

      if (!reconnectTimeout.current) {
        console.log("Scheduling reconnect in 3s...");
        reconnectTimeout.current = setTimeout(() => {
          reconnectTimeout.current = null;
          void connectWebSocket();
        }, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error", err);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReconnection = async () => {
    console.log("Attempting WebSocket reconnection (auth)...");
    isHandlingAuthReconnect.current = true;

    if (wsRef.current && wsRef.current.readyState < 2) {
      wsRef.current.close(4001, "Reauth - closing old socket");
    }

    const newToken = await refreshAccessToken();
    if (newToken) {
      void connectWebSocket(lastDeviceIdRef.current);
    } else {
      console.error("Unable to refresh token, user may need to re-login.");
      isHandlingAuthReconnect.current = false;
    }
  };

  // Cleanup effect — runs on component unmount only
  useEffect(() => {
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, []);

  // Per D-05: the SINGLE connection-state guard lives here.
  // No other branch in this hook checks readyState.
  const sendMessagePayload = useCallback((payloadObj: unknown) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send message, WebSocket is not open.");
      return;
    }
    wsRef.current.send(
      JSON.stringify({
        command: "message",
        identifier: JSON.stringify({ channel: "CommandChannel" }),
        data: JSON.stringify(payloadObj),
      }),
    );
  }, []);

  // Stable memoized sendMessage wrapper (Landmine 4 — must NOT change reference
  // each render or useWebRtc re-creates its internal callbacks every render).
  const sendMessage = useCallback(
    (command: string, payload: Record<string, unknown>) => {
      sendMessagePayload({ command, payload });
    },
    [sendMessagePayload],
  );

  // registerPendingCommand — exposes the pendingCommandsRef write side so
  // DeviceControl's sendSingleAction can register command ids before sending.
  // Owned here because the dispatcher (above) reads the same map (Landmine 2).
  const registerPendingCommand = useCallback((id: string, type: string) => {
    pendingCommandsRef.current.set(id, type);
    if (pendingCommandsRef.current.size > 200) {
      const firstKey = pendingCommandsRef.current.keys().next().value as
        | string
        | undefined;
      if (firstKey) pendingCommandsRef.current.delete(firstKey);
    }
  }, []);

  return useMemo(
    () => ({
      connected,
      activeSocket,
      sendMessage,
      sendMessagePayload,
      registerPendingCommand,
      connect: connectWebSocket,
    }),
    [
      connected,
      activeSocket,
      sendMessage,
      sendMessagePayload,
      registerPendingCommand,
      connectWebSocket,
    ],
  );
}
