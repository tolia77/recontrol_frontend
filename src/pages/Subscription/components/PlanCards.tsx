import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, ConfirmModal } from "src/components/ui";
import { useToast } from "src/components/ui";
import { useSubscription } from "src/contexts/SubscriptionContext";
import {
  subscriptionService,
  type Plan,
  type SubscriptionStatus,
  type LiqPayBlob,
} from "src/services/backend/subscriptionService";
import { getErrorMessage } from "src/utils/getErrorMessage";
import { formatPrice } from "src/utils/formatPrice";
import PlanComparison from "./PlanComparison";

// Free-tier limits for cancel-impact diff (D-16)
const FREE_DEVICE_LIMIT = 2;
const FREE_SCENARIO_LIMIT = 3;
const FREE_AI_DRAFT_LIMIT = 0;

// LiqPay auto-POST helper (D-05, RESEARCH.md Pattern 3)
function submitToLiqPay(blob: LiqPayBlob): void {
  // Don't leak our referrer to LiqPay. In local dev the referrer is http://localhost,
  // which LiqPay stores in its own Matomo `_pk_ref` cookie and then its WAF 403s the
  // checkout endpoints (`/apiweb/checkout/info`, `/apiwait`) for containing "localhost"
  // — blanking the page. <form> has no referrerPolicy attribute, so set a document-level
  // meta referrer before submitting; it governs the outgoing cross-origin navigation.
  // No effect in production (real-domain referrer is not blocked) and the page unloads
  // immediately, so the document-wide policy change has no lasting impact.
  const referrerMeta = document.createElement("meta");
  referrerMeta.name = "referrer";
  referrerMeta.content = "no-referrer";
  document.head.appendChild(referrerMeta);

  const form = document.createElement("form");
  form.method = "POST";
  form.action = blob.action_url;
  form.style.display = "none";

  const dataInput = document.createElement("input");
  dataInput.type = "hidden";
  dataInput.name = "data";
  dataInput.value = blob.data;
  form.appendChild(dataInput);

  const sigInput = document.createElement("input");
  sigInput.type = "hidden";
  sigInput.name = "signature";
  sigInput.value = blob.signature;
  form.appendChild(sigInput);

  document.body.appendChild(form);
  form.submit();
}

// CTA action types
type ConfirmAction = "subscribe" | "upgrade" | "resubscribe" | "downgrade" | "cancel";

interface ConfirmState {
  action: ConfirmAction;
  plan: Plan;
}

// Props
interface PlanCardsProps {
  status: SubscriptionStatus | null;
}

// Component
function PlanCards({ status }: PlanCardsProps) {
  const { t } = useTranslation("subscription");
  const { plans, loading: loadingPlans, refresh } = useSubscription();
  const { error: toastError } = useToast();

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  // Cancel-impact usage (fetched when user opens cancel modal)
  const [cancelUsage, setCancelUsage] = useState<{
    devices_used: number;
    scenarios_used: number;
    ai_drafts_used: number;
    device_sharing: boolean;
  } | null>(null);

  // Derive current plan price from fetched plans list
  const currentPlanName = status?.plan_name ?? "free";
  const currentPlan = plans.find((p) => p.name === currentPlanName);
  const currentPrice = currentPlan?.monthly_price ?? 0;

  // Determine CTA per plan card (D-02)
  type CtaVariant =
    | "current"
    | "none"
    | "subscribe"
    | "upgrade"
    | "downgrade"
    | "cancel"
    | "resubscribe";

  function getCta(plan: Plan): CtaVariant {
    const state = status?.state ?? null;

    // SINGLE source of truth for "current": the user's authoritative plan (currentPlanName,
    // derived from status.plan_name, which the backend sets to user.plan). Exactly one card
    // is ever "current". This prevents the double-"Current plan" badge that occurred when a
    // separate Free branch ALSO claimed current in terminal states (e.g. cancelled-but-Pro
    // until period end).
    if (plan.name === currentPlanName) {
      return "current";
    }

    // The Free card, when it is NOT the current plan, is the downgrade/cancel target for an
    // active paid subscription. Free has no checkout, so when there's nothing live to cancel
    // (e.g. already cancelled, awaiting period-end revert) it shows no button.
    if (plan.name === "free") {
      if (state === "active" || state === "upgrading") return "cancel";
      return "none";
    }

    // No live subscription (null/cancelled/expired) — paid plans → subscribe fresh.
    if (state === null || state === "cancelled" || state === "expired") {
      return "subscribe";
    }

    // Live subscription on a different paid tier.
    if (state === "active" || state === "upgrading" || state === "pending") {
      return plan.monthly_price > currentPrice ? "upgrade" : "downgrade";
    }

    if (state === "past_due") {
      return "resubscribe";
    }

    return "subscribe";
  }

  // Open cancel modal + fetch usage for diff (D-16)
  async function openCancelConfirm(plan: Plan) {
    try {
      const usage = await subscriptionService.getUsage();
      setCancelUsage({
        devices_used: usage.devices_used,
        scenarios_used: usage.scenarios_used,
        ai_drafts_used: usage.ai_drafts_used,
        device_sharing: usage.device_sharing,
      });
    } catch {
      setCancelUsage(null);
    }
    setConfirm({ action: "cancel", plan });
  }

  // Open any confirm modal
  function openConfirm(action: ConfirmAction, plan: Plan) {
    if (action === "cancel") {
      void openCancelConfirm(plan);
      return;
    }
    setConfirm({ action, plan });
  }

  function closeConfirm() {
    setConfirm(null);
  }

  // Perform confirmed action
  async function handleConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      const { action, plan } = confirm;

      if (action === "subscribe") {
        // Free plan has no checkout — but CTA logic prevents this for free card
        const blob = await subscriptionService.checkout(
          plan.id,
          window.location.origin + "/subscription/return",
        );
        submitToLiqPay(blob);
        return; // page redirects; no modal close needed
      }

      if (action === "upgrade" || action === "resubscribe") {
        const result = await subscriptionService.upgradeDowngrade(plan.id);
        // Upgrade returns a LiqPayBlob for immediate payment
        if ("action_url" in result) {
          submitToLiqPay(result as LiqPayBlob);
          return; // page redirects
        }
        // Downgrade_scheduled path (shouldn't happen for upgrade, but guard)
        refresh();
        closeConfirm();
        return;
      }

      if (action === "downgrade") {
        const result = await subscriptionService.upgradeDowngrade(plan.id);
        if ("status" in result && result.status === "downgrade_scheduled") {
          refresh();
          closeConfirm();
          return;
        }
        // If the server sends a LiqPayBlob (unexpected for downgrade — handle gracefully)
        if ("action_url" in result) {
          submitToLiqPay(result as LiqPayBlob);
          return;
        }
        refresh();
        closeConfirm();
        return;
      }

      if (action === "cancel") {
        await subscriptionService.cancel();
        refresh();
        closeConfirm();
        return;
      }
    } catch (err) {
      toastError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Build cancel-impact body (D-16)
  function buildCancelImpactBody(): React.ReactNode {
    const lines: React.ReactNode[] = [];

    if (cancelUsage) {
      if (cancelUsage.devices_used > FREE_DEVICE_LIMIT) {
        lines.push(
          <li key="devices">
            {t("cancelImpact.devices", {
              current: cancelUsage.devices_used,
              freeLimit: FREE_DEVICE_LIMIT,
            })}
          </li>,
        );
      }
      if (cancelUsage.scenarios_used > FREE_SCENARIO_LIMIT) {
        lines.push(
          <li key="scenarios">
            {t("cancelImpact.scenarios", {
              current: cancelUsage.scenarios_used,
              freeLimit: FREE_SCENARIO_LIMIT,
            })}
          </li>,
        );
      }
      if (cancelUsage.ai_drafts_used > FREE_AI_DRAFT_LIMIT) {
        lines.push(
          <li key="drafts">
            {t("cancelImpact.aiDrafts", {
              current: cancelUsage.ai_drafts_used,
              freeLimit: FREE_AI_DRAFT_LIMIT,
            })}
          </li>,
        );
      }
      if (cancelUsage.device_sharing) {
        lines.push(
          <li key="sharing">{t("cancelImpact.sharing")}</li>,
        );
      }
    }

    const renewalDate = status?.period_end
      ? new Date(status.period_end).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    return (
      <div className="space-y-2 text-body">
        <p>
          {renewalDate
            ? t("confirmCancelBody", { renewalDate })
            : t("confirmCancelBodyNoDate")}
        </p>
        {lines.length > 0 && (
          <ul className="list-disc pl-5 space-y-1">{lines}</ul>
        )}
      </div>
    );
  }

  // Build modal config for current confirm state
  function getModalConfig() {
    if (!confirm) return null;
    const { action, plan } = confirm;
    const price = formatPrice(plan.monthly_price);
    const renewalDate = status?.period_end
      ? new Date(status.period_end).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;
    const currentPlanLabel = t(`plan.${currentPlanName}`);

    switch (action) {
      case "subscribe":
        return {
          title: t("confirmSubscribeTitle", { plan: t(`plan.${plan.name}`) }),
          body: (
            <p className="text-body">
              {t("confirmSubscribeBody", { price })}
            </p>
          ),
          confirmLabel: t("planCard.subscribe"),
          dangerous: false,
        };
      case "upgrade":
      case "resubscribe":
        return {
          title: t("confirmUpgradeTitle", { plan: t(`plan.${plan.name}`) }),
          body: (
            <p className="text-body">
              {t("confirmUpgradeBody", { price })}
            </p>
          ),
          confirmLabel: action === "upgrade" ? t("planCard.upgrade") : t("planCard.resubscribe"),
          dangerous: false,
        };
      case "downgrade":
        return {
          title: t("confirmDowngradeTitle", { plan: t(`plan.${plan.name}`) }),
          body: (
            <p className="text-body">
              {t("confirmDowngradeBody", {
                currentPlan: currentPlanLabel,
                renewalDate: renewalDate ?? "",
                targetPlan: t(`plan.${plan.name}`),
                price,
              })}
            </p>
          ),
          confirmLabel: t("planCard.downgrade"),
          dangerous: false,
        };
      case "cancel":
        return {
          title: t("confirmCancelTitle"),
          body: buildCancelImpactBody(),
          confirmLabel: t("confirmCancelLabel"),
          dangerous: true,
        };
    }
  }

  const modalConfig = getModalConfig();

  // Per-plan CTA, rendered INSIDE each PlanComparison card (D-07 fix)
  function renderCta(plan: Plan): React.ReactNode {
    const cta = getCta(plan);
    const isCurrent = cta === "current";

    return (
      <>
        {/* Pending downgrade note — D-04: read-only, NO revert button */}
        {status?.scheduled_plan && plan.name === currentPlanName && (
          <p className="text-muted-foreground mb-3 text-body">
            {t("pendingDowngrade.note", {
              plan: t(`plan.${status.scheduled_plan}`),
              date: status.period_end
                ? new Date(status.period_end).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "",
            })}
          </p>
        )}

        {isCurrent ? (
          <span
            role="status"
            className="text-primary border-primary block rounded-md border px-4 py-2 text-center text-body font-medium"
          >
            {t("planCard.current")}
          </span>
        ) : cta === "none" ? null : (
          <Button
            variant={cta === "cancel" ? "danger" : "primary"}
            className="w-full"
            onClick={() => openConfirm(cta as ConfirmAction, plan)}
          >
            {t("planCard.switchTo", { plan: t(`plan.${plan.name}`) })}
          </Button>
        )}
      </>
    );
  }

  if (loadingPlans) {
    return <div className="py-8 text-center text-body text-muted-foreground">{t("loadingPlans")}</div>;
  }

  return (
    <>
      {/* Plan comparison — grid-cols-1 md:grid-cols-4. Each card carries the plan
          name + price + features AND its CTA (via renderCta), so the button stays
          inside its own card on every viewport. The grid stacks on mobile. */}
      <PlanComparison plans={plans} renderCta={renderCta} />

      {/* Confirm modal (D-03) */}
      {confirm && modalConfig && (
        <ConfirmModal
          open={true}
          title={modalConfig.title}
          body={modalConfig.body}
          confirmLabel={modalConfig.confirmLabel}
          dangerous={modalConfig.dangerous}
          isBusy={busy}
          onConfirm={() => void handleConfirm()}
          onCancel={closeConfirm}
        />
      )}
    </>
  );
}

export default PlanCards;
