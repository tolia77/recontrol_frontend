import { useTranslation } from "react-i18next";
import { getUserRole } from "src/utils/auth";
import { Button, Card, Input, PageHeader } from "src/components/ui";
import { useAdminAiUsage } from "./useAdminAiUsage";
import AdminAiUsageTable from "./AdminAiUsageTable";

const AdminAiUsage = () => {
  const { t } = useTranslation("adminAiUsage");

  const currentRole = getUserRole();

  const {
    loading,
    summary,
    perUserRows,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    sortKey,
    sortDir,
    setSort,
    loadData,
  } = useAdminAiUsage();

  // NOTE: this gate is cosmetic — it hides admin UI for non-admin users but
  // does not enforce security. All admin API endpoints enforce authorization
  // server-side and return 403 for non-admins. The role value comes from
  // localStorage and can be modified client-side.
  if (currentRole !== "admin") {
    return (
      <div className="p-6">
        <p className="text-body text-muted-foreground">{t("errors.forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("refreshLabel")}
            onClick={() => void loadData()}
          >
            ↻
          </Button>
        }
      />

      {/* Summary stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <p className="text-caption text-muted-foreground">{t("summary.totalTokens")}</p>
          <p className="text-heading font-semibold">
            {summary.totalTokens.toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-caption text-muted-foreground">{t("summary.totalSessions")}</p>
          <p className="text-heading font-semibold">
            {summary.totalSessions.toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-caption text-muted-foreground">{t("summary.uniqueUsers")}</p>
          <p className="text-heading font-semibold">{summary.uniqueUsers}</p>
        </Card>
        <Card>
          <p className="text-caption text-muted-foreground">{t("summary.topModel")}</p>
          <p className="text-heading font-semibold truncate">
            {summary.topModel || "—"}
          </p>
        </Card>
      </div>

      {/* Date range filter */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label={t("dateFilter.from")}
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <Input
            label={t("dateFilter.to")}
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </Card>

      {/* Per-user table */}
      <AdminAiUsageTable
        rows={perUserRows}
        loading={loading}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={setSort}
      />
    </div>
  );
};

export default AdminAiUsage;
