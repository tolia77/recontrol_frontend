import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "src/components/ui";
import { formatPrice } from "src/utils/formatPrice";
import type { Plan } from "src/services/backend/subscriptionService";

// Local gate-key union — assignable to the shared GateKey type.
type GateKey =
  | "device_sharing"
  | "device_limit"
  | "scenario_limit"
  | "ai_draft_daily_limit"
  | "ai_access";

interface PlanComparisonProps {
  plans: Plan[];
  highlightPlan?: string;
  highlightFeature?: GateKey;
  className?: string;
  /** Optional per-plan call-to-action rendered at the bottom of each plan card.
   *  When provided, the button lives INSIDE its plan card (so on mobile each
   *  stacked card is self-contained). Omitted for read-only uses (UpgradeModal). */
  renderCta?: (plan: Plan) => ReactNode;
}

// Static feature row data (per-plan values)
// Source: 34-UI-SPEC.md §Feature Row Specification
// These are display values for the comparison grid ONLY — NOT consumed by gate logic.
// Gate logic reads server-provided usage values from SubscriptionContext.
// Labels and the word-values (included / not included / unlimited) are localized
// via the `comparison.*` keys in src/locales/subscription.ts. Numeric counts are
// language-independent and stay inline. The sentinel "Unlimited" string maps to
// the `comparison.unlimited` locale key at render time.

interface FeatureRow {
  key: GateKey;
  values: Record<"free" | "pro" | "advanced" | "business", string | boolean>;
}

const FEATURE_ROWS: FeatureRow[] = [
  {
    key: "device_sharing",
    values: { free: false, pro: true, advanced: true, business: true },
  },
  {
    key: "device_limit",
    values: { free: "2", pro: "10", advanced: "50", business: "Unlimited" },
  },
  {
    key: "scenario_limit",
    values: { free: "3", pro: "25", advanced: "Unlimited", business: "Unlimited" },
  },
  {
    key: "ai_draft_daily_limit",
    values: { free: "0", pro: "30", advanced: "30", business: "100" },
  },
  {
    key: "ai_access",
    values: { free: true, pro: true, advanced: true, business: true },
  },
];

function planHasFeature(
  plan: Plan,
  row: FeatureRow,
): boolean {
  const val = row.values[plan.name];
  if (typeof val === "boolean") return val;
  // Non-zero string counts → included; "0" or "—" → not included
  return val !== "0" && val !== "—";
}

// Component

function PlanComparison({
  plans,
  highlightPlan,
  highlightFeature,
  className = "",
  renderCta,
}: PlanComparisonProps) {
  const { t } = useTranslation("subscription");

  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-4 ${className}`}>
      {plans.map((plan) => {
        const isHighlighted = plan.name === highlightPlan;

        return (
          <Card
            key={plan.id}
            padding="lg"
            className={
              isHighlighted
                ? "border-2 border-primary rounded-md flex flex-col"
                : "border border-border rounded-md flex flex-col"
            }
          >
            {/* Column header — plan name + price */}
            <div
              className={
                isHighlighted
                  ? "bg-primary/10 -mx-6 -mt-6 px-6 pt-6 pb-3 rounded-t-lg"
                  : ""
              }
            >
              <h3 className="text-heading font-semibold mb-2">
                {t(`plan.${plan.name}`)}
              </h3>
              <p className="text-body text-muted-foreground">
                {plan.monthly_price === 0
                  ? t("price.free")
                  : t("price.paid", { price: formatPrice(plan.monthly_price) })}
              </p>
            </div>

            {/* Feature rows */}
            <div className="flex flex-col gap-2 mt-4">
              {FEATURE_ROWS.map((row) => {
                const isGatedRow = row.key === highlightFeature;
                const included = planHasFeature(plan, row);
                const raw = row.values[plan.name];

                let displayValue: string;
                if (typeof raw === "boolean") {
                  displayValue = raw
                    ? t("comparison.included")
                    : t("comparison.notIncluded");
                } else if (raw === "Unlimited") {
                  displayValue = t("comparison.unlimited");
                } else {
                  displayValue = raw;
                }

                return (
                  <div
                    key={row.key}
                    className={`flex justify-between text-body px-1 rounded-sm ${isGatedRow ? "bg-primary/5" : ""}`}
                  >
                    <span className={isGatedRow ? "font-semibold" : ""}>
                      {t(`comparison.feature.${row.key}`)}
                    </span>
                    <span className={included ? "text-success" : "text-muted-foreground"}>
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Per-plan CTA — inside the card, pinned to the bottom so columns
                align on desktop and each stacked card is self-contained on mobile. */}
            {renderCta && <div className="mt-auto pt-4">{renderCta(plan)}</div>}
          </Card>
        );
      })}
    </div>
  );
}

export default PlanComparison;
