import { useCallback, useEffect } from "react";
import { useOrderedBroadcast } from "./useOrderedBroadcast";

const SCENARIO_RUN_IDENTIFIER = JSON.stringify({
  channel: "ScenarioRunChannel",
});

/**
 * Inner broadcast envelope shape for the ScenarioRunChannel (Phase 22 RUN-08).
 *
 * Reuses three v1.4 envelope types verbatim from `AssistantBroadcast`
 * (`tool_call_start` / `tool_call_result` / `done`) and adds two new types
 * specific to the scenario runner: `run_started` (emitted once per run before
 * any step dispatch) and `scenario_step_skipped` (emitted per step skipped
 * after a halting condition such as previous_step_failed / user_stopped /
 * policy_deny / access_revoked / timeout).
 *
 * `error` envelopes carry an optional `seq` because the single-in-flight
 * rejection transmitted by the backend on `start_run` (when a run is already
 * in-flight on the device) is a `transmit` (not a `broadcast`) and therefore
 * never gets a seq stamped. The hook tolerates the absence and forwards such
 * envelopes straight to the consumer without buffering.
 */
export type ScenarioRunBroadcast =
  | {
      type: "run_started";
      seq: number;
      session_token: string;
      run_id: string;
      scenario_id: string;
      started_at: string;
      step_count: number;
    }
  | {
      type: "scenario_step_skipped";
      seq: number;
      session_token: string;
      run_id: string;
      step_index: number;
      reason:
        | "previous_step_failed"
        | "user_stopped"
        | "policy_deny"
        | "access_revoked"
        | "timeout";
    }
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
      type: "done";
      seq: number;
      session_token: string;
      stop_reason: string;
      failed_step_index?: number;
      reason?: string;
      message?: string;
    }
  | {
      type: "error";
      seq?: number;
      session_token?: string;
      source?: string;
      message: string;
    };

export type ScenarioRunDispatchAction = "start_run" | "stop_run";

export interface UseScenarioRunChannelReturn {
  dispatch: (action: ScenarioRunDispatchAction, data?: object) => void;
}

interface ScenarioRunCableEnvelope {
  identifier?: string;
  type?: string;
  message?: unknown;
}

interface UseScenarioRunChannelOptions {
  socket: WebSocket | null;
  onBroadcast: (msg: ScenarioRunBroadcast) => void;
}

/**
 * Subscribe to the Rails ScenarioRunChannel over the existing raw WebSocket.
 *
 * Options-object signature per D-11. Composes useOrderedBroadcast for the
 * seq-reorder buffer per D-12 (resetMarker "run_started", allowSeqlessError
 * true — seqless error envelopes are forwarded directly before seq-routing).
 *
 * Wire-format invariants (Phase 22; mirror of useAssistantChannel — Pitfall 2
 * and Pitfall 6 from 22-RESEARCH.md):
 *  - `seq` is monotonically increasing per run; gaps are reordered with a
 *    500ms gap-close timeout. After the timeout fires (and the socket is still
 *    open) the hook synthesizes `{type:'error', source:'stream_out_of_order'}`
 *    so the reducer can leave streaming state.
 *  - The runner emits `seq` starting from 1 (post-increment from @seq=0); the
 *    very first broadcast carries `seq: 1`.
 *  - On `run_started` (the per-run marker — emitted before any per-step
 *    envelope), the reorder buffer + expectedSeq are reset so a second run on
 *    the same channel subscription starts fresh.
 *  - `error` envelopes that arrive without a `seq` (single-in-flight rejection
 *    is a `transmit`, not a `broadcast`) bypass the reorder buffer entirely
 *    and are forwarded directly to the consumer.
 *  - WebSocket close while a run is in flight synthesizes
 *    `{type:'error', source:'connection_lost', message:'connection_lost'}` so
 *    the consumer can transition to the error state without waiting for the
 *    backend's ensure-block terminator. (beforeunload tab-close handling is
 *    the consuming component's responsibility — Pitfall 6.)
 */
export function useScenarioRunChannel(
  { socket, onBroadcast }: UseScenarioRunChannelOptions,
): UseScenarioRunChannelReturn {
  // Shared seq-ordered reorder buffer (D-12). resetMarker "run_started" resets
  // the buffer between scenario runs. allowSeqlessError true — seqless `error`
  // envelopes (single-in-flight run_in_progress rejection) forwarded directly.
  // ScenarioRun gap-close / connection_lost errors include a `message` field
  // (a twin difference from AssistantChannel which omits it).
  const { bufferRef, expectedSeqRef, gapTimerRef, closedRef, flushInOrder, reset } =
    useOrderedBroadcast<ScenarioRunBroadcast>({
      onBroadcast,
      resetMarker: "run_started",
      allowSeqlessError: true,
      makeGapCloseError: (seq) => ({
        type: "error",
        seq,
        session_token: "",
        source: "stream_out_of_order",
        message: "stream_out_of_order",
      }),
      makeConnectionLostError: (seq) => ({
        type: "error",
        seq,
        session_token: "",
        source: "connection_lost",
        message: "connection_lost",
      }),
    });

  // Channel lifecycle effect: subscribe on mount (or on socket open if the
  // socket is still CONNECTING at mount), unsubscribe on unmount. Mirrors the
  // CONNECTING→OPEN wake-up dance from useAssistantChannel — the socket
  // reference is stable across that transition so a `socket`-only dep would
  // miss it.
  useEffect(() => {
    if (!socket) return;
    if (
      socket.readyState === WebSocket.CLOSING ||
      socket.readyState === WebSocket.CLOSED
    )
      return;

    closedRef.current = false;
    bufferRef.current = new Map();
    // Backend ScenarioRunner uses post-increment seq starting from `@seq = 0`,
    // so the first broadcast emitted carries `seq: 1`.
    expectedSeqRef.current = 1;
    let subscribed = false;

    const sendSubscribe = (): void => {
      if (subscribed) return;
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          command: "subscribe",
          identifier: SCENARIO_RUN_IDENTIFIER,
        }),
      );
      subscribed = true;
    };

    const onOpen = (): void => sendSubscribe();

    const onMessage = (event: MessageEvent): void => {
      let data: ScenarioRunCableEnvelope;
      try {
        data = JSON.parse(event.data as string) as ScenarioRunCableEnvelope;
      } catch {
        return; // not JSON; ignore
      }
      if (data.identifier !== SCENARIO_RUN_IDENTIFIER) return;
      if (
        data.type === "confirm_subscription" ||
        data.type === "reject_subscription"
      )
        return;
      if (data.type === "ping" || data.type === "welcome") return;

      const inner = data.message;
      if (!inner || typeof inner !== "object") return;
      const broadcast = inner as ScenarioRunBroadcast;

      // Per-run reorder-buffer reset. ScenarioRunner allocates a fresh seq
      // counter per run (starts at 0, post-increments — first broadcast is
      // seq=1). `run_started` is the per-run marker emitted before any per-
      // step envelope, so reset the buffer here so a second run on the same
      // subscription starts fresh. (Mirror of the `accepted` reset in
      // useAssistantChannel.)
      if ((broadcast as { type?: string }).type === "run_started") {
        reset();
      }

      // Tolerate seqless `error` envelopes — single-in-flight rejection
      // (`run_in_progress`) is a transmit, not a broadcast, and therefore
      // carries no seq. Forward directly without buffering.
      if (
        (broadcast as { type?: string }).type === "error" &&
        typeof (broadcast as { seq?: unknown }).seq !== "number"
      ) {
        try {
          onBroadcast(broadcast);
        } catch (err) {
          console.warn(
            "useScenarioRunChannel: onBroadcast threw on seqless error",
            err,
          );
        }
        return;
      }

      if (typeof (broadcast as { seq?: unknown }).seq === "number") {
        bufferRef.current.set((broadcast as { seq: number }).seq, broadcast);
        flushInOrder();
      } else {
        // No seq → bypass reorder buffer. Production broadcast envelopes
        // always carry seq; this branch is forward-compat insurance.
        try {
          onBroadcast(broadcast);
        } catch (err) {
          console.warn(
            "useScenarioRunChannel: onBroadcast threw on seqless event",
            err,
          );
        }
      }
    };

    const onClose = (): void => {
      closedRef.current = true;
      if (gapTimerRef.current !== null) {
        window.clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
      // Synthesize a connection_lost error so the consumer can leave the run
      // mode without waiting for the backend's ensure-block terminator (which
      // never arrives on a TCP drop).
      const errorEvent: ScenarioRunBroadcast = {
        type: "error",
        seq: expectedSeqRef.current,
        session_token: "",
        source: "connection_lost",
        message: "connection_lost",
      };
      try {
        onBroadcast(errorEvent);
      } catch (err) {
        console.warn("useScenarioRunChannel: onBroadcast threw on close", err);
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
              identifier: SCENARIO_RUN_IDENTIFIER,
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
    (action: ScenarioRunDispatchAction, data: object = {}) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          command: "message",
          identifier: SCENARIO_RUN_IDENTIFIER,
          data: JSON.stringify({ action, ...data }),
        }),
      );
    },
    [socket],
  );

  return { dispatch };
}
