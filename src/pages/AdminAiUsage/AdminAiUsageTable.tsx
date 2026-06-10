import { useTranslation } from "react-i18next";
import { Card, LoadingState, EmptyState } from "src/components/ui";
import type { PerUserRow, SortKey, SortDir } from "./useAdminAiUsage";

export interface AdminAiUsageTableProps {
  rows: PerUserRow[];
  loading: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}

export default function AdminAiUsageTable({
  rows,
  loading,
  sortKey,
  sortDir,
  onSort,
}: AdminAiUsageTableProps) {
  const { t } = useTranslation("adminAiUsage");

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  return (
    <Card>
      <h2 className="mb-4 text-heading font-semibold">{t("title")}</h2>
      {loading ? (
        <LoadingState message={t("messages.loading")} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("messages.empty")} />
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-body">
            <thead className="bg-surface sticky top-0">
              <tr className="text-foreground border-b text-left">
                <th
                  className="cursor-pointer px-2 py-2 hover:text-primary"
                  onClick={() => onSort("username")}
                >
                  {t("table.username")}
                  {sortIndicator("username")}
                </th>
                <th
                  className="cursor-pointer px-2 py-2 hover:text-primary"
                  onClick={() => onSort("total_tokens")}
                >
                  {t("table.tokens")}
                  {sortIndicator("total_tokens")}
                </th>
                <th
                  className="cursor-pointer px-2 py-2 hover:text-primary"
                  onClick={() => onSort("session_count")}
                >
                  {t("table.sessions")}
                  {sortIndicator("session_count")}
                </th>
                <th
                  className="cursor-pointer px-2 py-2 hover:text-primary"
                  onClick={() => onSort("top_model")}
                >
                  {t("table.topModel")}
                  {sortIndicator("top_model")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.user_id}
                  className="hover:bg-surface-muted border-b align-top last:border-b-0"
                >
                  <td className="px-2 py-2">{row.username}</td>
                  <td className="px-2 py-2">{row.total_tokens.toLocaleString()}</td>
                  <td className="px-2 py-2">{row.session_count}</td>
                  <td className="px-2 py-2">{row.top_model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
