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
  | "confirm_tool_call";

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

  useEffect(() => {
    if (!consumer) return;
    closedRef.current = false;
    reset();

    const sub = consumer.subscriptions.create(
      { channel: "AssistantChannel" },
      {
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
          // stream_out_of_order after the rejection error.
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
      if (gapTimerRef.current !== null) {
        window.clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
    };
  }, [consumer, flushInOrder, reset, bufferRef, closedRef, expectedSeqRef, gapTimerRef]);

  const dispatch = useCallback((action: AssistantDispatchAction, data: object = {}) => {
    subRef.current?.perform(action, data);
  }, []);

  return { dispatch };
}
