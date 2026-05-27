// useScenarioRunChannel vitest (Phase 22 Plan 06 Task 2).
//
// Mirrors the test patterns from useAssistantChannel.test.ts. The MockWebSocket
// is a hand-rolled minimal WebSocket-compatible double that surfaces the API
// the hook actually touches: readyState, send, addEventListener (message /
// close / open), removeEventListener, close. `dispatchBroadcast(inner)` injects
// a server-to-client ActionCable envelope carrying the given inner broadcast.
//
// Coverage:
//   - Subscribes with ScenarioRunChannel identifier when ws is OPEN
//   - Forwards `run_started` to onBroadcast and resets the reorder buffer
//   - Forwards in-order broadcasts immediately (seq 1, 2, 3)
//   - Buffers out-of-order broadcasts and flushes when the gap closes
//   - Forwards seqless `error` envelopes (run_in_progress transmit) directly
//   - Dispatches `start_run` as ActionCable message with the scenario_id
//   - Dispatches `stop_run` with no payload
//   - Synthesizes `connection_lost` on ws close while subscribed
//   - Unsubscribes on cleanup

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useScenarioRunChannel,
  type ScenarioRunBroadcast,
} from "./useScenarioRunChannel";

const SCENARIO_RUN_IDENTIFIER = JSON.stringify({
  channel: "ScenarioRunChannel",
});

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

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type === "message") {
      this.messageListeners.push(listener as (ev: MessageEvent) => void);
    } else if (type === "close") {
      this.closeListeners.push(listener as (ev: CloseEvent) => void);
    } else if (type === "open") {
      this.openListeners.push(listener as (ev: Event) => void);
    }
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    if (type === "message") {
      this.messageListeners = this.messageListeners.filter(
        (l) => l !== listener,
      );
    } else if (type === "close") {
      this.closeListeners = this.closeListeners.filter((l) => l !== listener);
    } else if (type === "open") {
      this.openListeners = this.openListeners.filter((l) => l !== listener);
    }
  }

  fireOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    const ev = new Event("open");
    this.openListeners.slice().forEach((l) => l(ev));
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    const ev = new CloseEvent("close");
    this.closeListeners.slice().forEach((l) => l(ev));
  }

  dispatchBroadcast(
    inner: object,
    identifier: string = SCENARIO_RUN_IDENTIFIER,
  ): void {
    const event = new MessageEvent("message", {
      data: JSON.stringify({ identifier, message: inner }),
    });
    this.messageListeners.slice().forEach((l) => l(event));
  }
}

function makeHarness() {
  const broadcasts: ScenarioRunBroadcast[] = [];
  const ws = new MockWebSocket();
  const onBroadcast = (msg: ScenarioRunBroadcast) => {
    broadcasts.push(msg);
  };
  const result = renderHook(
    ({ socket }) => useScenarioRunChannel({ socket, onBroadcast }),
    {
      initialProps: { socket: ws as unknown as WebSocket },
    },
  );
  return { ws, broadcasts, result };
}

describe("useScenarioRunChannel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("subscribes with ScenarioRunChannel identifier when ws is OPEN", () => {
    const { ws } = makeHarness();

    expect(ws.sent).toHaveLength(1);
    const frame = JSON.parse(ws.sent[0]) as {
      command: string;
      identifier: string;
    };
    expect(frame.command).toBe("subscribe");
    expect(frame.identifier).toBe(SCENARIO_RUN_IDENTIFIER);
  });

  it("forwards run_started to onBroadcast and resets the reorder buffer", () => {
    const { ws, broadcasts } = makeHarness();

    act(() => {
      ws.dispatchBroadcast({
        type: "run_started",
        seq: 1,
        session_token: "run-1",
        run_id: "run-1",
        scenario_id: "s-1",
        started_at: "2026-05-17T00:00:00Z",
        step_count: 3,
      });
    });

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].type).toBe("run_started");

    // Reset behavior: emit another run_started followed by a tool_call_start
    // with seq=1; both must be forwarded in order. Without a reset the second
    // run's seq=1 would arrive before expectedSeqRef and be skipped.
    act(() => {
      ws.dispatchBroadcast({
        type: "run_started",
        seq: 1,
        session_token: "run-2",
        run_id: "run-2",
        scenario_id: "s-2",
        started_at: "2026-05-17T00:01:00Z",
        step_count: 1,
      });
      ws.dispatchBroadcast({
        type: "tool_call_start",
        seq: 2,
        session_token: "run-2",
        tool_call_id: "tc-2-1",
        name: "run_command",
        label: "echo hi",
        args: { binary: "echo", args: ["hi"] },
      });
    });

    expect(broadcasts).toHaveLength(3);
    expect(broadcasts[1].type).toBe("run_started");
    expect(broadcasts[2].type).toBe("tool_call_start");
  });

  it("forwards in-order broadcasts immediately (seq 1, 2, 3)", () => {
    const { ws, broadcasts } = makeHarness();

    act(() => {
      ws.dispatchBroadcast({
        type: "run_started",
        seq: 1,
        session_token: "r",
        run_id: "r",
        scenario_id: "s",
        started_at: "now",
        step_count: 2,
      });
      ws.dispatchBroadcast({
        type: "tool_call_start",
        seq: 2,
        session_token: "r",
        tool_call_id: "t1",
        name: "run_command",
        label: "l",
        args: {},
      });
      ws.dispatchBroadcast({
        type: "tool_call_result",
        seq: 3,
        session_token: "r",
        tool_call_id: "t1",
        result: { exit: 0, stdout: "ok" },
      });
    });

    expect(broadcasts.map((b) => b.type)).toEqual([
      "run_started",
      "tool_call_start",
      "tool_call_result",
    ]);
  });

  it("buffers out-of-order broadcasts and flushes when the gap closes", () => {
    const { ws, broadcasts } = makeHarness();

    // Seed the run so expectedSeqRef is 2 after run_started flushes.
    act(() => {
      ws.dispatchBroadcast({
        type: "run_started",
        seq: 1,
        session_token: "r",
        run_id: "r",
        scenario_id: "s",
        started_at: "now",
        step_count: 1,
      });
    });
    expect(broadcasts).toHaveLength(1);

    // Push seq 4 then seq 3 then seq 2 → flush should yield them in 2, 3, 4 order.
    act(() => {
      ws.dispatchBroadcast({
        type: "tool_call_result",
        seq: 4,
        session_token: "r",
        tool_call_id: "t1",
        result: { exit: 0 },
      });
      ws.dispatchBroadcast({
        type: "tool_call_start",
        seq: 3,
        session_token: "r",
        tool_call_id: "t1",
        name: "run_command",
        label: "l",
        args: {},
      });
      // Gap not yet closed → nothing emitted past index 0.
    });
    expect(broadcasts).toHaveLength(1);

    act(() => {
      ws.dispatchBroadcast({
        type: "tool_call_start",
        seq: 2,
        session_token: "r",
        tool_call_id: "t0",
        name: "run_command",
        label: "l",
        args: {},
      });
    });

    // All three queued out-of-order broadcasts flush in seq order.
    expect(broadcasts).toHaveLength(4);
    const seqs = broadcasts.map((b) =>
      "seq" in b ? (b as { seq?: number }).seq : undefined,
    );
    expect(seqs).toEqual([1, 2, 3, 4]);
  });

  it("forwards seqless error envelopes (run_in_progress) directly", () => {
    const { ws, broadcasts } = makeHarness();

    act(() => {
      ws.dispatchBroadcast({
        type: "error",
        message: "run_in_progress",
      });
    });

    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].type).toBe("error");
    expect((broadcasts[0] as { message?: string }).message).toBe(
      "run_in_progress",
    );
  });

  it("dispatches start_run as ActionCable message with scenario_id", () => {
    const { ws, result } = makeHarness();

    // First sent frame was the subscribe — clear and re-test the next send.
    ws.sent.length = 0;

    act(() => {
      result.result.current.dispatch("start_run", { scenario_id: "s-1" });
    });

    expect(ws.sent).toHaveLength(1);
    const frame = JSON.parse(ws.sent[0]) as {
      command: string;
      identifier: string;
      data: string;
    };
    expect(frame.command).toBe("message");
    expect(frame.identifier).toBe(SCENARIO_RUN_IDENTIFIER);
    const inner = JSON.parse(frame.data) as {
      action: string;
      scenario_id: string;
    };
    expect(inner.action).toBe("start_run");
    expect(inner.scenario_id).toBe("s-1");
  });

  it("dispatches stop_run with no payload", () => {
    const { ws, result } = makeHarness();
    ws.sent.length = 0;

    act(() => {
      result.result.current.dispatch("stop_run");
    });

    expect(ws.sent).toHaveLength(1);
    const frame = JSON.parse(ws.sent[0]) as {
      command: string;
      identifier: string;
      data: string;
    };
    expect(frame.command).toBe("message");
    const inner = JSON.parse(frame.data) as { action: string };
    expect(inner.action).toBe("stop_run");
    // No extra keys past `action`.
    expect(Object.keys(inner)).toEqual(["action"]);
  });

  it("synthesizes connection_lost on ws close while subscribed", () => {
    const { ws, broadcasts } = makeHarness();

    act(() => {
      ws.close();
    });

    const errors = broadcasts.filter((b) => b.type === "error");
    expect(errors).toHaveLength(1);
    const err = errors[0] as { source?: string; message?: string };
    expect(err.source).toBe("connection_lost");
    expect(err.message).toBe("connection_lost");
  });

  it("unsubscribes on cleanup", () => {
    const { ws, result } = makeHarness();

    // Subscribe frame sent on mount.
    expect(ws.sent[0]).toContain("subscribe");
    ws.sent.length = 0;

    result.unmount();

    expect(ws.sent).toHaveLength(1);
    const frame = JSON.parse(ws.sent[0]) as {
      command: string;
      identifier: string;
    };
    expect(frame.command).toBe("unsubscribe");
    expect(frame.identifier).toBe(SCENARIO_RUN_IDENTIFIER);
  });
});
