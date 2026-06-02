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

  it("dispatch forwards actions via subscription.perform", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() =>
      useAssistantChannel({ consumer: c as never, onBroadcast: () => {} }),
    );
    act(() => result.current.dispatch("run_prompt", { prompt: "hi" }));
    const assistantSub = c.records.find((r) => r.channel === "AssistantChannel")!.sub;
    expect(assistantSub.perform).toHaveBeenCalledWith("run_prompt", { prompt: "hi" });
  });

  it("unsubscribes on unmount", () => {
    const c = makeMockConsumer();
    const { unmount } = renderHook(() => useChannelWithReducer(c));
    const sub = c.records.find((r) => r.channel === "AssistantChannel")!.sub;
    unmount();
    expect(sub.unsubscribe).toHaveBeenCalledOnce();
  });
});
