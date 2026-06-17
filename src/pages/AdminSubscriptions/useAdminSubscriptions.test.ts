// Tests for useAdminSubscriptions hook
// vitest.config.ts has globals:false — all vitest APIs must be imported explicitly.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import React from "react";

import { SubscriptionContext } from "src/contexts/SubscriptionContext";
import type { SubscriptionContextValue, Plan } from "src/services/backend/subscriptionService";
import { useAdminSubscriptions } from "./useAdminSubscriptions";
import type { SubscriptionAdminRow, BillingHistoryEvent } from "src/services/backend/adminSubscriptionsService";

// ---- Mocks ----------------------------------------------------------------

const stableT = (k: string) => k;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: stableT }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
const mockToastWarning = vi.fn();
// Stable object — same reference every render to avoid re-triggering useEffect deps
const stableToast = {
  success: mockToastSuccess,
  error: mockToastError,
  info: mockToastInfo,
  warning: mockToastWarning,
};
vi.mock("src/components/ui/Toast", () => ({
  useToast: () => stableToast,
}));

const mockList = vi.fn();
const mockBillingHistory = vi.fn();
const mockCancel = vi.fn();
const mockOverride = vi.fn();
vi.mock("src/services/backend/adminSubscriptionsService", () => ({
  adminSubscriptionsService: {
    list: (...args: unknown[]) => mockList(...args),
    billingHistory: (...args: unknown[]) => mockBillingHistory(...args),
    cancel: (...args: unknown[]) => mockCancel(...args),
    override: (...args: unknown[]) => mockOverride(...args),
  },
}));

const mockUsersList = vi.fn();
vi.mock("src/services/backend/usersService", () => ({
  usersService: {
    list: (...args: unknown[]) => mockUsersList(...args),
  },
}));

// ---- Helpers ----------------------------------------------------------------

const STUB_PLANS: Plan[] = [
  { id: "1", name: "free", monthly_price: 0, currency: "UAH" },
  { id: "2", name: "pro", monthly_price: 19900, currency: "UAH" },
];

function makeContextValue(plans: Plan[] = STUB_PLANS): SubscriptionContextValue {
  return {
    status: null,
    usage: null,
    plans,
    loading: false,
    error: null,
    refresh: () => undefined,
  };
}

function wrapper(plans = STUB_PLANS) {
  return function WrapperComponent({ children }: { children: React.ReactNode }) {
    return React.createElement(
      SubscriptionContext.Provider,
      { value: makeContextValue(plans) },
      children,
    );
  };
}

function makeRow(id: string): SubscriptionAdminRow {
  return {
    id,
    user_id: `user-${id}`,
    state: "active",
    plan_name: "pro",
    period_start: "2024-01-01",
    period_end: "2025-01-01",
    scheduled_plan: null,
    price: 19900,
    currency: "UAH",
    is_comp: false,
    created_at: "2024-01-01T00:00:00Z",
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---- Tests ------------------------------------------------------------------

describe("useAdminSubscriptions — load on mount", () => {
  beforeEach(() => {
    mockList.mockResolvedValue({ subscriptions: [makeRow("sub-1")], meta: null });
    mockUsersList.mockResolvedValue([{ id: 42, username: "alice", email: "a@example.com" }]);
  });

  it("calls list and usersService.list on mount; loading toggles", async () => {
    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockList).toHaveBeenCalled();
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, per_page: 200 }),
    );
    expect(mockUsersList).toHaveBeenCalled();
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].id).toBe("sub-1");
  });

  it("exposes plans from SubscriptionContext", async () => {
    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(STUB_PLANS),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plans).toEqual(STUB_PLANS);
  });
});

describe("useAdminSubscriptions — error handling", () => {
  it("toasts errors.loadFailed when list rejects", async () => {
    mockList.mockRejectedValue(new Error("network"));
    mockUsersList.mockResolvedValue([]);

    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockToastError).toHaveBeenCalledWith("errors.loadFailed");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it("loadUsers rejection is silent (no toast fired)", async () => {
    mockList.mockResolvedValue({ subscriptions: [], meta: null });
    mockUsersList.mockRejectedValue(new Error("users failed"));

    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

describe("useAdminSubscriptions — filter re-runs loadSubscriptions", () => {
  beforeEach(() => {
    mockList.mockResolvedValue({ subscriptions: [], meta: null });
    mockUsersList.mockResolvedValue([]);
  });

  it("re-runs loadSubscriptions when stateFilter changes", async () => {
    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsBefore = mockList.mock.calls.length;

    act(() => {
      result.current.setStateFilter("active");
    });

    await waitFor(() => expect(mockList.mock.calls.length).toBeGreaterThan(callsBefore));
    const lastCall = mockList.mock.calls[mockList.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(lastCall.state).toBe("active");
  });

  it("re-runs loadSubscriptions when planIdFilter changes", async () => {
    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsBefore = mockList.mock.calls.length;

    act(() => {
      result.current.setPlanIdFilter("plan-pro");
    });

    await waitFor(() => expect(mockList.mock.calls.length).toBeGreaterThan(callsBefore));
    const lastCall = mockList.mock.calls[mockList.mock.calls.length - 1][0] as Record<string, unknown>;
    expect(lastCall.plan_id).toBe("plan-pro");
  });
});

describe("useAdminSubscriptions — billing history cache", () => {
  beforeEach(() => {
    mockList.mockResolvedValue({ subscriptions: [makeRow("row-A")], meta: null });
    mockUsersList.mockResolvedValue([]);
  });

  it("lazy-loads billing history once per row on toggleExpand (cache short-circuits second call)", async () => {
    const events: BillingHistoryEvent[] = [
      { event_type: "activate", from_state: null, to_state: "active", created_at: "2024-01-01T00:00:00Z" },
    ];
    mockBillingHistory.mockResolvedValue(events);

    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // First expand: should call billingHistory
    act(() => {
      result.current.toggleExpand("row-A");
    });

    await waitFor(() =>
      expect(result.current.billingHistoryByRow["row-A"]).toBeDefined(),
    );

    expect(mockBillingHistory).toHaveBeenCalledOnce();

    // Collapse
    act(() => {
      result.current.toggleExpand("row-A");
    });

    // Second expand: cache should short-circuit — billingHistory still called only once
    act(() => {
      result.current.toggleExpand("row-A");
    });

    await waitFor(() =>
      expect(result.current.expandedRowId).toBe("row-A"),
    );

    expect(mockBillingHistory).toHaveBeenCalledOnce();
  });

  it("toasts errors.billingHistoryFailed on billing error", async () => {
    mockBillingHistory.mockRejectedValue(new Error("billing fail"));

    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.toggleExpand("row-A");
    });

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("errors.billingHistoryFailed"),
    );
  });
});

describe("useAdminSubscriptions — handleCancelConfirm", () => {
  beforeEach(() => {
    mockList.mockResolvedValue({ subscriptions: [makeRow("sub-1")], meta: null });
    mockUsersList.mockResolvedValue([]);
  });

  it("noop when cancelTarget is null", async () => {
    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleCancelConfirm();
    });

    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("success: toasts messages.cancelled, clears cancelTarget, reloads", async () => {
    mockCancel.mockResolvedValue({ status: "ok" });

    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Set cancel target and wait for state to settle
    act(() => {
      result.current.setCancelTarget(makeRow("sub-1"));
    });

    await waitFor(() => expect(result.current.cancelTarget).not.toBeNull());

    // Now call handleCancelConfirm — cancelTarget is non-null so it proceeds
    await act(async () => {
      await result.current.handleCancelConfirm();
    });

    await waitFor(() => expect(result.current.cancelling).toBe(false));

    expect(mockCancel).toHaveBeenCalledWith("sub-1");
    expect(mockToastSuccess).toHaveBeenCalledWith("messages.cancelled");
    expect(result.current.cancelTarget).toBeNull();
    expect(result.current.cancelling).toBe(false);
  });

  it("error: toasts errors.cancelFailed; cancelling reset in finally", async () => {
    mockCancel.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Set cancel target and wait for state to settle
    act(() => {
      result.current.setCancelTarget(makeRow("sub-1"));
    });

    await waitFor(() => expect(result.current.cancelTarget).not.toBeNull());

    await act(async () => {
      await result.current.handleCancelConfirm();
    });

    await waitFor(() => expect(result.current.cancelling).toBe(false));

    expect(mockToastError).toHaveBeenCalledWith("errors.cancelFailed");
    expect(result.current.cancelling).toBe(false);
  });
});

describe("useAdminSubscriptions — handleOverride", () => {
  beforeEach(() => {
    mockList.mockResolvedValue({ subscriptions: [], meta: null });
    mockUsersList.mockResolvedValue([]);
  });

  it("success: toasts messages.overridden and reloads", async () => {
    mockOverride.mockResolvedValue({ status: "ok" });

    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleOverride({ user_id: "u1", plan_id: "p2" });
    });

    expect(mockOverride).toHaveBeenCalledWith({ user_id: "u1", plan_id: "p2" });
    expect(mockToastSuccess).toHaveBeenCalledWith("messages.overridden");
    expect(result.current.overrideLoading).toBe(false);
  });

  it("error: toasts errors.overrideFailed; overrideLoading reset", async () => {
    mockOverride.mockRejectedValue(new Error("override fail"));

    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleOverride({ user_id: "u1", plan_id: "p2" });
    });

    expect(mockToastError).toHaveBeenCalledWith("errors.overrideFailed");
    expect(result.current.overrideLoading).toBe(false);
  });
});

describe("useAdminSubscriptions — userNameById", () => {
  it("maps users[].id -> username", async () => {
    mockList.mockResolvedValue({ subscriptions: [], meta: null });
    mockUsersList.mockResolvedValue([
      { id: 10, username: "alice", email: "a@example.com" },
      { id: 20, username: "bob", email: "b@example.com" },
    ]);

    const { result } = renderHook(() => useAdminSubscriptions(), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.users).toHaveLength(2));

    expect(result.current.userNameById["10"]).toBe("alice");
    expect(result.current.userNameById["20"]).toBe("bob");
  });
});
