import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setUsageInvalidationHandler,
  triggerUsageInvalidation,
} from "../usageInvalidationBus";

describe("usageInvalidationBus", () => {
  afterEach(() => {
    setUsageInvalidationHandler(null);
    vi.useRealTimers();
  });

  it("is a safe no-op when no handler is registered", () => {
    vi.useFakeTimers();
    expect(() => triggerUsageInvalidation()).not.toThrow();
    vi.advanceTimersByTime(300);
  });

  it("invokes the registered handler after the debounce window", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    setUsageInvalidationHandler(fn);
    triggerUsageInvalidation();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("coalesces a burst of triggers into a single call", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    setUsageInvalidationHandler(fn);
    triggerUsageInvalidation();
    triggerUsageInvalidation();
    triggerUsageInvalidation();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
