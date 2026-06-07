import { useCallback, useEffect, useRef } from "react";
import type { CableConsumerLike } from "./useCableConsumer";
import { useOrderedBroadcast } from "./useOrderedBroadcast";

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

interface UseScenarioRunChannelOptions {
  consumer: CableConsumerLike | null;
  onBroadcast: (msg: ScenarioRunBroadcast) => void;
}

interface ScenarioRunSubscription {
  perform: (action: string, data?: object) => void;
  unsubscribe: () => void;
}

// ActionCable keys server-side subscriptions by the identifier JSON. With a
// bare `{channel: "ScenarioRunChannel"}` identifier every mount shares one
// identifier, so a previous mount's late `unsubscribe` can destroy the next
// mount's live server-side subscription (Rails 7.1+ treats the duplicate
// `subscribe` as a confirmation replay without re-creating it) — `perform`
// then raises "Unable to find subscription" server-side and the action is
// silently dropped. A per-mount nonce makes every identifier unique so the
// commands of different mounts can never cross. The backend reads nothing
// from params, so the extra key is inert server-side.
let subscriptionNonce = 0;

/**
 * Subscribe to the Rails ScenarioRunChannel via the shared ActionCable consumer.
 *
 * Options-object signature per D-11. Composes useOrderedBroadcast for the
 * seq-reorder buffer per D-12 (resetMarker "run_started", allowSeqlessError
 * true — seqless error envelopes are forwarded directly before seq-routing).
 *
 * Wire-format invariants (Phase 22; mirror of useAssistantChannel — Pitfall 2
 * and Pitfall 6 from 22-RESEARCH.md):
 *  - `seq` is monotonically increasing per run; gaps are reordered with a
 *    500ms gap-close timeout. After the timeout fires (and the connection is still
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
 *  - Disconnect while a run is in flight synthesizes
 *    `{type:'error', source:'connection_lost', message:'connection_lost'}` so
 *    the consumer can transition to the error state without waiting for the
 *    backend's ensure-block terminator. (beforeunload tab-close handling is
 *    the consuming component's responsibility — Pitfall 6.)
 *  - The subscription identifier carries a per-mount `nonce` so remounts never
 *    reuse an identifier (a late unsubscribe from a previous mount would
 *    otherwise destroy the live subscription server-side).
 *  - `dispatch` queues actions until the subscription confirmation arrives
 *    (`connected` callback) and flushes them in order; performing before
 *    confirmation would raise "Unable to find subscription" server-side and
 *    drop the action. A rejection drops the queue (never deliverable).
 */
export function useScenarioRunChannel(
  { consumer, onBroadcast }: UseScenarioRunChannelOptions,
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

  // Mirror onBroadcast so the subscription lifecycle depends only on `consumer`
  // (re-subscribing on every onBroadcast identity change would tear down the
  // server-side scenario run via `unsubscribed`).
  const onBroadcastRef = useRef(onBroadcast);
  useEffect(() => {
    onBroadcastRef.current = onBroadcast;
  }, [onBroadcast]);

  const subRef = useRef<ScenarioRunSubscription | null>(null);
  // True once the server transmits the subscription confirmation; reset on
  // disconnect (ActionCable re-confirms after its automatic resubscribe).
  const confirmedRef = useRef(false);
  // Actions dispatched before confirmation, flushed in order on `connected`.
  const pendingRef = useRef<Array<[ScenarioRunDispatchAction, object]>>([]);

  useEffect(() => {
    if (!consumer) return;
    closedRef.current = false;
    reset();

    const sub = consumer.subscriptions.create(
      { channel: "ScenarioRunChannel", nonce: ++subscriptionNonce },
      {
        connected: () => {
          confirmedRef.current = true;
          const pending = pendingRef.current;
          pendingRef.current = [];
          for (const [action, data] of pending) sub.perform(action, data);
        },
        received: (raw: unknown) => {
          const b = raw as ScenarioRunBroadcast;
          if ((b as { type?: string }).type === "run_started") reset();
          // Seqless `error` envelopes (single-in-flight rejection, a transmit
          // not a broadcast) bypass the reorder buffer.
          if (
            (b as { type?: string }).type === "error" &&
            typeof (b as { seq?: unknown }).seq !== "number"
          ) {
            try {
              onBroadcastRef.current(b);
            } catch (err) {
              console.warn("useScenarioRunChannel: onBroadcast threw on seqless error", err);
            }
            return;
          }
          if (typeof (b as { seq?: unknown }).seq === "number") {
            bufferRef.current.set((b as { seq: number }).seq, b);
            flushInOrder();
          } else {
            // No seq → bypass reorder buffer. Production broadcast envelopes
            // always carry seq; this branch is forward-compat insurance.
            try {
              onBroadcastRef.current(b);
            } catch (err) {
              console.warn("useScenarioRunChannel: onBroadcast threw on seqless event", err);
            }
          }
        },
        disconnected: () => {
          confirmedRef.current = false;
          closedRef.current = true;
          if (gapTimerRef.current !== null) {
            window.clearTimeout(gapTimerRef.current);
            gapTimerRef.current = null;
          }
          onBroadcastRef.current({
            type: "error",
            seq: expectedSeqRef.current,
            session_token: "",
            source: "connection_lost",
            message: "connection_lost",
          });
        },
        rejected: () => {
          // No further broadcasts will arrive; clear any armed gap-close timer
          // and suppress it (mirrors disconnected) so it cannot fire a spurious
          // stream_out_of_order after the rejection error. Queued dispatches
          // are dropped — they can never be delivered on a rejected channel.
          confirmedRef.current = false;
          pendingRef.current = [];
          closedRef.current = true;
          if (gapTimerRef.current !== null) {
            window.clearTimeout(gapTimerRef.current);
            gapTimerRef.current = null;
          }
          onBroadcastRef.current({
            type: "error",
            seq: expectedSeqRef.current,
            session_token: "",
            source: "subscription_rejected",
            message: "subscription_rejected",
          });
        },
      },
    ) as ScenarioRunSubscription;
    subRef.current = sub;

    return () => {
      sub.unsubscribe();
      // Drop the handle so a dispatch landing after teardown cannot perform on
      // a dead subscription (the server has already removed it).
      if (subRef.current === sub) subRef.current = null;
      confirmedRef.current = false;
      pendingRef.current = [];
      if (gapTimerRef.current !== null) {
        window.clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
    };
  }, [consumer, flushInOrder, reset, bufferRef, closedRef, expectedSeqRef, gapTimerRef]);

  const dispatch = useCallback((action: ScenarioRunDispatchAction, data: object = {}) => {
    if (confirmedRef.current && subRef.current) {
      subRef.current.perform(action, data);
    } else {
      // Subscribe still in flight (or reconnecting): queue instead of
      // performing into a subscription the server does not have yet.
      pendingRef.current.push([action, data]);
    }
  }, []);

  return { dispatch };
}
