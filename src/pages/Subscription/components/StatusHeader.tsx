import { useTranslation } from "react-i18next";
import Card from "src/components/ui/Card";
import type { SubscriptionStatus } from "src/services/backend/subscriptionService";

// ── State badge color map ──────────────────────────────────────────────────────

const stateBadgeClasses: Record<string, string> = {
  active: "text-success bg-success/10",
  upgrading: "text-primary bg-primary/8",
  pending: "text-primary bg-primary/8",
  past_due: "text-warning bg-warning/10",
  cancelled: "text-muted-foreground bg-surface-muted",
  expired: "text-muted-foreground bg-surface-muted",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface StatusHeaderProps {
  status: SubscriptionStatus | null;
}

function StatusHeader({ status }: StatusHeaderProps) {
  const { t, i18n } = useTranslation("subscription");

  const planLabel = status?.plan_name ?? "free";
  const stateLabel = status?.state ?? "active";
  const badgeClass = stateBadgeClasses[stateLabel] ?? "text-muted-foreground bg-surface-muted";

  const periodEndDate = status?.period_end
    ? new Date(status.period_end).toLocaleDateString(i18n.language, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // A cancelled subscription keeps its paid plan until period_end, then reverts to Free
  // (Phase 32 job). Say so explicitly rather than the misleading "Renews {date}".
  const dateLine = periodEndDate
    ? stateLabel === "cancelled"
      ? t("statusHeader.switchesToFree", { date: periodEndDate })
      : t("statusHeader.renews", { date: periodEndDate })
    : null;

  return (
    <Card padding="md" className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-title font-semibold capitalize">
            {t(`plan.${planLabel}`)}
          </p>
          {dateLine && (
            <p className="text-body text-muted-foreground mt-1">{dateLine}</p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-body font-medium ${badgeClass}`}
        >
          {t(`statusHeader.state.${stateLabel}`)}
        </span>
      </div>
    </Card>
  );
}

export default StatusHeader;
