// VERIFY-04 stream-drop vitest, ported to the ActionCable consumer.
// The hook synthesizes {type:'error', source:'connection_lost'} on the
// subscription's `disconnected` callback; the real transcriptReducer consumes
// it to flip status streaming -> error. Driven via the mock consumer.
import { renderHook, act } from "@testing-library/react";
import { useReducer, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAssistantChannel, type AssistantBroadcast } from "./useAssistantChannel";
import { makeMockConsumer, type MockConsumer } from "./__tests__/mockConsumer";
import {
  initialTranscriptState,
  transcriptReducer,
  type TranscriptState,
} from "src/pages/DeviceControl/components/Assistant/transcriptReducer";

function useChannelWithReducer(consumer: MockConsumer | null): {
  state: TranscriptState;
  broadcasts: AssistantBroadcast[];
} {
  const [state, dispatchTranscript] = useReducer(transcriptReducer, initialTranscriptState);
  const broadcastsRef = useRef<AssistantBroadcast[]>([]);
  useAssistantChannel({
    consumer: consumer as never,
    onBroadcast: (msg) => {
      broadcastsRef.current.push(msg);
      dispatchTranscript({ type: "broadcast", broadcast: msg });
    },
    onReconnect: () => dispatchTranscript({ type: "connection_restored" }),
  });
  return { state, broadcasts: broadcastsRef.current };
}

describe("useAssistantChannel — VERIFY-04 stream-drop (consumer)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("subscribes to AssistantChannel on mount", () => {
    const c = makeMockConsumer();
    renderHook(() => useChannelWithReducer(c));
    expect(c.records.map((r) => r.channel)).toContain("AssistantChannel");
  });

  it("flips reducer status to error within 5s of a disconnect", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() => useChannelWithReducer(c));

    act(() => {
      c.emitReceived("AssistantChannel", {
        type: "token",
        seq: 1,
        session_token: "sess-verify-04",
        content: "hello",
      });
    });
    expect(result.current.state.status).toBe("streaming");

    act(() => c.emitDisconnected("AssistantChannel", false));
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.state.status).toBe("error");
  });

  it("clears the latched connection_lost banner when the socket reconnects", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() => useChannelWithReducer(c));

    act(() => {
      c.emitReceived("AssistantChannel", {
        type: "token",
        seq: 1,
        session_token: "sess-reconnect",
        content: "hello",
      });
    });
    // Auth-refresh cycle: server rejects the stale token, ActionCable closes
    // every subscription, then reopens with a fresh token and re-confirms.
    act(() => c.emitDisconnected("AssistantChannel", false));
    expect(result.current.state.status).toBe("error");
    expect(result.current.state.error?.source).toBe("connection_lost");

    act(() => c.emitConnected("AssistantChannel"));
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.status).toBe("idle");
  });

  it("clears the 500ms gap-close timer on disconnect (no spurious stream_out_of_order)", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() => useChannelWithReducer(c));

    act(() => {
      c.emitReceived("AssistantChannel", {
        type: "token",
        seq: 5,
        session_token: "sess-gap",
        content: "out-of-order",
      });
    });
    expect(result.current.state.rows).toHaveLength(0);

    act(() => c.emitDisconnected("AssistantChannel", false));
    act(() => vi.advanceTimersByTime(2_000));

    const ooo = result.current.broadcasts.filter(
      (b) => b.type === "error" && b.source === "stream_out_of_order",
    );
    expect(ooo).toHaveLength(0);
    const lost = result.current.broadcasts.filter(
      (b) => b.type === "error" && b.source === "connection_lost",
    );
    expect(lost).toHaveLength(1);
  });

  it("resets the reorder buffer on the `accepted` marker", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() => useChannelWithReducer(c));

    act(() =>
      c.emitReceived("AssistantChannel", {
        type: "token",
        seq: 1,
        session_token: "run-a",
        content: "a",
      }),
    );
    act(() =>
      c.emitReceived("AssistantChannel", { type: "accepted", session_token: "run-b", model: "m" }),
    );
    act(() =>
      c.emitReceived("AssistantChannel", {
        type: "token",
        seq: 1,
        session_token: "run-b",
        content: "b",
      }),
    );
    const tokens = result.current.broadcasts.filter((b) => b.type === "token");
    expect(tokens).toHaveLength(2);
    // `accepted` is a control frame and must not be forwarded to the consumer.
    const accepted = result.current.broadcasts.filter(
      (b) => (b as { type?: string }).type === "accepted",
    );
    expect(accepted).toHaveLength(0);
  });

  it("emits subscription_rejected on rejection", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() => useChannelWithReducer(c));
    act(() => c.emitRejected("AssistantChannel"));
    const rejected = result.current.broadcasts.filter(
      (b) => b.type === "error" && b.source === "subscription_rejected",
    );
    expect(rejected).toHaveLength(1);
  });

  it("dispatch forwards actions via subscription.perform once confirmed", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() =>
      useAssistantChannel({ consumer: c as never, onBroadcast: () => {} }),
    );
    act(() => c.emitConnected("AssistantChannel"));
    act(() => result.current.dispatch("run_prompt", { prompt: "hi" }));
    const assistantSub = c.records.find((r) => r.channel === "AssistantChannel")!.sub;
    expect(assistantSub.perform).toHaveBeenCalledWith("run_prompt", { prompt: "hi" });
  });

  it("dispatch forwards reset_conversation via subscription.perform once confirmed", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() =>
      useAssistantChannel({ consumer: c as never, onBroadcast: () => {} }),
    );
    act(() => c.emitConnected("AssistantChannel"));
    act(() => result.current.dispatch("reset_conversation", {}));
    const assistantSub = c.records.find((r) => r.channel === "AssistantChannel")!.sub;
    expect(assistantSub.perform).toHaveBeenCalledWith("reset_conversation", {});
  });

  it("queues dispatches until the subscription confirms, then flushes in order", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() =>
      useAssistantChannel({ consumer: c as never, onBroadcast: () => {} }),
    );
    const sub = c.records.find((r) => r.channel === "AssistantChannel")!.sub;
    act(() => result.current.dispatch("run_prompt", { prompt: "hi" }));
    act(() => result.current.dispatch("stop_loop", {}));
    expect(sub.perform).not.toHaveBeenCalled();
    act(() => c.emitConnected("AssistantChannel"));
    expect(sub.perform).toHaveBeenNthCalledWith(1, "run_prompt", { prompt: "hi" });
    expect(sub.perform).toHaveBeenNthCalledWith(2, "stop_loop", {});
  });

  it("drops queued dispatches on rejection", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() =>
      useAssistantChannel({ consumer: c as never, onBroadcast: () => {} }),
    );
    const sub = c.records.find((r) => r.channel === "AssistantChannel")!.sub;
    act(() => result.current.dispatch("run_prompt", { prompt: "hi" }));
    act(() => c.emitRejected("AssistantChannel"));
    act(() => c.emitConnected("AssistantChannel"));
    expect(sub.perform).not.toHaveBeenCalled();
  });

  it("uses a unique subscription identifier per mount (nonce)", () => {
    const c = makeMockConsumer();
    const first = renderHook(() => useChannelWithReducer(c));
    first.unmount();
    renderHook(() => useChannelWithReducer(c));
    const nonces = c.records
      .filter((r) => r.channel === "AssistantChannel")
      .map((r) => r.params.nonce);
    expect(nonces.length).toBeGreaterThanOrEqual(2);
    expect(new Set(nonces).size).toBe(nonces.length);
  });

  it("unsubscribes on unmount", () => {
    const c = makeMockConsumer();
    const { unmount } = renderHook(() => useChannelWithReducer(c));
    const sub = c.records.find((r) => r.channel === "AssistantChannel")!.sub;
    unmount();
    expect(sub.unsubscribe).toHaveBeenCalledOnce();
  });
});
