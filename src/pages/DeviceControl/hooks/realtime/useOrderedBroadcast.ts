import { useCallback, useEffect, useRef } from "react";

export const GAP_CLOSE_TIMEOUT_MS = 500;

/**
 * Shared seq-ordered reorder buffer base hook (D-12).
 *
 * Both useAssistantChannel and useScenarioRunChannel duplicate this machinery
 * verbatim (Phase 18 STREAM-02 / Phase 22 Pitfall 2). Extracted once,
 * parameterized for the three documented twin differences, composed by each
 * channel hook.
 *
 * Behavioral invariants (byte-equivalent to both originals):
 *  - `bufferRef` accumulates out-of-order messages keyed by seq.
 *  - `expectedSeqRef` starts at 1 (backend post-increments from @seq=0;
 *    first broadcast carries seq: 1).
 *  - `flushInOrder` drains the buffer in ascending seq order, schedules a
 *    500ms gap-close timer when a hole remains, and synthesizes the gap-close
 *    error (via makeGapCloseError) when the timer fires while the socket is
 *    still open.
 *  - `reset()` re-initialises the buffer + expectedSeq to 1 and clears any
 *    pending gap timer. Channel hooks call this when they receive the
 *    reset-marker broadcast (e.g. "accepted" or "run_started").
 *  - `closedRef` is set by the channel hook's onClose handler to suppress
 *    the gap-close timer firing post-teardown (VERIFY-04 invariant).
 *
 * Three twin differences parameterized via options:
 *  - `resetMarker`: the broadcast type that triggers buffer reset between runs
 *    ("accepted" for AssistantChannel, "run_started" for ScenarioRunChannel).
 *    Detected and handled by each channel hook's onMessage; `reset()` is
 *    provided for the hook to call.
 *  - `allowSeqlessError`: ScenarioRunChannel only — seqless `error` envelopes
 *    (single-in-flight rejection, a transmit not a broadcast) are forwarded
 *    directly before seq-routing. Handled in each channel hook's onMessage.
 *  - `makeGapCloseError` / `makeConnectionLostError`: AssistantChannel omits
 *    the `message` field; ScenarioRunChannel includes it. `makeGapCloseError`
 *    is called by flushInOrder's gap-close timer. `makeConnectionLostError` is
 *    called by channel hooks in their own onClose handlers.
 *
 * NOT in this base — the CONNECTING→OPEN socket-lifecycle logic stays in
 * each channel hook's own useEffect (Landmine 5). Subscribe/unsubscribe
 * framing is also channel-hook-owned.
 */

export interface UseOrderedBroadcastOptions<T> {
  onBroadcast: (msg: T) => void;
  /**
   * Broadcast type that resets the buffer between runs (e.g. "accepted").
   * Channel hooks detect this type in their onMessage handler and call reset().
   */
  resetMarker?: string;
  /**
   * When true, seqless `error` envelopes are forwarded directly to the
   * consumer before normal seq-routing — ScenarioRunChannel single-in-flight
   * rejection (a transmit, not a broadcast, so no seq is stamped).
   * Handled in each channel hook's onMessage. Default: false.
   */
  allowSeqlessError?: boolean;
  /**
   * Constructs the synthetic gap-close error shape for this channel.
   * Called by flushInOrder's gap-close timer.
   */
  makeGapCloseError: (seq: number) => T;
  /**
   * Constructs the synthetic connection_lost error shape for this channel.
   * Called by channel hooks in their own onClose handlers (the channel
   * lifecycle stays in the channel hook, not the base).
   */
  makeConnectionLostError: (seq: number) => T;
}

export interface UseOrderedBroadcastReturn<T> {
  bufferRef: React.MutableRefObject<Map<number, T>>;
  expectedSeqRef: React.MutableRefObject<number>;
  gapTimerRef: React.MutableRefObject<number | null>;
  closedRef: React.MutableRefObject<boolean>;
  /**
   * Flush the reorder buffer in ascending seq order.
   * Also schedules/clears the gap-close timer.
   */
  flushInOrder: () => void;
  /**
   * Re-initialise the buffer and expectedSeq to 1; clear any gap timer.
   * Channel hooks call this when they receive the reset-marker broadcast.
   */
  reset: () => void;
}

export function useOrderedBroadcast<T extends { type: string; seq?: number }>(
  opts: UseOrderedBroadcastOptions<T>,
): UseOrderedBroadcastReturn<T> {
  const { onBroadcast, makeGapCloseError } = opts;

  // Stale-closure ref mirroring: keep onBroadcast stable inside async
  // callbacks that are bound once at hook-call time (useCallback with [] deps).
  const onBroadcastRef = useRef(onBroadcast);
  useEffect(() => {
    onBroadcastRef.current = onBroadcast;
  }, [onBroadcast]);

  // Mirror makeGapCloseError so the gap-close timer always uses the latest
  // factory without needing it in flushInOrder's dependency array.
  const makeGapCloseErrorRef = useRef(makeGapCloseError);
  useEffect(() => {
    makeGapCloseErrorRef.current = makeGapCloseError;
  }, [makeGapCloseError]);

  // Seq-ordered reorder buffer per Phase 18 STREAM-02 / D-16.
  const bufferRef = useRef<Map<number, T>>(new Map());
  // expectedSeqRef starts at 1 — backend post-increments from @seq=0 so the
  // first broadcast emitted by the backend carries seq: 1.
  const expectedSeqRef = useRef<number>(1);
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
        console.warn("useOrderedBroadcast: onBroadcast threw", err);
      }
    }

    if (bufferRef.current.size > 0 && gapTimerRef.current === null) {
      gapTimerRef.current = window.setTimeout(() => {
        gapTimerRef.current = null;
        // VERIFY-04 invariant: suppress synthetic gap-close error after socket
        // close; the close handler already delivered `connection_lost`.
        if (closedRef.current) return;
        const errorEvent = makeGapCloseErrorRef.current(
          expectedSeqRef.current,
        );
        try {
          onBroadcastRef.current(errorEvent);
        } catch (err) {
          console.warn(
            "useOrderedBroadcast: onBroadcast threw on gap-close error",
            err,
          );
        }
      }, GAP_CLOSE_TIMEOUT_MS);
    } else if (bufferRef.current.size === 0 && gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }, []);

  const reset = useCallback((): void => {
    bufferRef.current = new Map();
    expectedSeqRef.current = 1;
    if (gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }, []);

  return {
    bufferRef,
    expectedSeqRef,
    gapTimerRef,
    closedRef,
    flushInOrder,
    reset,
  };
}
