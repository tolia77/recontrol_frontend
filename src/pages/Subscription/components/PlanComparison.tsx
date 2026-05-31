import { useTranslation } from "react-i18next";
import { Card } from "src/components/ui";
import { formatPrice } from "src/utils/formatPrice";
import type { Plan } from "src/services/backend/subscriptionService";

// Local gate-key union — plan 03 introduces GateKey; this union is assignable to it.
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
}

// ── Static feature row data (display labels + per-plan values) ────────────────
// Source: 34-UI-SPEC.md §Feature Row Specification
// These are display values for the comparison grid ONLY — NOT consumed by gate logic.
// Gate logic reads server-provided usage values from SubscriptionContext.

interface FeatureRow {
  key: GateKey;
  label: string;
  values: Record<"free" | "pro" | "advanced" | "business", string | boolean>;
}

const FEATURE_ROWS: FeatureRow[] = [
  {
    key: "device_sharing",
    label: "Device sharing",
    values: { free: false, pro: true, advanced: true, business: true },
  },
  {
    key: "device_limit",
    label: "Devices",
    values: { free: "2", pro: "10", advanced: "50", business: "Unlimited" },
  },
  {
    key: "scenario_limit",
    label: "Scenarios",
    values: { free: "3", pro: "25", advanced: "Unlimited", business: "Unlimited" },
  },
  {
    key: "ai_draft_daily_limit",
    label: "AI drafts / day",
    values: { free: "0", pro: "30", advanced: "30", business: "100" },
  },
  {
    key: "ai_access",
    label: "AI assistant",
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

function planFeatureValue(
  plan: Plan,
  row: FeatureRow,
): string {
  const val = row.values[plan.name];
  if (typeof val === "boolean") return val ? "Included" : "—";
  return val;
}

// ── Component ─────────────────────────────────────────────────────────────────

function PlanComparison({
  plans,
  highlightPlan,
  highlightFeature,
  className = "",
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
                ? "border-2 border-primary rounded-lg flex flex-col"
                : "border border-lightgray rounded-lg flex flex-col"
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
              <h3 className="text-xl font-semibold mb-2">
                {t(`plan.${plan.name}`)}
              </h3>
              <p className="text-sm text-darkgray">
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
                const displayValue = planFeatureValue(plan, row);

                return (
                  <div
                    key={row.key}
                    className={`flex justify-between text-sm px-1 rounded ${isGatedRow ? "bg-primary/5" : ""}`}
                  >
                    <span className={isGatedRow ? "font-semibold" : ""}>
                      {row.label}
                    </span>
                    <span className={included ? "text-accent" : "text-darkgray"}>
                      {displayValue}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export default PlanComparison;
