import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProcessInfo } from "src/pages/DeviceControl/hooks/state/useTerminalSession";
import type { CableConsumerLike } from "./useCableConsumer";

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
  result?: string | number | boolean | null | Record<string, unknown> | Array<unknown>;
}

interface CommandSubscription {
  send: (data: object) => void;
  unsubscribe: () => void;
}

export interface UseDeviceSocketCallbacks {
  onSignaling: (command: string, payload: Record<string, unknown>) => void;
  onTerminalOutput: (chunk: string, sessionId: string, stream: string) => void;
  onCommandResult: (id: string, status: string, result: string) => void;
  onProcessList: (procs: ProcessInfo[], id: string) => void;
}

export interface UseDeviceSocketReturn {
  connected: boolean;
  sendMessage: (command: string, payload: Record<string, unknown>) => void;
  sendMessagePayload: (payloadObj: unknown) => void;
  registerPendingCommand: (id: string, type: string) => void;
}

/**
 * Owns the CommandChannel subscription over the shared ActionCable consumer:
 * the inbound message router (signaling / terminal output / command results /
 * process list), the 15s app-level heartbeat (drives the device "used" presence
 * TTL on the backend), and outbound command dispatch. Connection lifecycle and
 * token refresh live in useCableConsumer.
 */
export function useDeviceSocket(
  consumer: CableConsumerLike | null,
  callbacks: UseDeviceSocketCallbacks,
): UseDeviceSocketReturn {
  const { onSignaling, onTerminalOutput, onCommandResult, onProcessList } = callbacks;

  // Stale-closure ref mirrors so the router always calls the latest callbacks
  // without re-subscribing.
  const onSignalingRef = useRef(onSignaling);
  useEffect(() => { onSignalingRef.current = onSignaling; }, [onSignaling]);
  const onTerminalOutputRef = useRef(onTerminalOutput);
  useEffect(() => { onTerminalOutputRef.current = onTerminalOutput; }, [onTerminalOutput]);
  const onCommandResultRef = useRef(onCommandResult);
  useEffect(() => { onCommandResultRef.current = onCommandResult; }, [onCommandResult]);
  const onProcessListRef = useRef(onProcessList);
  useEffect(() => { onProcessListRef.current = onProcessList; }, [onProcessList]);

  const pendingCommandsRef = useRef<Map<string, string>>(new Map());
  const subRef = useRef<CommandSubscription | null>(null);
  const heartbeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const [connected, setConnected] = useState(false);

  const routeMessage = useCallback((inner: unknown) => {
    try {
      if (!inner || typeof inner !== "object") return;
      const msg = inner as InnerMessage;
      const cmd = msg.command;
      const payload = msg.payload ?? {};
      const originalCmd = msg.id ? pendingCommandsRef.current.get(msg.id) : undefined;

      if (cmd === "webrtc.answer" || cmd === "webrtc.ice_candidate") {
        onSignalingRef.current(cmd, payload);
        return;
      }

      if (cmd === "terminal.output") {
        const p = payload as Record<string, unknown>;
        const chunk = p.data as string;
        const sessionId = p.sessionId as string;
        const stream = (p.stream as string) || "stdout";
        if (chunk) onTerminalOutputRef.current(chunk, sessionId || "stream", stream);
        return;
      }

      if (msg.status && msg.id && Object.prototype.hasOwnProperty.call(msg, "result")) {
        const resultStr = stringifyResult(msg.result);
        onCommandResultRef.current(msg.id, msg.status, resultStr);
        const isProc = (r: unknown): r is ProcessInfo =>
          !!r &&
          typeof r === "object" &&
          "Pid" in (r as Record<string, unknown>) &&
          "Name" in (r as Record<string, unknown>);
        if (originalCmd === "terminal.listProcesses") {
          if (Array.isArray(msg.result)) {
            onProcessListRef.current(msg.result.filter(isProc), msg.id);
          } else {
            onProcessListRef.current([], msg.id);
          }
          pendingCommandsRef.current.delete(msg.id);
        }
      }
    } catch (e) {
      console.warn("Failed to process inner message", e);
    }
  }, []);

  useEffect(() => {
    if (!consumer) return;

    const sub = consumer.subscriptions.create(
      { channel: "CommandChannel" },
      {
        connected: () => {
          setConnected(true);
          // App-level heartbeat: backend derives the device "used" status from a
          // TTL'd cache entry refreshed by these. ActionCable's own ping does
          // not trigger it.
          if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = setInterval(() => {
            subRef.current?.send({ command: "heartbeat" });
          }, 15000);
        },
        disconnected: () => {
          setConnected(false);
          if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
          }
        },
        received: (data: unknown) => routeMessage(data),
      },
    ) as CommandSubscription;
    subRef.current = sub;

    return () => {
      sub.unsubscribe();
      subRef.current = null;
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      setConnected(false);
    };
  }, [consumer, routeMessage]);

  const sendMessagePayload = useCallback((payloadObj: unknown) => {
    subRef.current?.send(payloadObj as object);
  }, []);

  const sendMessage = useCallback(
    (command: string, payload: Record<string, unknown>) => {
      subRef.current?.send({ command, payload });
    },
    [],
  );

  const registerPendingCommand = useCallback((id: string, type: string) => {
    pendingCommandsRef.current.set(id, type);
  }, []);

  return useMemo(
    () => ({ connected, sendMessage, sendMessagePayload, registerPendingCommand }),
    [connected, sendMessage, sendMessagePayload, registerPendingCommand],
  );
}
