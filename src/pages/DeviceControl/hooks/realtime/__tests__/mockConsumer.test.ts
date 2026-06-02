import { describe, expect, it, vi } from "vitest";
import { makeMockConsumer } from "./mockConsumer";

describe("makeMockConsumer", () => {
  it("records subscriptions by channel and returns a spy subscription", () => {
    const c = makeMockConsumer();
    const received = vi.fn();
    const sub = c.subscriptions.create({ channel: "AssistantChannel" }, { received });
    expect(typeof sub.perform).toBe("function");
    c.emitReceived("AssistantChannel", { type: "token", seq: 1 });
    expect(received).toHaveBeenCalledWith({ type: "token", seq: 1 });
  });

  it("emitDisconnected forwards willAttemptReconnect and stops the monitor when false", () => {
    const c = makeMockConsumer();
    const disconnected = vi.fn();
    c.subscriptions.create({ channel: "CommandChannel" }, { disconnected });
    c.emitDisconnected("CommandChannel", false);
    expect(disconnected).toHaveBeenCalledWith({ willAttemptReconnect: false });
    expect(c.connection.monitor.isRunning()).toBe(false);
  });

  it("emitRejected fires the rejected callback", () => {
    const c = makeMockConsumer();
    const rejected = vi.fn();
    c.subscriptions.create({ channel: "ScenarioRunChannel" }, { rejected });
    c.emitRejected("ScenarioRunChannel");
    expect(rejected).toHaveBeenCalledOnce();
  });

  it("emitConnectionClose invokes the installed connection.events.close handler", () => {
    const c = makeMockConsumer();
    const closeSpy = vi.fn();
    c.connection.events.close = closeSpy;
    c.emitConnectionClose(false);
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(c.connection.monitor.isRunning()).toBe(false);
  });
});
