import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getUserRole } from "src/utils/auth";
import {
  Button,
  Card,
  Select,
  ConfirmModal,
  PageHeader,
} from "src/components/ui";
import { useAdminSubscriptions } from "./useAdminSubscriptions";
import AdminSubscriptionsTable from "./AdminSubscriptionsTable";

// Known subscription states — extend as needed
const SUBSCRIPTION_STATES = [
  "pending",
  "active",
  "upgrading",
  "past_due",
  "cancelled",
  "expired",
];

const AdminSubscriptions = () => {
  const { t } = useTranslation("adminSubscriptions");
  const currentRole = getUserRole();

  const {
    loading,
    rows,
    stateFilter,
    setStateFilter,
    planIdFilter,
    setPlanIdFilter,
    cancelTarget,
    setCancelTarget,
    cancelling,
    expandedRowId,
    toggleExpand,
    billingHistoryByRow,
    billingLoadingByRow,
    overrideLoading,
    users,
    plans,
    userNameById,
    loadSubscriptions,
    handleCancelConfirm,
    handleOverride,
  } = useAdminSubscriptions();

  const [overrideUserId, setOverrideUserId] = useState("");
  const [overridePlanId, setOverridePlanId] = useState("");

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

  const stateOptions = [
    { value: "", label: t("filters.all") },
    ...SUBSCRIPTION_STATES.map((s) => ({ value: s, label: s })),
  ];

  const planOptions = [
    { value: "", label: t("filters.all") },
    ...plans.map((p) => ({ value: p.id, label: p.name })),
  ];

  const userOptions = [
    { value: "", label: "—" },
    ...users.map((u) => ({
      value: String(u.id),
      label: u.username,
    })),
  ];

  const handleOverrideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideUserId || !overridePlanId) return;
    void handleOverride({ user_id: overrideUserId, plan_id: overridePlanId });
  };

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
            onClick={() => void loadSubscriptions()}
          >
            ↻
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-6 max-w-xl">
        <h2 className="mb-3 text-heading font-semibold">{t("filters.state")}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select
            label={t("filters.state")}
            name="stateFilter"
            options={stateOptions}
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          />
          <Select
            label={t("filters.plan")}
            name="planFilter"
            options={planOptions}
            value={planIdFilter}
            onChange={(e) => setPlanIdFilter(e.target.value)}
          />
        </div>
      </Card>

      {/* Grant Comp Plan — standalone form, NOT a per-row action */}
      <Card className="mb-6 max-w-xl">
        <form onSubmit={handleOverrideSubmit} className="space-y-3">
          <h2 className="text-heading font-semibold">{t("override.title")}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              label={t("override.userLabel")}
              name="overrideUser"
              options={userOptions}
              value={overrideUserId}
              onChange={(e) => setOverrideUserId(e.target.value)}
            />
            <Select
              label={t("override.planLabel")}
              name="overridePlan"
              options={[
                { value: "", label: "—" },
                ...plans.map((p) => ({ value: p.id, label: p.name })),
              ]}
              value={overridePlanId}
              onChange={(e) => setOverridePlanId(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            loading={overrideLoading}
            disabled={overrideLoading || !overrideUserId || !overridePlanId}
          >
            {t("override.submit")}
          </Button>
        </form>
      </Card>

      {/* Subscriptions table */}
      <AdminSubscriptionsTable
        rows={rows}
        loading={loading}
        userNameById={userNameById}
        expandedRowId={expandedRowId}
        toggleExpand={toggleExpand}
        billingHistoryByRow={billingHistoryByRow}
        billingLoadingByRow={billingLoadingByRow}
        setCancelTarget={setCancelTarget}
      />

      {/* Cancel confirm modal */}
      <ConfirmModal
        open={cancelTarget !== null}
        dangerous
        title={t("messages.cancelConfirm.title")}
        body={t("messages.cancelConfirm.body", {
          periodEnd: cancelTarget?.period_end
            ? new Date(cancelTarget.period_end).toLocaleDateString()
            : "-",
        })}
        confirmLabel={t("messages.cancelConfirm.confirm")}
        cancelLabel={t("messages.cancelConfirm.cancel")}
        isBusy={cancelling}
        onConfirm={() => void handleCancelConfirm()}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
};

export default AdminSubscriptions;
