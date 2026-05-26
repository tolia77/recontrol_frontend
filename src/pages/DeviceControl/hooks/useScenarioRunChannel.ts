import { useCallback, useEffect, useRef } from 'react';

const SCENARIO_RUN_IDENTIFIER = JSON.stringify({ channel: 'ScenarioRunChannel' });
const GAP_CLOSE_TIMEOUT_MS = 500;

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
      type: 'run_started';
      seq: number;
      session_token: string;
      run_id: string;
      scenario_id: string;
      started_at: string;
      step_count: number;
    }
  | {
      type: 'scenario_step_skipped';
      seq: number;
      session_token: string;
      run_id: string;
      step_index: number;
      reason:
        | 'previous_step_failed'
        | 'user_stopped'
        | 'policy_deny'
        | 'access_revoked'
        | 'timeout';
    }
  | {
      type: 'tool_call_start';
      seq: number;
      session_token: string;
      tool_call_id: string;
      name: string;
      label: string;
      args: object;
      cwd?: string;
    }
  | {
      type: 'tool_call_result';
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
      type: 'done';
      seq: number;
      session_token: string;
      stop_reason: string;
      failed_step_index?: number;
      reason?: string;
      message?: string;
    }
  | {
      type: 'error';
      seq?: number;
      session_token?: string;
      source?: string;
      message: string;
    };

export type ScenarioRunDispatchAction = 'start_run' | 'stop_run';

export interface UseScenarioRunChannelReturn {
  dispatch: (action: ScenarioRunDispatchAction, data?: object) => void;
}

interface ScenarioRunCableEnvelope {
  identifier?: string;
  type?: string;
  message?: unknown;
}

/**
 * Subscribe to the Rails ScenarioRunChannel over the existing raw WebSocket.
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
  ws: WebSocket | null,
  onBroadcast: (msg: ScenarioRunBroadcast) => void,
): UseScenarioRunChannelReturn {
  // Refs avoid stale-closure in the message handler bound inside the effect.
  const onBroadcastRef = useRef(onBroadcast);
  useEffect(() => {
    onBroadcastRef.current = onBroadcast;
  }, [onBroadcast]);

  // Seq-ordered reorder buffer per Phase 18 STREAM-02 / Phase 22 Pitfall 2.
  const bufferRef = useRef<Map<number, ScenarioRunBroadcast>>(new Map());
  const expectedSeqRef = useRef<number>(0);
  const gapTimerRef = useRef<number | null>(null);
  const closedRef = useRef<boolean>(false);

  // Flush in-order from the reorder buffer.
  const flushInOrder = useCallback((): void => {
    while (bufferRef.current.has(expectedSeqRef.current)) {
      const msg = bufferRef.current.get(expectedSeqRef.current);
      if (!msg) break;
      bufferRef.current.delete(expectedSeqRef.current);
      expectedSeqRef.current += 1;
      try {
        onBroadcastRef.current(msg);
      } catch (err) {
        // Consumer errors must not crash the hook; log and continue.
        console.warn('useScenarioRunChannel: onBroadcast threw', err);
      }
    }

    if (bufferRef.current.size > 0 && gapTimerRef.current === null) {
      gapTimerRef.current = window.setTimeout(() => {
        gapTimerRef.current = null;
        // Suppress synthetic gap-close error after socket close; the close
        // handler already delivered `connection_lost`.
        if (closedRef.current) return;
        const errorEvent: ScenarioRunBroadcast = {
          type: 'error',
          seq: expectedSeqRef.current,
          session_token: '',
          source: 'stream_out_of_order',
          message: 'stream_out_of_order',
        };
        try {
          onBroadcastRef.current(errorEvent);
        } catch (err) {
          console.warn(
            'useScenarioRunChannel: onBroadcast threw on gap-close error',
            err,
          );
        }
      }, GAP_CLOSE_TIMEOUT_MS);
    } else if (bufferRef.current.size === 0 && gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }, []);

  // Channel lifecycle effect: subscribe on mount (or on socket open if the
  // socket is still CONNECTING at mount), unsubscribe on unmount. Mirrors the
  // CONNECTING→OPEN wake-up dance from useAssistantChannel — the socket
  // reference is stable across that transition so a `ws`-only dep would miss
  // it.
  useEffect(() => {
    if (!ws) return;
    if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) return;

    closedRef.current = false;
    bufferRef.current = new Map();
    // Backend ScenarioRunner uses post-increment seq starting from `@seq = 0`,
    // so the first broadcast emitted carries `seq: 1`.
    expectedSeqRef.current = 1;
    let subscribed = false;

    const sendSubscribe = (): void => {
      if (subscribed) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ command: 'subscribe', identifier: SCENARIO_RUN_IDENTIFIER }));
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
      if (data.type === 'confirm_subscription' || data.type === 'reject_subscription') return;
      if (data.type === 'ping' || data.type === 'welcome') return;

      const inner = data.message;
      if (!inner || typeof inner !== 'object') return;
      const broadcast = inner as ScenarioRunBroadcast;

      // Per-run reorder-buffer reset. ScenarioRunner allocates a fresh seq
      // counter per run (starts at 0, post-increments — first broadcast is
      // seq=1). `run_started` is the per-run marker emitted before any per-
      // step envelope, so reset the buffer here so a second run on the same
      // subscription starts fresh. (Mirror of the `accepted` reset in
      // useAssistantChannel.)
      if ((broadcast as { type?: string }).type === 'run_started') {
        bufferRef.current = new Map();
        expectedSeqRef.current = 1;
        if (gapTimerRef.current !== null) {
          window.clearTimeout(gapTimerRef.current);
          gapTimerRef.current = null;
        }
      }

      // Tolerate seqless `error` envelopes — single-in-flight rejection
      // (`run_in_progress`) is a transmit, not a broadcast, and therefore
      // carries no seq. Forward directly without buffering.
      if (
        (broadcast as { type?: string }).type === 'error' &&
        typeof (broadcast as { seq?: unknown }).seq !== 'number'
      ) {
        try {
          onBroadcastRef.current(broadcast);
        } catch (err) {
          console.warn(
            'useScenarioRunChannel: onBroadcast threw on seqless error',
            err,
          );
        }
        return;
      }

      if (typeof (broadcast as { seq?: unknown }).seq === 'number') {
        bufferRef.current.set((broadcast as { seq: number }).seq, broadcast);
        flushInOrder();
      } else {
        // No seq → bypass reorder buffer. Production broadcast envelopes
        // always carry seq; this branch is forward-compat insurance.
        try {
          onBroadcastRef.current(broadcast);
        } catch (err) {
          console.warn(
            'useScenarioRunChannel: onBroadcast threw on seqless event',
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
        type: 'error',
        seq: expectedSeqRef.current,
        session_token: '',
        source: 'connection_lost',
        message: 'connection_lost',
      };
      try {
        onBroadcastRef.current(errorEvent);
      } catch (err) {
        console.warn('useScenarioRunChannel: onBroadcast threw on close', err);
      }
    };

    ws.addEventListener('open', onOpen);
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose);

    // Already open at mount → subscribe immediately. Otherwise the `open`
    // listener handles it when the CONNECTING socket transitions.
    sendSubscribe();

    return () => {
      try {
        if (subscribed && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              command: 'unsubscribe',
              identifier: SCENARIO_RUN_IDENTIFIER,
            }),
          );
        }
      } catch {
        // swallow — socket may already be closing
      }
      ws.removeEventListener('open', onOpen);
      ws.removeEventListener('message', onMessage);
      ws.removeEventListener('close', onClose);
      if (gapTimerRef.current !== null) {
        window.clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
    };
  }, [ws, flushInOrder]);

  const dispatch = useCallback(
    (action: ScenarioRunDispatchAction, data: object = {}) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      // Re-assert the subscription immediately before every action. Frequent
      // web-socket reconnects (short-lived access tokens) plus StrictMode effect
      // churn can leave this subscription torn down on the live connection — the
      // lifecycle effect's last action ends up being an `unsubscribe` with no
      // following re-subscribe. Without this guard the message below lands on a
      // missing subscription and Rails raises "Unable to find subscription with
      // identifier: {"channel":"ScenarioRunChannel"}".
      //
      // ActionCable's `Subscriptions#add` is a no-op when the identifier is
      // already registered and otherwise registers + confirms synchronously,
      // in-order, before the next command on the same connection is processed.
      // So prefixing the action with a subscribe is harmless when already
      // subscribed and self-healing when not. (Mirror of useAssistantChannel.)
      ws.send(JSON.stringify({ command: 'subscribe', identifier: SCENARIO_RUN_IDENTIFIER }));
      ws.send(
        JSON.stringify({
          command: 'message',
          identifier: SCENARIO_RUN_IDENTIFIER,
          data: JSON.stringify({ action, ...data }),
        }),
      );
    },
    [ws],
  );

  return { dispatch };
}
