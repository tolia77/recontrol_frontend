import { useCallback, useEffect, useRef } from 'react';

const ASSISTANT_IDENTIFIER = JSON.stringify({ channel: 'AssistantChannel' });
const GAP_CLOSE_TIMEOUT_MS = 500;

/**
 * Inner broadcast envelope shape per Phase 18 STREAM-03 / STREAM-04 and Phase 20 D-11.
 *
 * Phase 20 frontend consumes these seven shapes (six wire types plus a synthesized
 * `connection_lost` error). Unknown / forward-compat broadcast types are ignored
 * silently by the reducer (STREAM-03 forward-compat).
 */
export type AssistantBroadcast =
  | { type: 'token'; seq: number; session_token: string; content: string }
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
      type: 'requires_confirmation';
      seq: number;
      session_token: string;
      confirmation_id: string;
      tool_call_id: string;
      label: string;
      command: string;
      args: unknown[];
      cwd?: string;
      reason: string;
      zone: 'deny_list' | 'outside_list';
    }
  | { type: 'quota_warning'; seq: number; session_token: string; percent: number }
  | { type: 'done'; seq: number; session_token: string; stop_reason: string; message?: string }
  | { type: 'error'; seq: number; session_token: string; source: string; message?: string };

export type AssistantDispatchAction = 'run_prompt' | 'stop_loop' | 'confirm_tool_call';

export interface UseAssistantChannelReturn {
  dispatch: (action: AssistantDispatchAction, data?: object) => void;
}

interface AssistantCableEnvelope {
  identifier?: string;
  type?: string;
  message?: unknown;
}

/**
 * Subscribe to the Rails AssistantChannel over the existing raw WebSocket
 * (the same socket that DeviceControl already opens for CommandChannel).
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
  ws: WebSocket | null,
  onBroadcast: (msg: AssistantBroadcast) => void,
): UseAssistantChannelReturn {
  // Refs avoid stale-closure in the message handler bound inside the effect.
  const onBroadcastRef = useRef(onBroadcast);
  useEffect(() => {
    onBroadcastRef.current = onBroadcast;
  }, [onBroadcast]);

  // Seq-ordered reorder buffer per Phase 18 STREAM-02 / D-16.
  const bufferRef = useRef<Map<number, AssistantBroadcast>>(new Map());
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
        // Reducer errors must not crash the hook; log and continue.
        console.warn('useAssistantChannel: onBroadcast threw', err);
      }
    }

    if (bufferRef.current.size > 0 && gapTimerRef.current === null) {
      gapTimerRef.current = window.setTimeout(() => {
        gapTimerRef.current = null;
        // VERIFY-04 invariant: suppress synthetic gap-close error after socket
        // close; the close handler already delivered `connection_lost`.
        if (closedRef.current) return;
        const errorEvent: AssistantBroadcast = {
          type: 'error',
          seq: expectedSeqRef.current,
          session_token: '',
          source: 'stream_out_of_order',
        };
        try {
          onBroadcastRef.current(errorEvent);
        } catch (err) {
          console.warn('useAssistantChannel: onBroadcast threw on gap-close error', err);
        }
      }, GAP_CLOSE_TIMEOUT_MS);
    } else if (bufferRef.current.size === 0 && gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }, []);

  // Channel lifecycle effect: subscribe on mount (or on socket open if the
  // socket is still CONNECTING at mount), unsubscribe on unmount.
  //
  // The CONNECTING→OPEN transition does NOT change the WebSocket object
  // reference, so a dependency on `ws` alone would let the subscribe slip
  // through whenever AssistantPanel mounts before the parent's socket is open.
  // We attach an `open` listener as a wake-up to catch that case.
  useEffect(() => {
    if (!ws) return;
    if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) return;

    closedRef.current = false;
    bufferRef.current = new Map();
    expectedSeqRef.current = 0;
    let subscribed = false;

    const sendSubscribe = (): void => {
      if (subscribed) return;
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ command: 'subscribe', identifier: ASSISTANT_IDENTIFIER }));
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
      if (data.type === 'confirm_subscription' || data.type === 'reject_subscription') return;
      if (data.type === 'ping' || data.type === 'welcome') return;

      const inner = data.message;
      if (!inner || typeof inner !== 'object') return;
      const broadcast = inner as AssistantBroadcast;

      if (typeof (broadcast as { seq?: unknown }).seq === 'number') {
        bufferRef.current.set((broadcast as { seq: number }).seq, broadcast);
        flushInOrder();
      } else {
        // No seq → bypass reorder buffer. Production envelopes always carry
        // seq; this branch only fires for malformed traffic.
        try {
          onBroadcastRef.current(broadcast);
        } catch (err) {
          console.warn('useAssistantChannel: onBroadcast threw on seqless event', err);
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
        type: 'error',
        seq: expectedSeqRef.current,
        session_token: '',
        source: 'connection_lost',
      };
      try {
        onBroadcastRef.current(errorEvent);
      } catch (err) {
        console.warn('useAssistantChannel: onBroadcast threw on close', err);
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
          ws.send(JSON.stringify({ command: 'unsubscribe', identifier: ASSISTANT_IDENTIFIER }));
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
    (action: AssistantDispatchAction, data: object = {}) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(
        JSON.stringify({
          command: 'message',
          identifier: ASSISTANT_IDENTIFIER,
          data: JSON.stringify({ action, ...data }),
        }),
      );
    },
    [ws],
  );

  return { dispatch };
}
