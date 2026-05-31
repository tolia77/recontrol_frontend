import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, Button, ConfirmModal } from "src/components/ui";
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

// ── Free-tier limits for cancel-impact diff (D-16) ───────────────────────────
const FREE_DEVICE_LIMIT = 2;
const FREE_SCENARIO_LIMIT = 3;
const FREE_AI_DRAFT_LIMIT = 0;

// ── LiqPay auto-POST helper (D-05, RESEARCH.md Pattern 3) ────────────────────
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

// ── CTA action types ──────────────────────────────────────────────────────────
type ConfirmAction = "subscribe" | "upgrade" | "resubscribe" | "downgrade" | "cancel";

interface ConfirmState {
  action: ConfirmAction;
  plan: Plan;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface PlanCardsProps {
  status: SubscriptionStatus | null;
}

// ── Component ─────────────────────────────────────────────────────────────────
function PlanCards({ status }: PlanCardsProps) {
  const { t } = useTranslation("subscription");
  const { refresh } = useSubscription();
  const { error: toastError } = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  // Cancel-impact usage (fetched when user opens cancel modal)
  const [cancelUsage, setCancelUsage] = useState<{
    devices_used: number;
    scenarios_used: number;
    ai_drafts_used: number;
    device_sharing: boolean;
  } | null>(null);

  useEffect(() => {
    subscriptionService
      .getPlans()
      .then((data) => setPlans(data))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, []);

  // ── Derive current plan price from fetched plans list ─────────────────────
  const currentPlanName = status?.plan_name ?? "free";
  const currentPlan = plans.find((p) => p.name === currentPlanName);
  const currentPrice = currentPlan?.monthly_price ?? 0;

  // ── Determine CTA per plan card (D-02) ────────────────────────────────────
  type CtaVariant =
    | "current"
    | "subscribe"
    | "upgrade"
    | "downgrade"
    | "cancel"
    | "resubscribe";

  function getCta(plan: Plan): CtaVariant {
    const state = status?.state ?? null;

    // Free plan card
    if (plan.name === "free") {
      if (state === "active" || state === "upgrading") {
        return "cancel";
      }
      // null (never subscribed), cancelled, expired, past_due — treat free as current
      return "current";
    }

    // Paid plan card — same plan as current
    if (plan.name === currentPlanName && state !== null) {
      return "current";
    }

    // No active subscription (null/cancelled/expired) — paid plans → subscribe
    if (state === null || state === "cancelled" || state === "expired") {
      return "subscribe";
    }

    // Active or past_due
    if (state === "active" || state === "upgrading") {
      if (plan.monthly_price > currentPrice) return "upgrade";
      return "downgrade";
    }

    if (state === "past_due") {
      if (plan.monthly_price > currentPrice) return "resubscribe";
      return "resubscribe";
    }

    if (state === "pending") {
      if (plan.monthly_price > currentPrice) return "upgrade";
      return "downgrade";
    }

    return "subscribe";
  }

  // ── Open cancel modal + fetch usage for diff (D-16) ──────────────────────
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

  // ── Open any confirm modal ────────────────────────────────────────────────
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

  // ── Perform confirmed action ──────────────────────────────────────────────
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

  // ── Build cancel-impact body (D-16) ───────────────────────────────────────
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
      <div className="space-y-2 text-sm">
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

  // ── Build modal config for current confirm state ──────────────────────────
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
            <p className="text-sm">
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
            <p className="text-sm">
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
            <p className="text-sm">
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

  if (loadingPlans) {
    return <div className="py-8 text-center text-sm text-darkgray">{t("loadingPlans")}</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {plans.map((plan) => {
          const cta = getCta(plan);
          const isCurrent = cta === "current";

          return (
            <Card key={plan.id} padding="lg" className="flex flex-col">
              {/* Plan name */}
              <h3 className="text-xl font-semibold mb-2">
                {t(`plan.${plan.name}`)}
              </h3>

              {/* Price */}
              <h2 className="text-2xl font-semibold mb-4">
                {plan.monthly_price === 0
                  ? t("price.free")
                  : t("price.paid", { price: formatPrice(plan.monthly_price) })}
              </h2>

              {/* Feature highlights (placeholder list key — locale provides copy) */}
              <ul className="text-sm text-darkgray space-y-1 mb-6 flex-1">
                {["feature1", "feature2", "feature3"].map((key) => (
                  <li key={key}>{t(`planFeature.${plan.name}.${key}`, { defaultValue: "" })}</li>
                ))}
              </ul>

              {/* Pending downgrade note — D-04: read-only, NO revert button */}
              {status?.scheduled_plan && plan.name === currentPlanName && (
                <p className="text-sm text-darkgray mb-3">
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

              {/* CTA — current plan shows a label; every other card shows a single
                  "Switch to {plan}" button. The underlying action (cta) still drives the
                  correct confirm modal + backend call: upgrade→checkout, downgrade→schedule,
                  switch-to-Free→cancel. "danger" styling only for the switch-to-Free case. */}
              {isCurrent ? (
                <span
                  role="status"
                  className="inline-block text-center text-sm font-medium text-primary border border-primary rounded-lg px-4 py-2"
                >
                  {t("planCard.current")}
                </span>
              ) : (
                <Button
                  variant={cta === "cancel" ? "danger" : "primary"}
                  className="w-full"
                  onClick={() => openConfirm(cta as ConfirmAction, plan)}
                >
                  {t("planCard.switchTo", { plan: t(`plan.${plan.name}`) })}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

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
