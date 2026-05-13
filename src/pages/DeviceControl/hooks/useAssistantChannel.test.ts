// VERIFY-04 stream-drop vitest (Plan 20-02).
//
// Scenario from REQUIREMENTS.md VERIFY-04:
//   "Stream termination on TCP drop: simulate Rails worker kill mid-stream;
//    the React client reaches an `error` state within 5 s (no frozen
//    spinner); reconnecting starts a fresh session with no stale tool results
//    from the killed run."
//
// Strategy:
//   - The unit under verification is the hook + reducer integration: the hook
//     (20-06) synthesizes `{type:'error', source:'connection_lost'}` on socket
//     close and the reducer (20-07) consumes that event to flip
//     `state.status` from `streaming` to `error`. We drive the hook directly
//     with `renderHook` and a hand-rolled MockWebSocket; the broadcasts
//     emitted by the hook are fed into the real `transcriptReducer` via a
//     test-local `useReducer` wrapper so the status assertion is real, not
//     mocked.
//   - Fake timers (`vi.useFakeTimers()`) advance wall-clock deterministically
//     so the test executes in milliseconds while still asserting the 5-second
//     wall-clock invariant.
//   - We do NOT use the global WebSocket (jsdom does not implement it) — we
//     pass the MockWebSocket instance into the hook directly as its `ws`
//     prop. `vi.stubGlobal('WebSocket', MockWebSocket)` is used to expose the
//     class's static `OPEN` constant so the hook's `ws.readyState !==
//     WebSocket.OPEN` guard sees a consistent value.
import { renderHook, act } from '@testing-library/react';
import { useReducer, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAssistantChannel, type AssistantBroadcast } from './useAssistantChannel';
import {
  initialTranscriptState,
  transcriptReducer,
  type TranscriptState,
} from '../components/Assistant/transcriptReducer';

const ASSISTANT_IDENTIFIER = JSON.stringify({ channel: 'AssistantChannel' });

/**
 * MockWebSocket — minimal WebSocket-compatible double for hook lifecycle
 * tests. Surfaces the API the hook actually touches:
 *   readyState, send, addEventListener('message'|'close'),
 *   removeEventListener, close.
 *
 * `dispatchBroadcast(inner)` injects a server-to-client ActionCable envelope
 * carrying the given inner broadcast. `close()` flips readyState and fires
 * the 'close' listener — mimicking a TCP-level drop (Rails worker killed
 * mid-stream; the server never gets a chance to emit `done` or `error`).
 */
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState: number = MockWebSocket.OPEN;
  sent: string[] = [];
  private messageListeners: Array<(ev: MessageEvent) => void> = [];
  private closeListeners: Array<(ev: CloseEvent) => void> = [];
  private openListeners: Array<(ev: Event) => void> = [];

  send(payload: string): void {
    this.sent.push(payload);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'message') {
      this.messageListeners.push(listener as (ev: MessageEvent) => void);
    } else if (type === 'close') {
      this.closeListeners.push(listener as (ev: CloseEvent) => void);
    } else if (type === 'open') {
      this.openListeners.push(listener as (ev: Event) => void);
    }
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'message') {
      this.messageListeners = this.messageListeners.filter((l) => l !== listener);
    } else if (type === 'close') {
      this.closeListeners = this.closeListeners.filter((l) => l !== listener);
    } else if (type === 'open') {
      this.openListeners = this.openListeners.filter((l) => l !== listener);
    }
  }

  /** Flip readyState to OPEN and fire any 'open' listeners (CONNECTING→OPEN). */
  fireOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    const ev = new Event('open');
    this.openListeners.slice().forEach((l) => l(ev));
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    const ev = new CloseEvent('close');
    // Slice() to guard against listeners that mutate the array during dispatch.
    this.closeListeners.slice().forEach((l) => l(ev));
  }

  /**
   * Inject an ActionCable inner-broadcast message. The envelope wraps the
   * inner payload exactly as `recontrol_backend/app/channels/assistant_channel.rb`
   * does: `{ identifier: '{"channel":"AssistantChannel"}', message: <inner> }`.
   */
  dispatchBroadcast(inner: object, identifier: string = ASSISTANT_IDENTIFIER): void {
    const event = new MessageEvent('message', {
      data: JSON.stringify({ identifier, message: inner }),
    });
    this.messageListeners.slice().forEach((l) => l(event));
  }
}

/**
 * Test harness: mount useAssistantChannel paired with the real
 * transcriptReducer so we can assert real status transitions instead of
 * peeking at a recorded broadcast list. Returns the current reducer state
 * snapshot from the hook's perspective.
 */
function useChannelWithReducer(ws: WebSocket | null): {
  state: TranscriptState;
  broadcasts: AssistantBroadcast[];
} {
  const [state, dispatchTranscript] = useReducer(transcriptReducer, initialTranscriptState);
  // useRef so the recorder persists across re-renders (a fresh `[]` per render
  // would lose history when the hook fires events between renders).
  const broadcastsRef = useRef<AssistantBroadcast[]>([]);
  // Mirror what AssistantPanel.tsx does in production (see 20-09 wiring).
  useAssistantChannel(ws, (msg) => {
    broadcastsRef.current.push(msg);
    dispatchTranscript({ type: 'broadcast', broadcast: msg });
  });
  return { state, broadcasts: broadcastsRef.current };
}

describe('useAssistantChannel — VERIFY-04 stream-drop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Expose MockWebSocket's static `OPEN` to the hook's
    // `ws.readyState !== WebSocket.OPEN` guard via the global. jsdom does not
    // ship a WebSocket; without this stub the hook's reference to the global
    // `WebSocket` constant throws ReferenceError during the lifecycle effect.
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('VERIFY-04: WebSocket close while streaming flips reducer status to error within 5s', () => {
    const ws = new MockWebSocket();

    const { result } = renderHook(({ socket }) => useChannelWithReducer(socket), {
      initialProps: { socket: ws as unknown as WebSocket },
    });

    // Seed the reducer into the `submit_prompt` → streaming flow first so the
    // reducer's session_token filter accepts subsequent token broadcasts. The
    // submit_prompt action is dispatched directly to the reducer wrapper
    // (mirroring AssistantPanel.handleSubmit's two-step dispatch).
    act(() => {
      // Bypass the channel and dispatch submit_prompt straight to the
      // reducer the harness owns. We replay the action by sending an
      // out-of-band broadcast through the MockWebSocket that the hook treats
      // as a `token` event — but token alone won't set sessionToken. Instead
      // we use a small trick: seed the reducer's sessionToken by issuing a
      // submit_prompt-equivalent broadcast wrapper. Since the test harness
      // returns the live state object, we instead initialize via the hook's
      // own broadcasts: dispatch a `token` with a known session_token; the
      // reducer's session-token-filter logic accepts the first run because
      // state.sessionToken is null until submit_prompt fires.
      //
      // (When state.sessionToken === null, the reducer accepts any
      // session_token; see transcriptReducer.ts STREAM-04 branch.)
      ws.dispatchBroadcast({
        type: 'token',
        seq: 0,
        session_token: 'sess-verify-04',
        text: 'hello',
      });
    });

    // Reducer should now be in `streaming` after the token broadcast.
    expect(result.current.state.status).toBe('streaming');

    // TCP drop mid-stream: backend cannot emit STREAM-06 ensure-block
    // terminator. The hook must synthesize `connection_lost` so the reducer
    // can leave streaming state without waiting for a broadcast that will
    // never arrive.
    act(() => {
      ws.close();
    });

    // Advance wall-clock by the full 5-second VERIFY-04 budget. The hook
    // delivers the synthetic error synchronously on the close event so this
    // advance is belt-and-braces — but the assertion still proves no part of
    // the reducer takes longer than 5s.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(result.current.state.status).toBe('error');
  });

  it('VERIFY-04: 500ms gap-close timer is cleared on socket close (no spurious stream_out_of_order)', () => {
    const ws = new MockWebSocket();

    const { result } = renderHook(({ socket }) => useChannelWithReducer(socket), {
      initialProps: { socket: ws as unknown as WebSocket },
    });

    // Open a seq gap: send seq=5 with no seq=0..4 preceding it. The hook
    // arms a 500ms gap-close timer that would otherwise fire a synthetic
    // `{type:'error', source:'stream_out_of_order'}` broadcast.
    act(() => {
      ws.dispatchBroadcast({
        type: 'token',
        seq: 5,
        session_token: 'sess-gap',
        text: 'out-of-order',
      });
    });

    // Confirm the buffered message did NOT flush yet (seq=0 missing) — no
    // token row exists and the reducer is still idle.
    expect(result.current.state.rows).toHaveLength(0);
    expect(result.current.state.status).toBe('idle');

    // Close the socket BEFORE the 500ms gap-close fires. Hook cleanup MUST
    // clear the pending gap-close timer so the synthetic stream_out_of_order
    // never fires after teardown.
    act(() => {
      ws.close();
    });

    // Advance well past the gap-close window. If the timer was NOT cleared,
    // the hook would synthesize a second error with source ===
    // 'stream_out_of_order' here — failing the assertion below.
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    const oooErrors = result.current.broadcasts.filter(
      (b) => b.type === 'error' && b.source === 'stream_out_of_order',
    );
    expect(oooErrors).toHaveLength(0);

    // The connection_lost error from close should be the only error emitted.
    const connectionErrors = result.current.broadcasts.filter(
      (b) => b.type === 'error' && b.source === 'connection_lost',
    );
    expect(connectionErrors).toHaveLength(1);
  });

  it('VERIFY-04: status `error` is idempotent under further fake-timer advance after close', () => {
    const ws = new MockWebSocket();

    const { result } = renderHook(({ socket }) => useChannelWithReducer(socket), {
      initialProps: { socket: ws as unknown as WebSocket },
    });

    // Drive the reducer into streaming, then close mid-stream.
    act(() => {
      ws.dispatchBroadcast({
        type: 'token',
        seq: 0,
        session_token: 'sess-idem',
        text: 'tok',
      });
    });
    expect(result.current.state.status).toBe('streaming');

    act(() => {
      ws.close();
    });
    expect(result.current.state.status).toBe('error');

    // Capture a state snapshot BEFORE further advance; the reducer must not
    // regress out of `error` no matter how much time passes, and no
    // additional broadcasts should be synthesized after close.
    const broadcastsBefore = result.current.broadcasts.length;

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.broadcasts.length).toBe(broadcastsBefore);
  });

  it('subscribes when the socket transitions from CONNECTING to OPEN', () => {
    // Regression for the production bug where AssistantPanel mounts before
    // wsRef.current finishes its TCP handshake: the original hook returned
    // early when readyState !== OPEN and never re-ran because the WebSocket
    // object reference is stable across the CONNECTING→OPEN transition.
    const ws = new MockWebSocket();
    ws.readyState = MockWebSocket.CONNECTING;

    renderHook(({ socket }) => useChannelWithReducer(socket), {
      initialProps: { socket: ws as unknown as WebSocket },
    });

    // Pre-open: no subscribe frame should be on the wire yet.
    expect(ws.sent).toHaveLength(0);

    // Simulate the TCP handshake completing — the hook's `open` listener
    // must now fire `sendSubscribe()`.
    act(() => {
      ws.fireOpen();
    });

    expect(ws.sent).toHaveLength(1);
    const frame = JSON.parse(ws.sent[0]) as { command: string; identifier: string };
    expect(frame.command).toBe('subscribe');
    expect(frame.identifier).toBe(ASSISTANT_IDENTIFIER);
  });
});
