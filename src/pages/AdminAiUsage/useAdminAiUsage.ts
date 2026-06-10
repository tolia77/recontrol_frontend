import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "src/components/ui/Toast";
import {
  adminAiUsageService,
  type AiUsageRow,
} from "src/services/backend/adminAiUsageService";

export interface PerUserRow {
  user_id: string;
  username: string;
  total_tokens: number;
  session_count: number;
  top_model: string;
}

export interface AiUsageSummary {
  totalTokens: number;
  totalSessions: number;
  uniqueUsers: number;
  topModel: string;
}

export type SortKey = "username" | "total_tokens" | "session_count" | "top_model";
export type SortDir = "asc" | "desc";

export interface UseAdminAiUsageReturn {
  loading: boolean;
  summary: AiUsageSummary;
  perUserRows: PerUserRow[];
  fromDate: string;
  toDate: string;
  setFromDate: (v: string) => void;
  setToDate: (v: string) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  setSort: (key: SortKey) => void;
  loadData: () => Promise<void>;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDefaultDates(): { fromDate: string; toDate: string } {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  return { fromDate: toIsoDate(from), toDate: toIsoDate(today) };
}

function getTopModelByTokens(rows: AiUsageRow[]): string {
  if (rows.length === 0) return "";
  const tokensByModel = new Map<string, number>();
  for (const r of rows) {
    tokensByModel.set(r.top_model, (tokensByModel.get(r.top_model) ?? 0) + r.total_tokens);
  }
  let bestModel = "";
  let bestTokens = 0;
  for (const [model, tokens] of tokensByModel) {
    if (tokens > bestTokens) {
      bestTokens = tokens;
      bestModel = model;
    }
  }
  return bestModel;
}

export function useAdminAiUsage(): UseAdminAiUsageReturn {
  const { t } = useTranslation("adminAiUsage");
  const toast = useToast();

  const defaults = getDefaultDates();
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState<AiUsageRow[]>([]);
  const [fromDate, setFromDate] = useState(defaults.fromDate);
  const [toDate, setToDate] = useState(defaults.toDate);
  const [sortKey, setSortKey] = useState<SortKey>("total_tokens");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await adminAiUsageService.index();
      setRawRows(rows);
    } catch {
      toast.error(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey],
  );

  return useMemo(() => {
    // Client-side filter by date range
    const filtered = rawRows.filter(
      (r) => r.day >= fromDate && r.day <= toDate,
    );

    // Group by user_id, summing tokens and sessions; track per-model token
    // totals to determine the dominant model across the selected date range.
    const byUser = new Map<
      string,
      {
        username: string;
        total_tokens: number;
        session_count: number;
        top_model: string;
        modelTokens: Map<string, number>;
      }
    >();
    for (const r of filtered) {
      const existing = byUser.get(r.user_id);
      const modelTokens = existing?.modelTokens ?? new Map<string, number>();
      modelTokens.set(r.top_model, (modelTokens.get(r.top_model) ?? 0) + r.total_tokens);
      const topEntry = [...modelTokens.entries()].reduce(
        (best, cur) => (cur[1] > best[1] ? cur : best),
        ["", 0] as [string, number],
      );
      byUser.set(r.user_id, {
        username: r.username,
        total_tokens: (existing?.total_tokens ?? 0) + r.total_tokens,
        session_count: (existing?.session_count ?? 0) + r.session_count,
        top_model: topEntry[0],
        modelTokens,
      });
    }

    const unsortedRows: PerUserRow[] = [...byUser.entries()].map(
      ([user_id, { modelTokens: _mt, ...v }]) => ({ user_id, ...v }),
    );

    // Sort per-user rows
    const sortedRows = [...unsortedRows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    // Summary stats
    const totalTokens = filtered.reduce((s, r) => s + r.total_tokens, 0);
    const totalSessions = filtered.reduce((s, r) => s + r.session_count, 0);
    const uniqueUsers = new Set(filtered.map((r) => r.user_id)).size;
    const topModel = getTopModelByTokens(filtered);

    const summary: AiUsageSummary = {
      totalTokens,
      totalSessions,
      uniqueUsers,
      topModel,
    };

    return {
      loading,
      summary,
      perUserRows: sortedRows,
      fromDate,
      toDate,
      setFromDate,
      setToDate,
      sortKey,
      sortDir,
      setSort,
      loadData,
    };
  }, [
    loading,
    rawRows,
    fromDate,
    toDate,
    sortKey,
    sortDir,
    setSort,
    loadData,
  ]);
}
