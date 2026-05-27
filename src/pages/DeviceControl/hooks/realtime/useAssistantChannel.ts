import { useCallback, useEffect } from "react";
import { useOrderedBroadcast } from "./useOrderedBroadcast";

const ASSISTANT_IDENTIFIER = JSON.stringify({ channel: "AssistantChannel" });

/**
 * Inner broadcast envelope shape per Phase 18 STREAM-03 / STREAM-04 and Phase 20 D-11.
 *
 * Phase 20 frontend consumes these seven shapes (six wire types plus a synthesized
 * `connection_lost` error). Unknown / forward-compat broadcast types are ignored
 * silently by the reducer (STREAM-03 forward-compat).
 */
export type AssistantBroadcast =
  | { type: "token"; seq: number; session_token: string; content: string }
  | {
      type: "tool_call_start";
      seq: number;
      session_token: string;
      tool_call_id: string;
      name: string;
      label: string;
      args: object;
      cwd?: string;
    }
  | {
      type: "tool_call_result";
      seq: number;
      session_token: string;
      tool_call_id: string;
      result: {
        stdout?: string;
        stderr?: string;
        exit?: number;
        elapsed_seconds?: number;
        error?: string;
      };
    }
  | {
      type: "requires_confirmation";
      seq: number;
      session_token: string;
      confirmation_id: string;
      tool_call_id: string;
      label: string;
      command: string;
      args: unknown[];
      cwd?: string;
      reason: string;
      zone: "deny_list" | "outside_list";
    }
  | {
      type: "quota_warning";
      seq: number;
      session_token: string;
      percent: number;
    }
  | {
      type: "done";
      seq: number;
      session_token: string;
      stop_reason: string;
      message?: string;
    }
  | {
      type: "error";
      seq: number;
      session_token: string;
      source: string;
      message?: string;
    };

export type AssistantDispatchAction =
  | "run_prompt"
  | "stop_loop"
  | "confirm_tool_call";

export interface UseAssistantChannelReturn {
  dispatch: (action: AssistantDispatchAction, data?: object) => void;
}

interface AssistantCableEnvelope {
  identifier?: string;
  type?: string;
  message?: unknown;
}

interface UseAssistantChannelOptions {
  socket: WebSocket | null;
  onBroadcast: (msg: AssistantBroadcast) => void;
}

/**
 * Subscribe to the Rails AssistantChannel over the existing raw WebSocket
 * (the same socket that DeviceControl already opens for CommandChannel).
 *
 * Options-object signature per D-11. Composes useOrderedBroadcast for the
 * seq-reorder buffer per D-12 (resetMarker "accepted", no seqless error
 * passthrough).
 *
 * Wire-format invariants (Phase 18 STREAM-02..04, D-11):
 *  - `seq` is monotonically increasing per session; gaps are reordered with a
 *    500ms gap-close timeout. After the timeout fires (and the socket is still
 *    open) the hook synthesizes `{type:'error', source:'stream_out_of_order'}`
 *    so the reducer can leave streaming state.
 *  - `session_token` discriminates streams; v1 leaves filtering to the reducer
 *    (20-07) which scopes rendering per session. The hook delivers all session
 *    tokens unchanged.
 *  - WebSocket close while broadcasts are still in flight synthesizes
 *    `{type:'error', source:'connection_lost'}` so the reducer can transition
 *    to the error state without waiting for the backend's STREAM-06
 *    ensure-block terminator (VERIFY-04).
 *  - On socket close any pending gap-close timer is cleared so it never fires
 *    post-teardown — keeping the VERIFY-04 invariant that the synthesized
 *    `connection_lost` error is delivered within 5s of socket close.
 */
export function useAssistantChannel(
  { socket, onBroadcast }: UseAssistantChannelOptions,
): UseAssistantChannelReturn {
  // Shared seq-ordered reorder buffer (D-12). resetMarker "accepted" resets
  // the buffer between assistant runs. AssistantChannel gap-close error has NO
  // `message` field (ScenarioRunChannel includes one — a twin difference).
  const { bufferRef, expectedSeqRef, gapTimerRef, closedRef, flushInOrder, reset } =
    useOrderedBroadcast<AssistantBroadcast>({
      onBroadcast,
      resetMarker: "accepted",
      allowSeqlessError: false,
      makeGapCloseError: (seq) => ({
        type: "error",
        seq,
        session_token: "",
        source: "stream_out_of_order",
      }),
      makeConnectionLostError: (seq) => ({
        type: "error",
        seq,
        session_token: "",
        source: "connection_lost",
      }),
    });

  // Channel lifecycle effect: subscribe on mount (or on socket open if the
  // socket is still CONNECTING at mount), unsubscribe on unmount.
  //
  // The CONNECTING→OPEN transition does NOT change the WebSocket object
  // reference, so a dependency on `socket` alone would let the subscribe slip
  // through whenever AssistantPanel mounts before the parent's socket is open.
  // We attach an `open` listener as a wake-up to catch that case.
  useEffect(() => {
    if (!socket) return;
    if (
      socket.readyState === WebSocket.CLOSING ||
      socket.readyState === WebSocket.CLOSED
    )
      return;

    closedRef.current = false;
    bufferRef.current = new Map();
    // Backend AgentRunner uses post-increment seq starting from `@seq = 0`,
    // so the first broadcast emitted carries `seq: 1`. The reorder buffer
    // MUST start at 1, not 0, or the very first chunk gets buffered forever
    // waiting for a non-existent seq=0 and the panel never renders anything.
    expectedSeqRef.current = 1;
    let subscribed = false;

    const sendSubscribe = (): void => {
      if (subscribed) return;
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          command: "subscribe",
          identifier: ASSISTANT_IDENTIFIER,
        }),
      );
      subscribed = true;
    };

    const onOpen = (): void => sendSubscribe();

    const onMessage = (event: MessageEvent): void => {
      let data: AssistantCableEnvelope;
      try {
        data = JSON.parse(event.data as string) as AssistantCableEnvelope;
      } catch {
        return; // not JSON; ignore
      }
      if (data.identifier !== ASSISTANT_IDENTIFIER) return;
      if (
        data.type === "confirm_subscription" ||
        data.type === "reject_subscription"
      )
        return;
      if (data.type === "ping" || data.type === "welcome") return;

      const inner = data.message;
      if (!inner || typeof inner !== "object") return;
      const broadcast = inner as AssistantBroadcast;

      // Per-run reorder-buffer reset. Backend AgentRunner allocates a fresh
      // seq counter per run (starts at 0, post-increments — first broadcast
      // is seq=1). Without resetting between runs, expectedSeqRef stays at
      // the previous run's tail, so the new run's seq 1..N get buffered
      // forever waiting for a seq that never arrives. AssistantChannel emits
      // `accepted` (transmit, seqless) before any seq broadcasts of a new
      // run — use it as the reset marker.
      if ((broadcast as { type?: string }).type === "accepted") {
        reset();
      }

      if (typeof (broadcast as { seq?: unknown }).seq === "number") {
        bufferRef.current.set((broadcast as { seq: number }).seq, broadcast);
        flushInOrder();
      } else {
        // No seq → bypass reorder buffer. Production envelopes always carry
        // seq; this branch only fires for malformed traffic.
        try {
          onBroadcast(broadcast);
        } catch (err) {
          console.warn(
            "useAssistantChannel: onBroadcast threw on seqless event",
            err,
          );
        }
      }
    };

    const onClose = (): void => {
      closedRef.current = true;
      // Clear any pending gap-close timer so it does not fire post-teardown.
      if (gapTimerRef.current !== null) {
        window.clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
      // Synthesize a connection_lost error so the reducer can leave streaming.
      // VERIFY-04: React reaches error state within 5s of socket close.
      const errorEvent: AssistantBroadcast = {
        type: "error",
        seq: expectedSeqRef.current,
        session_token: "",
        source: "connection_lost",
      };
      try {
        onBroadcast(errorEvent);
      } catch (err) {
        console.warn("useAssistantChannel: onBroadcast threw on close", err);
      }
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);

    // Already open at mount → subscribe immediately. Otherwise the `open`
    // listener handles it when the CONNECTING socket transitions.
    sendSubscribe();

    return () => {
      try {
        if (subscribed && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              command: "unsubscribe",
              identifier: ASSISTANT_IDENTIFIER,
            }),
          );
        }
      } catch {
        // swallow — socket may already be closing
      }
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
      if (gapTimerRef.current !== null) {
        window.clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
    };
  }, [socket, flushInOrder, reset, onBroadcast, bufferRef, closedRef, expectedSeqRef, gapTimerRef]);

  const dispatch = useCallback(
    (action: AssistantDispatchAction, data: object = {}) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          command: "message",
          identifier: ASSISTANT_IDENTIFIER,
          data: JSON.stringify({ action, ...data }),
        }),
      );
    },
    [socket],
  );

  return { dispatch };
}
