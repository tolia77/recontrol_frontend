import { useTranslation } from "react-i18next";
import { Button, Card, LoadingState, EmptyState } from "src/components/ui";
import type {
  SubscriptionAdminRow,
  BillingHistoryEvent,
} from "src/services/backend/adminSubscriptionsService";

export interface AdminSubscriptionsTableProps {
  rows: SubscriptionAdminRow[];
  loading: boolean;
  userNameById: Record<string, string>;
  expandedRowId: string | null;
  toggleExpand: (id: string) => void;
  billingHistoryByRow: Record<string, BillingHistoryEvent[]>;
  billingLoadingByRow: Record<string, boolean>;
  setCancelTarget: (v: SubscriptionAdminRow | null) => void;
}

export default function AdminSubscriptionsTable({
  rows,
  loading,
  userNameById,
  expandedRowId,
  toggleExpand,
  billingHistoryByRow,
  billingLoadingByRow,
  setCancelTarget,
}: AdminSubscriptionsTableProps) {
  const { t } = useTranslation("adminSubscriptions");

  const COL_COUNT = 7;

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
                <th className="px-2 py-2">{t("table.owner")}</th>
                <th className="px-2 py-2">{t("table.state")}</th>
                <th className="px-2 py-2">{t("table.plan_name")}</th>
                <th className="px-2 py-2">{t("table.period_end")}</th>
                <th className="px-2 py-2">{t("table.is_comp")}</th>
                <th className="px-2 py-2">{t("table.created_at")}</th>
                <th className="px-2 py-2">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <>
                  <tr
                    key={row.id}
                    className="hover:bg-surface-muted border-b align-top last:border-b-0"
                  >
                    <td className="px-2 py-2">
                      {userNameById[row.user_id] ?? row.user_id}
                    </td>
                    <td className="px-2 py-2">{row.state}</td>
                    <td className="px-2 py-2">{row.plan_name}</td>
                    <td className="text-muted-foreground px-2 py-2 text-caption">
                      {row.period_end
                        ? new Date(row.period_end).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-2 py-2">
                      {row.is_comp ? (
                        <span className="text-primary font-medium">✓</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="text-muted-foreground px-2 py-2 text-caption">
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                    <td className="space-y-1 px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleExpand(row.id)}
                        >
                          {expandedRowId === row.id ? "▲" : "▼"}{" "}
                          {t("billingHistory.title")}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setCancelTarget(row)}
                        >
                          {t("messages.cancelConfirm.confirm")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedRowId === row.id && (
                    <tr
                      key={`${row.id}-billing`}
                      className="bg-surface-muted border-b"
                    >
                      <td colSpan={COL_COUNT} className="px-4 py-3">
                        <div className="text-caption font-semibold mb-2">
                          {t("billingHistory.title")}
                        </div>
                        {billingLoadingByRow[row.id] ? (
                          <LoadingState message={t("messages.loading")} />
                        ) : !billingHistoryByRow[row.id] ||
                          billingHistoryByRow[row.id].length === 0 ? (
                          <p className="text-muted-foreground text-caption">
                            {t("billingHistory.empty")}
                          </p>
                        ) : (
                          <table className="min-w-full text-caption">
                            <thead>
                              <tr className="text-foreground border-b text-left">
                                <th className="px-2 py-1">
                                  {t("billingHistory.columns.event_type")}
                                </th>
                                <th className="px-2 py-1">
                                  {t("billingHistory.columns.from_state")}
                                </th>
                                <th className="px-2 py-1">
                                  {t("billingHistory.columns.to_state")}
                                </th>
                                <th className="px-2 py-1">
                                  {t("billingHistory.columns.created_at")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {billingHistoryByRow[row.id].map((event, idx) => (
                                <tr
                                  key={idx}
                                  className="hover:bg-surface border-b last:border-b-0"
                                >
                                  <td className="px-2 py-1">{event.event_type}</td>
                                  <td className="text-muted-foreground px-2 py-1">
                                    {event.from_state ?? "-"}
                                  </td>
                                  <td className="text-muted-foreground px-2 py-1">
                                    {event.to_state ?? "-"}
                                  </td>
                                  <td className="text-muted-foreground px-2 py-1">
                                    {new Date(event.created_at).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
