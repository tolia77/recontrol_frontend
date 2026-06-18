// Tests for useGate hook — covers all five gates, fail-open, unlimited, and requiredPlan logic.
// vitest.config.ts has globals:false — all vitest APIs must be imported explicitly.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import React from "react";
import { useGate } from "../useGate";

// Mock context

import { SubscriptionContext } from "src/contexts/SubscriptionContext";
import type { SubscriptionContextValue } from "src/services/backend/subscriptionService";
import type { Plan, SubscriptionUsage, SubscriptionStatus } from "src/services/backend/subscriptionService";

const STUB_PLANS: Plan[] = [
  { id: "1", name: "free",     monthly_price: 0,      currency: "UAH" },
  { id: "2", name: "pro",      monthly_price: 19900,  currency: "UAH" },
  { id: "3", name: "advanced", monthly_price: 49900,  currency: "UAH" },
  { id: "4", name: "business", monthly_price: 99900,  currency: "UAH" },
];

function makeStatus(plan_name: "free" | "pro" | "advanced" | "business"): SubscriptionStatus {
  return {
    state: "active",
    plan_name,
    period_end: null,
    scheduled_plan: null,
    price: null,
    currency: null,
  };
}

function makeUsage(overrides: Partial<SubscriptionUsage> = {}): SubscriptionUsage {
  return {
    devices_used: 0,
    device_limit: 2,
    scenarios_used: 0,
    scenario_limit: 3,
    ai_tokens_used: 0,
    ai_token_limit: null,
    ai_drafts_used: 0,
    ai_draft_limit: 30,
    device_sharing: true,
    ai_access: true,
    ...overrides,
  };
}

function makeContextValue(
  usage: SubscriptionUsage | null,
  status: SubscriptionStatus | null = makeStatus("free"),
  plans: Plan[] = STUB_PLANS,
): SubscriptionContextValue {
  return {
    status,
    usage,
    plans,
    loading: false,
    error: null,
    refresh: () => undefined,
  };
}

function wrapper(contextValue: SubscriptionContextValue) {
  return function WrapperComponent({ children }: { children: React.ReactNode }) {
    return React.createElement(
      SubscriptionContext.Provider,
      { value: contextValue },
      children,
    );
  };
}

afterEach(() => cleanup());

// Tests

describe("useGate — fail-open passthrough", () => {
  it("returns allowed:true, reason:null when usage is null (loading)", () => {
    const ctx = makeContextValue(null);
    const { result } = renderHook(() => useGate("device_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(true);
    expect(result.current.reason).toBeNull();
  });
});

describe("useGate — boolean gate: device_sharing", () => {
  it("device_sharing=false → allowed:false, reason:'feature', requiredPlan:'pro'", () => {
    const ctx = makeContextValue(makeUsage({ device_sharing: false }));
    const { result } = renderHook(() => useGate("device_sharing"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(false);
    expect(result.current.reason).toBe("feature");
    expect(result.current.requiredPlan).toBe("pro");
  });

  it("device_sharing=true → allowed:true, reason:null", () => {
    const ctx = makeContextValue(makeUsage({ device_sharing: true }));
    const { result } = renderHook(() => useGate("device_sharing"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(true);
    expect(result.current.reason).toBeNull();
  });

  it("requiredPlan when defined is a member of the stub plans catalog names", () => {
    const ctx = makeContextValue(makeUsage({ device_sharing: false }));
    const { result } = renderHook(() => useGate("device_sharing"), {
      wrapper: wrapper(ctx),
    });
    const planNames = STUB_PLANS.map((p) => p.name);
    expect(planNames).toContain(result.current.requiredPlan);
  });
});

describe("useGate — boolean gate: ai_access", () => {
  it("ai_access=false → allowed:false, reason:'feature'", () => {
    const ctx = makeContextValue(makeUsage({ ai_access: false }));
    const { result } = renderHook(() => useGate("ai_access"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(false);
    expect(result.current.reason).toBe("feature");
    expect(result.current.requiredPlan).toBeDefined();
  });

  it("ai_access=true → allowed:true, reason:null", () => {
    const ctx = makeContextValue(makeUsage({ ai_access: true }));
    const { result } = renderHook(() => useGate("ai_access"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(true);
    expect(result.current.reason).toBeNull();
  });
});

describe("useGate — count gate: device_limit", () => {
  it("devices_used >= device_limit → allowed:false, reason:'count', returns current + limit", () => {
    const ctx = makeContextValue(
      makeUsage({ devices_used: 2, device_limit: 2 }),
    );
    const { result } = renderHook(() => useGate("device_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(false);
    expect(result.current.reason).toBe("count");
    expect(result.current.current).toBe(2);
    expect(result.current.limit).toBe(2);
  });

  it("devices_used < device_limit → allowed:true", () => {
    const ctx = makeContextValue(
      makeUsage({ devices_used: 1, device_limit: 2 }),
    );
    const { result } = renderHook(() => useGate("device_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(true);
  });

  it("device_limit=null (unlimited) → allowed:true", () => {
    const ctx = makeContextValue(
      makeUsage({ devices_used: 999, device_limit: null }),
    );
    const { result } = renderHook(() => useGate("device_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(true);
  });
});

describe("useGate — count gate: scenario_limit", () => {
  it("scenarios_used >= scenario_limit → allowed:false", () => {
    const ctx = makeContextValue(
      makeUsage({ scenarios_used: 3, scenario_limit: 3 }),
    );
    const { result } = renderHook(() => useGate("scenario_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(false);
    expect(result.current.reason).toBe("count");
  });

  it("scenario_limit=null (unlimited) → allowed:true", () => {
    const ctx = makeContextValue(
      makeUsage({ scenarios_used: 100, scenario_limit: null }),
    );
    const { result } = renderHook(() => useGate("scenario_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(true);
  });
});

describe("useGate — count gate: ai_draft_daily_limit", () => {
  it("ai_drafts_used >= ai_draft_limit → allowed:false", () => {
    const ctx = makeContextValue(
      makeUsage({ ai_drafts_used: 30, ai_draft_limit: 30 }),
    );
    const { result } = renderHook(() => useGate("ai_draft_daily_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(false);
    expect(result.current.reason).toBe("count");
  });

  it("ai_draft_limit=null (unlimited) → allowed:true", () => {
    const ctx = makeContextValue(
      makeUsage({ ai_drafts_used: 999, ai_draft_limit: null }),
    );
    const { result } = renderHook(() => useGate("ai_draft_daily_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(true);
  });
});

describe("useGate — count-gate requiredPlan uses tier ORDERING", () => {
  it("FREE user at a count cap → requiredPlan === 'pro' (cheapest paid tier above free)", () => {
    // status null → treated as free
    const ctx = makeContextValue(
      makeUsage({ devices_used: 2, device_limit: 2 }),
      null, // null status = free
    );
    const { result } = renderHook(() => useGate("device_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(false);
    expect(result.current.requiredPlan).toBe("pro");
  });

  it("FREE user (explicit plan_name:'free') at a count cap → requiredPlan === 'pro'", () => {
    const ctx = makeContextValue(
      makeUsage({ devices_used: 2, device_limit: 2 }),
      makeStatus("free"),
    );
    const { result } = renderHook(() => useGate("device_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.requiredPlan).toBe("pro");
  });

  it("PRO user at a count cap → requiredPlan === 'advanced' (NOT 'pro')", () => {
    const ctx = makeContextValue(
      makeUsage({ devices_used: 10, device_limit: 10 }),
      makeStatus("pro"),
    );
    const { result } = renderHook(() => useGate("device_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.requiredPlan).toBe("advanced");
    // Must NOT return the current plan
    expect(result.current.requiredPlan).not.toBe("pro");
  });

  it("ADVANCED user at a count cap → requiredPlan === 'business'", () => {
    const ctx = makeContextValue(
      makeUsage({ scenarios_used: 50, scenario_limit: 50 }),
      makeStatus("advanced"),
    );
    const { result } = renderHook(() => useGate("scenario_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.requiredPlan).toBe("business");
  });

  it("BUSINESS user at a count cap → requiredPlan === undefined (top tier, no upgrade exists)", () => {
    const ctx = makeContextValue(
      makeUsage({ devices_used: 100, device_limit: 100 }),
      makeStatus("business"),
    );
    const { result } = renderHook(() => useGate("device_limit"), {
      wrapper: wrapper(ctx),
    });
    expect(result.current.allowed).toBe(false);
    expect(result.current.requiredPlan).toBeUndefined();
  });

  it("count-gate requiredPlan, when defined, is a member of the stub plans catalog names", () => {
    const ctx = makeContextValue(
      makeUsage({ devices_used: 2, device_limit: 2 }),
      makeStatus("free"),
    );
    const { result } = renderHook(() => useGate("device_limit"), {
      wrapper: wrapper(ctx),
    });
    if (result.current.requiredPlan !== undefined) {
      const planNames = STUB_PLANS.map((p) => p.name);
      expect(planNames).toContain(result.current.requiredPlan);
    }
  });
});
