import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useScenarioRunChannel,
  type ScenarioRunBroadcast,
} from "./useScenarioRunChannel";
import { makeMockConsumer, type MockConsumer } from "./__tests__/mockConsumer";

function useRecorder(consumer: MockConsumer | null) {
  const broadcasts: ScenarioRunBroadcast[] = [];
  const { dispatch } = useScenarioRunChannel({
    consumer: consumer as never,
    onBroadcast: (m) => broadcasts.push(m),
  });
  return { broadcasts, dispatch };
}

describe("useScenarioRunChannel (consumer)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("subscribes to ScenarioRunChannel on mount", () => {
    const c = makeMockConsumer();
    renderHook(() => useRecorder(c));
    expect(c.records.map((r) => r.channel)).toContain("ScenarioRunChannel");
  });

  it("forwards seqless error envelopes directly (run_in_progress rejection)", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() => useRecorder(c));
    act(() =>
      c.emitReceived("ScenarioRunChannel", { type: "error", message: "run_in_progress" }),
    );
    expect(result.current.broadcasts).toEqual([{ type: "error", message: "run_in_progress" }]);
  });

  it("resets the buffer on run_started", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() => useRecorder(c));
    act(() =>
      c.emitReceived("ScenarioRunChannel", {
        type: "run_started",
        seq: 1,
        session_token: "s",
        run_id: "r1",
        scenario_id: "sc1",
        started_at: "t",
        step_count: 1,
      }),
    );
    act(() =>
      c.emitReceived("ScenarioRunChannel", {
        type: "run_started",
        seq: 1,
        session_token: "s",
        run_id: "r2",
        scenario_id: "sc1",
        started_at: "t",
        step_count: 1,
      }),
    );
    const started = result.current.broadcasts.filter((b) => b.type === "run_started");
    expect(started).toHaveLength(2);
  });

  it("synthesizes connection_lost with a message on disconnect", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() => useRecorder(c));
    act(() => c.emitDisconnected("ScenarioRunChannel", false));
    const lost = result.current.broadcasts.find(
      (b) => b.type === "error" && b.source === "connection_lost",
    );
    expect(lost).toMatchObject({ source: "connection_lost", message: "connection_lost" });
  });

  it("emits subscription_rejected on rejection", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() => useRecorder(c));
    act(() => c.emitRejected("ScenarioRunChannel"));
    const rejected = result.current.broadcasts.find(
      (b) => b.type === "error" && b.source === "subscription_rejected",
    );
    expect(rejected).toMatchObject({ source: "subscription_rejected" });
  });

  it("dispatch forwards via subscription.perform", () => {
    const c = makeMockConsumer();
    const { result } = renderHook(() => useRecorder(c));
    act(() => result.current.dispatch("start_run", { scenario_id: "sc1" }));
    const sub = c.records.find((r) => r.channel === "ScenarioRunChannel")!.sub;
    expect(sub.perform).toHaveBeenCalledWith("start_run", { scenario_id: "sc1" });
  });

  it("unsubscribes on unmount", () => {
    const c = makeMockConsumer();
    const { unmount } = renderHook(() => useRecorder(c));
    const sub = c.records.find((r) => r.channel === "ScenarioRunChannel")!.sub;
    unmount();
    expect(sub.unsubscribe).toHaveBeenCalledOnce();
  });
});
