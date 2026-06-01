// Verifies that a 402 response with the new envelope shape
// { data: null, meta: null, error: { code, message, details: { limit_name, … } } }
// triggers planLimitBus with a flat PlanLimitEnvelope so that Layout.tsx
// (and other consumers reading envelope.limit_name, .plan_name, .current, etc.)
// receive populated values instead of undefined.

import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import axios, { type AxiosError } from "axios";

// Mock planLimitBus BEFORE importing config so the spy is in place when the
// interceptor is registered.
vi.mock("src/utils/planLimitBus.ts", () => ({
  triggerPlanLimitNudge: vi.fn(),
}));

// Mock auth helpers — not exercised here but imported transitively by config.
vi.mock("src/utils/auth.ts", () => ({
  getAccessToken: () => null,
  getRefreshToken: () => null,
  saveTokens: vi.fn(),
}));

import { backendInstance } from "../config";
import { triggerPlanLimitNudge } from "src/utils/planLimitBus.ts";

const nudge = triggerPlanLimitNudge as Mock;

// Helper: build a minimal AxiosError that mimics what the response interceptor
// receives from axios when the server replies with an error status code.
function makeAxiosError(status: number, data: unknown): AxiosError {
  const err = new axios.AxiosError(
    `Request failed with status code ${status}`,
    String(status),
  ) as AxiosError;
  // @ts-expect-error — we are constructing a minimal mock response
  err.response = { status, data, headers: {}, config: {} };
  return err;
}

// The new backend envelope for plan-limit errors.
const planLimitEnvelope = {
  data: null,
  meta: null,
  error: {
    code: "plan_limit_reached",
    message: "You have reached your device limit.",
    details: {
      limit_name: "device_limit",
      limit: 2,
      current: 2,
      plan_name: "free",
    },
  },
};

// Reach into the registered interceptor's error handler so we can call it
// directly without a live HTTP request.
function getResponseErrorHandler() {
  // backendInstance.interceptors.response is an InterceptorManager whose
  // internal map is keyed numerically; our interceptor is the only one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manager = (backendInstance.interceptors.response as any);
  // Iterate the handlers — the first non-null fulfilled+rejected pair is ours.
  const handlers: Array<{ fulfilled: unknown; rejected: unknown }> = [];
  manager.forEach((h: { fulfilled: unknown; rejected: unknown }) => handlers.push(h));
  const { rejected } = handlers[0];
  return rejected as (error: AxiosError) => Promise<unknown>;
}

describe("402 plan-limit interceptor", () => {
  beforeEach(() => {
    nudge.mockClear();
  });

  it("calls triggerPlanLimitNudge with a flat envelope populated from details", async () => {
    const errorHandler = getResponseErrorHandler();
    const axiosErr = makeAxiosError(402, planLimitEnvelope);

    await expect(errorHandler(axiosErr)).rejects.toBeDefined();

    expect(nudge).toHaveBeenCalledTimes(1);
    const received = nudge.mock.calls[0][0];

    // Flat top-level fields the consumers expect must be populated.
    expect(received.error).toBe("plan_limit_reached");
    expect(received.limit_name).toBe("device_limit");
    expect(received.limit).toBe(2);
    expect(received.current).toBe(2);
    expect(received.plan_name).toBe("free");
  });

  it("does not call triggerPlanLimitNudge for a non-402 error", async () => {
    const errorHandler = getResponseErrorHandler();
    const axiosErr = makeAxiosError(422, {
      data: null,
      meta: null,
      error: { code: "validation_error", message: "invalid", details: {} },
    });

    await expect(errorHandler(axiosErr)).rejects.toBeDefined();

    expect(nudge).not.toHaveBeenCalled();
  });
});
