import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockConsumer, type MockConsumer } from "./__tests__/mockConsumer";
import type { CableConsumerLike } from "./useCableConsumer";

// Token helpers are module singletons; mock them so the hook is deterministic.
const getAccessToken = vi.fn<() => string | null>(() => "tok-current");
const refreshAccessTokenOnce = vi.fn(async () => "tok-refreshed");
vi.mock("src/utils/auth", () => ({ getAccessToken: () => getAccessToken() }));
vi.mock("src/services/backend/config", () => ({
  refreshAccessTokenOnce: () => refreshAccessTokenOnce(),
}));

import { useCableConsumer } from "./useCableConsumer";

describe("useCableConsumer", () => {
  let mock: MockConsumer;
  let urlFn: () => string;
  const createConsumerFn = vi.fn((fn: () => string): CableConsumerLike => {
    urlFn = fn;
    return mock as unknown as CableConsumerLike;
  });

  beforeEach(() => {
    mock = makeMockConsumer();
    getAccessToken.mockReturnValue("tok-current");
    refreshAccessTokenOnce.mockClear();
    createConsumerFn.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("does not create a consumer until deviceId is known", () => {
    renderHook(({ id }) => useCableConsumer("ws://x/cable", id, createConsumerFn), {
      initialProps: { id: null as string | null },
    });
    expect(createConsumerFn).not.toHaveBeenCalled();
  });

  it("builds a url function carrying the current token and device id", () => {
    renderHook(() => useCableConsumer("ws://x/cable", "dev-1", createConsumerFn));
    expect(createConsumerFn).toHaveBeenCalledOnce();
    expect(urlFn()).toBe("ws://x/cable?access_token=tok-current&device_id=dev-1");
    getAccessToken.mockReturnValue("tok-next");
    expect(urlFn()).toBe("ws://x/cable?access_token=tok-next&device_id=dev-1");
  });

  it("refreshes the token and reopens on a terminal disconnect (willAttemptReconnect=false)", async () => {
    renderHook(() => useCableConsumer("ws://x/cable", "dev-1", createConsumerFn));
    await act(async () => {
      mock.emitConnectionClose(false);
      await Promise.resolve();
    });
    expect(refreshAccessTokenOnce).toHaveBeenCalledOnce();
    expect(mock.connect).toHaveBeenCalledOnce();
  });

  it("does NOT refresh on a transient disconnect (willAttemptReconnect=true)", async () => {
    renderHook(() => useCableConsumer("ws://x/cable", "dev-1", createConsumerFn));
    await act(async () => {
      mock.emitConnectionClose(true);
      await Promise.resolve();
    });
    expect(refreshAccessTokenOnce).not.toHaveBeenCalled();
    expect(mock.connect).not.toHaveBeenCalled();
  });

  it("disconnects the consumer on unmount", () => {
    const { unmount } = renderHook(() =>
      useCableConsumer("ws://x/cable", "dev-1", createConsumerFn),
    );
    unmount();
    expect(mock.disconnect).toHaveBeenCalledOnce();
  });

  it("does NOT refresh on the close that follows an intentional unmount disconnect", async () => {
    const { unmount } = renderHook(() =>
      useCableConsumer("ws://x/cable", "dev-1", createConsumerFn),
    );
    unmount();
    // The browser fires the WebSocket close asynchronously, after cleanup ran
    // disconnect() (which stops the monitor). The wrapper must treat this as an
    // intentional teardown and NOT refresh/reopen a zombie connection.
    await act(async () => {
      mock.emitConnectionClose(false);
      await Promise.resolve();
    });
    expect(refreshAccessTokenOnce).not.toHaveBeenCalled();
    expect(mock.connect).not.toHaveBeenCalled();
  });
});
