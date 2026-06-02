import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeviceSocket } from "./useDeviceSocket";
import { makeMockConsumer, type MockConsumer } from "./__tests__/mockConsumer";

function setup(c: MockConsumer | null) {
  const onSignaling = vi.fn();
  const onTerminalOutput = vi.fn();
  const onCommandResult = vi.fn();
  const onProcessList = vi.fn();
  const hook = renderHook(() =>
    useDeviceSocket(c as never, {
      onSignaling,
      onTerminalOutput,
      onCommandResult,
      onProcessList,
    }),
  );
  return { hook, onSignaling, onTerminalOutput, onCommandResult, onProcessList };
}

describe("useDeviceSocket (consumer)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("subscribes to CommandChannel and tracks connected", () => {
    const c = makeMockConsumer();
    const { hook } = setup(c);
    expect(c.records.map((r) => r.channel)).toContain("CommandChannel");
    expect(hook.result.current.connected).toBe(false);
    act(() => c.emitConnected("CommandChannel"));
    expect(hook.result.current.connected).toBe(true);
    act(() => c.emitDisconnected("CommandChannel", true));
    expect(hook.result.current.connected).toBe(false);
  });

  it("routes webrtc signaling to onSignaling", () => {
    const c = makeMockConsumer();
    const { onSignaling } = setup(c);
    act(() =>
      c.emitReceived("CommandChannel", { command: "webrtc.answer", payload: { sdp: "x" } }),
    );
    expect(onSignaling).toHaveBeenCalledWith("webrtc.answer", { sdp: "x" });
  });

  it("routes terminal.output to onTerminalOutput", () => {
    const c = makeMockConsumer();
    const { onTerminalOutput } = setup(c);
    act(() =>
      c.emitReceived("CommandChannel", {
        command: "terminal.output",
        payload: { data: "ls\n", sessionId: "s1", stream: "stdout" },
      }),
    );
    expect(onTerminalOutput).toHaveBeenCalledWith("ls\n", "s1", "stdout");
  });

  it("routes a process-list result to onProcessList when id was registered", () => {
    const c = makeMockConsumer();
    const { hook, onProcessList } = setup(c);
    act(() => hook.result.current.registerPendingCommand("cmd-1", "terminal.listProcesses"));
    act(() =>
      c.emitReceived("CommandChannel", {
        id: "cmd-1",
        status: "ok",
        result: [{ Pid: 1, Name: "init" }],
      }),
    );
    expect(onProcessList).toHaveBeenCalledWith([{ Pid: 1, Name: "init" }], "cmd-1");
  });

  it("sends heartbeat every 15s while connected", () => {
    const c = makeMockConsumer();
    setup(c);
    act(() => c.emitConnected("CommandChannel"));
    const sub = c.records.find((r) => r.channel === "CommandChannel")!.sub;
    act(() => vi.advanceTimersByTime(15_000));
    expect(sub.send).toHaveBeenCalledWith({ command: "heartbeat" });
  });

  it("sendMessagePayload forwards the object via subscription.send", () => {
    const c = makeMockConsumer();
    const { hook } = setup(c);
    act(() => hook.result.current.sendMessagePayload({ command: "mouse.move", payload: { x: 1 } }));
    const sub = c.records.find((r) => r.channel === "CommandChannel")!.sub;
    expect(sub.send).toHaveBeenCalledWith({ command: "mouse.move", payload: { x: 1 } });
  });
});
