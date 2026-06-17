// Tests for useAdminAiUsage hook — pure transforms + load/error paths.
// vitest.config.ts has globals:false — all vitest APIs must be imported explicitly.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import { useAdminAiUsage } from "./useAdminAiUsage";
import type { AiUsageRow } from "src/services/backend/adminAiUsageService";

// ---- Mocks ----------------------------------------------------------------

const stableT = (k: string) => k;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: stableT }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const stableToast = {
  success: mockToastSuccess,
  error: mockToastError,
  info: vi.fn(),
  warning: vi.fn(),
};
vi.mock("src/components/ui/Toast", () => ({
  useToast: () => stableToast,
}));

const mockIndex = vi.fn();
vi.mock("src/services/backend/adminAiUsageService", () => ({
  adminAiUsageService: {
    index: (...args: unknown[]) => mockIndex(...args),
  },
}));

// ---- Helpers ----------------------------------------------------------------

function makeRow(overrides: Partial<AiUsageRow> & Pick<AiUsageRow, "user_id" | "day">): AiUsageRow {
  return {
    username: `user-${overrides.user_id}`,
    total_tokens: 100,
    session_count: 1,
    top_model: "gpt-4",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ---- Tests ------------------------------------------------------------------

describe("useAdminAiUsage — load on mount", () => {
  beforeEach(() => {
    mockIndex.mockResolvedValue([]);
  });

  it("calls adminAiUsageService.index on mount; loading toggles", async () => {
    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockIndex).toHaveBeenCalled();
  });

  it("error -> toast.error(errors.loadFailed)", async () => {
    mockIndex.mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockToastError).toHaveBeenCalledWith("errors.loadFailed");
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});

describe("useAdminAiUsage — default dates (frozen time)", () => {
  it("computes default dates as today and today-30d (ISO YYYY-MM-DD)", async () => {
    // Only freeze Date, not timers — preserves promise resolution + waitFor polling
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    mockIndex.mockResolvedValue([]);

    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.toDate).toBe("2024-06-15");
    expect(result.current.fromDate).toBe("2024-05-16"); // 30 days before
  });
});

describe("useAdminAiUsage — date filter", () => {
  it("filters rows to day >= fromDate && day <= toDate", async () => {
    mockIndex.mockResolvedValue([
      makeRow({ user_id: "u1", day: "2024-01-01" }),
      makeRow({ user_id: "u2", day: "2024-03-15" }),
      makeRow({ user_id: "u3", day: "2024-06-01" }),
    ]);

    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Set date range to only include the middle row
    act(() => {
      result.current.setFromDate("2024-03-01");
      result.current.setToDate("2024-04-30");
    });

    await waitFor(() => {
      expect(result.current.perUserRows).toHaveLength(1);
    });

    expect(result.current.perUserRows[0].user_id).toBe("u2");
  });
});

describe("useAdminAiUsage — group-by-user aggregation", () => {
  it("aggregates total_tokens and session_count per user_id across multiple rows", async () => {
    mockIndex.mockResolvedValue([
      makeRow({ user_id: "u1", username: "alice", day: "2024-03-01", total_tokens: 500, session_count: 2, top_model: "gpt-4" }),
      makeRow({ user_id: "u1", username: "alice", day: "2024-03-02", total_tokens: 300, session_count: 1, top_model: "gpt-4" }),
      makeRow({ user_id: "u2", username: "bob",   day: "2024-03-01", total_tokens: 200, session_count: 1, top_model: "claude" }),
    ]);

    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Set narrow date range to match all rows
    act(() => {
      result.current.setFromDate("2024-03-01");
      result.current.setToDate("2024-03-31");
    });

    await waitFor(() => expect(result.current.perUserRows).toHaveLength(2));

    // Find alice row
    const alice = result.current.perUserRows.find((r) => r.user_id === "u1");
    expect(alice).toBeDefined();
    expect(alice!.total_tokens).toBe(800); // 500 + 300
    expect(alice!.session_count).toBe(3);  // 2 + 1
    expect(alice!.username).toBe("alice");

    // Find bob row
    const bob = result.current.perUserRows.find((r) => r.user_id === "u2");
    expect(bob).toBeDefined();
    expect(bob!.total_tokens).toBe(200);
    expect(bob!.session_count).toBe(1);
  });

  it("top_model picks max summed tokens (tie -> first encountered)", async () => {
    // Design: u1 has gpt-4 (300 tokens) and claude (200 tokens) — gpt-4 wins
    // Tie case: u2 has model-A (100 tokens) and model-B (100 tokens) — model-A wins (first encountered)
    mockIndex.mockResolvedValue([
      makeRow({ user_id: "u1", username: "alice", day: "2024-03-01", total_tokens: 300, session_count: 1, top_model: "gpt-4" }),
      makeRow({ user_id: "u1", username: "alice", day: "2024-03-02", total_tokens: 200, session_count: 1, top_model: "claude" }),
      // Tie: model-A first, then model-B with equal tokens
      makeRow({ user_id: "u2", username: "bob",   day: "2024-03-01", total_tokens: 100, session_count: 1, top_model: "model-A" }),
      makeRow({ user_id: "u2", username: "bob",   day: "2024-03-02", total_tokens: 100, session_count: 1, top_model: "model-B" }),
    ]);

    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFromDate("2024-03-01");
      result.current.setToDate("2024-03-31");
    });

    await waitFor(() => expect(result.current.perUserRows).toHaveLength(2));

    const alice = result.current.perUserRows.find((r) => r.user_id === "u1");
    expect(alice!.top_model).toBe("gpt-4"); // 300 > 200

    const bob = result.current.perUserRows.find((r) => r.user_id === "u2");
    // Tie: model-A was first encountered, so it's retained when model-B ties
    // The SUT uses reduce with `cur[1] > best[1]` (strict >) so tie keeps first
    expect(bob!.top_model).toBe("model-A");
  });
});

describe("useAdminAiUsage — setSort", () => {
  beforeEach(() => {
    mockIndex.mockResolvedValue([
      makeRow({ user_id: "u1", username: "alice", day: "2024-03-01", total_tokens: 500, session_count: 3, top_model: "gpt-4" }),
      makeRow({ user_id: "u2", username: "charlie", day: "2024-03-01", total_tokens: 100, session_count: 1, top_model: "claude" }),
      makeRow({ user_id: "u3", username: "bob", day: "2024-03-01", total_tokens: 300, session_count: 2, top_model: "gpt-3" }),
    ]);
  });

  it("initial sort is total_tokens desc", async () => {
    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFromDate("2024-03-01");
      result.current.setToDate("2024-03-31");
    });

    await waitFor(() => expect(result.current.perUserRows).toHaveLength(3));

    expect(result.current.sortKey).toBe("total_tokens");
    expect(result.current.sortDir).toBe("desc");
    // u1 (500) > u3 (300) > u2 (100)
    expect(result.current.perUserRows[0].user_id).toBe("u1");
    expect(result.current.perUserRows[1].user_id).toBe("u3");
    expect(result.current.perUserRows[2].user_id).toBe("u2");
  });

  it("same key toggles asc/desc (numeric sort)", async () => {
    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFromDate("2024-03-01");
      result.current.setToDate("2024-03-31");
    });

    await waitFor(() => expect(result.current.perUserRows).toHaveLength(3));

    // Initial: total_tokens desc
    expect(result.current.sortDir).toBe("desc");

    // Toggle same key: should flip to asc
    act(() => {
      result.current.setSort("total_tokens");
    });

    await waitFor(() => expect(result.current.sortDir).toBe("asc"));
    expect(result.current.sortKey).toBe("total_tokens");
    // asc: u2 (100) < u3 (300) < u1 (500)
    expect(result.current.perUserRows[0].user_id).toBe("u2");
    expect(result.current.perUserRows[2].user_id).toBe("u1");

    // Toggle again: back to desc
    act(() => {
      result.current.setSort("total_tokens");
    });

    await waitFor(() => expect(result.current.sortDir).toBe("desc"));
  });

  it("new key sets key + desc (string sort via localeCompare)", async () => {
    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFromDate("2024-03-01");
      result.current.setToDate("2024-03-31");
    });

    await waitFor(() => expect(result.current.perUserRows).toHaveLength(3));

    // Switch to username sort
    act(() => {
      result.current.setSort("username");
    });

    await waitFor(() => expect(result.current.sortKey).toBe("username"));
    expect(result.current.sortDir).toBe("desc");
    // desc alphabetical: charlie > bob > alice (z..a)
    expect(result.current.perUserRows[0].username).toBe("charlie");
    expect(result.current.perUserRows[1].username).toBe("bob");
    expect(result.current.perUserRows[2].username).toBe("alice");
  });

  it("numeric sort: session_count desc", async () => {
    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFromDate("2024-03-01");
      result.current.setToDate("2024-03-31");
    });

    await waitFor(() => expect(result.current.perUserRows).toHaveLength(3));

    act(() => {
      result.current.setSort("session_count");
    });

    await waitFor(() => expect(result.current.sortKey).toBe("session_count"));
    expect(result.current.sortDir).toBe("desc");
    // desc: u1 (3) > u3 (2) > u2 (1)
    expect(result.current.perUserRows[0].user_id).toBe("u1");
    expect(result.current.perUserRows[1].user_id).toBe("u3");
    expect(result.current.perUserRows[2].user_id).toBe("u2");
  });
});

describe("useAdminAiUsage — summary", () => {
  it("computes totalTokens, totalSessions, uniqueUsers (distinct), topModel over filtered set", async () => {
    mockIndex.mockResolvedValue([
      makeRow({ user_id: "u1", username: "alice",   day: "2024-03-01", total_tokens: 500, session_count: 2, top_model: "gpt-4" }),
      makeRow({ user_id: "u1", username: "alice",   day: "2024-03-02", total_tokens: 300, session_count: 1, top_model: "gpt-4" }),
      makeRow({ user_id: "u2", username: "bob",     day: "2024-03-01", total_tokens: 200, session_count: 1, top_model: "claude" }),
      // Out of range — must NOT be included in summary
      makeRow({ user_id: "u3", username: "charlie", day: "2023-12-01", total_tokens: 999, session_count: 5, top_model: "llama" }),
    ]);

    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFromDate("2024-03-01");
      result.current.setToDate("2024-03-31");
    });

    await waitFor(() => expect(result.current.perUserRows).toHaveLength(2));

    const { summary } = result.current;

    // totalTokens: 500 + 300 + 200 = 1000
    expect(summary.totalTokens).toBe(1000);
    // totalSessions: 2 + 1 + 1 = 4
    expect(summary.totalSessions).toBe(4);
    // uniqueUsers: u1, u2 = 2 (distinct user_ids in the filtered rows)
    expect(summary.uniqueUsers).toBe(2);
    // topModel: gpt-4 has 800 tokens, claude has 200 — gpt-4 wins
    expect(summary.topModel).toBe("gpt-4");
  });

  it("uniqueUsers is a distinct count (same user_id on multiple days counts once)", async () => {
    mockIndex.mockResolvedValue([
      makeRow({ user_id: "u1", day: "2024-03-01", total_tokens: 100, session_count: 1, top_model: "gpt-4" }),
      makeRow({ user_id: "u1", day: "2024-03-02", total_tokens: 100, session_count: 1, top_model: "gpt-4" }),
      makeRow({ user_id: "u1", day: "2024-03-03", total_tokens: 100, session_count: 1, top_model: "gpt-4" }),
    ]);

    const { result } = renderHook(() => useAdminAiUsage());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFromDate("2024-03-01");
      result.current.setToDate("2024-03-31");
    });

    await waitFor(() => expect(result.current.summary.uniqueUsers).toBe(1));
  });
});
