import { useCallback, useEffect, useRef } from "react";
import type { CableConsumerLike } from "./useCableConsumer";
import { useOrderedBroadcast } from "./useOrderedBroadcast";

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
  | "confirm_tool_call"
  | "reset_conversation";

export interface UseAssistantChannelReturn {
  dispatch: (action: AssistantDispatchAction, data?: object) => void;
}

interface UseAssistantChannelOptions {
  consumer: CableConsumerLike | null;
  onBroadcast: (msg: AssistantBroadcast) => void;
}

interface AssistantSubscription {
  perform: (action: string, data?: object) => void;
  unsubscribe: () => void;
}

// ActionCable keys server-side subscriptions by the identifier JSON. With a
// bare `{channel: "AssistantChannel"}` identifier every mount shares one
// identifier, so a previous mount's late `unsubscribe` can destroy the next
// mount's live server-side subscription (Rails 7.1+ treats the duplicate
// `subscribe` as a confirmation replay without re-creating it) — `perform`
// then raises "Unable to find subscription" server-side and the action is
// silently dropped. A per-mount nonce makes every identifier unique so the
// commands of different mounts can never cross. The backend reads nothing
// from params, so the extra key is inert server-side.
let subscriptionNonce = 0;

/**
 * Subscribe to the Rails AssistantChannel via the shared ActionCable consumer.
 *
 * Options-object signature per D-11. Composes useOrderedBroadcast for the
 * seq-reorder buffer per D-12 (resetMarker "accepted", no seqless error
 * passthrough).
 *
 * Wire-format invariants (Phase 18 STREAM-02..04, D-11):
 *  - `seq` is monotonically increasing per session; gaps are reordered with a
 *    500ms gap-close timeout. After the timeout fires (and the connection is still
 *    open) the hook synthesizes `{type:'error', source:'stream_out_of_order'}`
 *    so the reducer can leave streaming state.
 *  - `session_token` discriminates streams; v1 leaves filtering to the reducer
 *    (20-07) which scopes rendering per session. The hook delivers all session
 *    tokens unchanged.
 *  - Connection drop while broadcasts are still in flight synthesizes
 *    `{type:'error', source:'connection_lost'}` so the reducer can transition
 *    to the error state without waiting for the backend's STREAM-06
 *    ensure-block terminator (VERIFY-04).
 *  - On disconnect any pending gap-close timer is cleared so it never fires
 *    post-teardown — keeping the VERIFY-04 invariant that the synthesized
 *    `connection_lost` error is delivered within 5s of disconnect.
 *  - The subscription identifier carries a per-mount `nonce` so remounts never
 *    reuse an identifier (a late unsubscribe from a previous mount would
 *    otherwise destroy the live subscription server-side).
 *  - `dispatch` queues actions until the subscription confirmation arrives
 *    (`connected` callback) and flushes them in order; performing before
 *    confirmation would raise "Unable to find subscription" server-side and
 *    drop the action. A rejection drops the queue (never deliverable).
 */
export function useAssistantChannel(
  { consumer, onBroadcast }: UseAssistantChannelOptions,
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

  // Mirror onBroadcast so the subscription lifecycle depends only on `consumer`
  // (re-subscribing on every onBroadcast identity change would tear down the
  // server-side agent run via `unsubscribed`).
  const onBroadcastRef = useRef(onBroadcast);
  useEffect(() => {
    onBroadcastRef.current = onBroadcast;
  }, [onBroadcast]);

  const subRef = useRef<AssistantSubscription | null>(null);
  // True once the server transmits the subscription confirmation; reset on
  // disconnect (ActionCable re-confirms after its automatic resubscribe).
  const confirmedRef = useRef(false);
  // Actions dispatched before confirmation, flushed in order on `connected`.
  const pendingRef = useRef<Array<[AssistantDispatchAction, object]>>([]);

  useEffect(() => {
    if (!consumer) return;
    closedRef.current = false;
    reset();

    const sub = consumer.subscriptions.create(
      { channel: "AssistantChannel", nonce: ++subscriptionNonce },
      {
        connected: () => {
          confirmedRef.current = true;
          const pending = pendingRef.current;
          pendingRef.current = [];
          for (const [action, data] of pending) sub.perform(action, data);
        },
        received: (raw: unknown) => {
          const b = raw as AssistantBroadcast;
          // `accepted` is a seqless control frame (resets the per-run buffer); it
          // is not part of the broadcast stream the reducer consumes, so reset
          // and return rather than forwarding it down the seqless path.
          if ((b as { type?: string }).type === "accepted") {
            reset();
            return;
          }
          if (typeof (b as { seq?: unknown }).seq === "number") {
            bufferRef.current.set((b as { seq: number }).seq, b);
            flushInOrder();
          } else {
            // No seq → bypass reorder buffer. Production envelopes always carry
            // seq; this branch only fires for malformed traffic.
            try {
              onBroadcastRef.current(b);
            } catch (err) {
              console.warn("useAssistantChannel: onBroadcast threw on seqless event", err);
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
          });
        },
      },
    ) as AssistantSubscription;
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

  const dispatch = useCallback((action: AssistantDispatchAction, data: object = {}) => {
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
