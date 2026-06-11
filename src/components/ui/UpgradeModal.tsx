import { useRef } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import Modal from "src/components/ui/Modal";
import Button from "src/components/ui/Button";
import { useSubscription } from "src/contexts/SubscriptionContext";
import PlanComparison from "src/pages/Subscription/components/PlanComparison";
import type { GateKey } from "src/hooks/useGate";

// Props

interface UpgradeModalProps {
  /** The gate that triggered the modal (selects the header copy and highlighted row). */
  feature: GateKey;
  /** For count gates — the user's current usage count. */
  current?: number;
  /** For count gates — the plan limit. */
  limit?: number | null;
  /** Plan name to highlight in PlanComparison (cheapest qualifying tier). */
  requiredPlan?: string;
  /** Called on Dismiss and after "View plans" navigate. Caller gates mount with `{show && <UpgradeModal />}`. */
  onClose: () => void;
}

// Component

function UpgradeModal({
  feature,
  current,
  limit,
  requiredPlan,
  onClose,
}: UpgradeModalProps) {
  const { t } = useTranslation("subscription");
  const navigate = useNavigate();
  const { plans } = useSubscription();

  // Initial focus on the primary CTA ("View plans") per accessibility contract.
  const viewPlansRef = useRef<HTMLButtonElement>(null);

  const handleViewPlans = () => {
    navigate("/subscription");
    onClose();
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      size="full"
      className="p-6"
      initialFocusRef={viewPlansRef as React.RefObject<HTMLElement | null>}
    >
      <Modal.Header>
        {t(`gate.${feature}.header`, { current, limit })}
      </Modal.Header>

      <Modal.Body>
        {/* PlanComparison is grid-cols-1 md:grid-cols-4: it stacks into single-column
            plan cards on mobile and the bottom sheet scrolls (max-h-[90dvh]), so the
            full comparison renders on every viewport with the relevant tier/row highlighted. */}
        <PlanComparison
          plans={plans}
          highlightPlan={requiredPlan}
          highlightFeature={feature}
        />
      </Modal.Body>

      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>
          {t("gate.dismiss")}
        </Button>
        <Button ref={viewPlansRef} variant="primary" onClick={handleViewPlans}>
          {t("gate.viewPlans")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default UpgradeModal;
