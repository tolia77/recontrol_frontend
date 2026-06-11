import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

// Navigation mock
const mockNavigate = vi.fn();
vi.mock("react-router", () => ({ useNavigate: () => mockNavigate }));

// i18next mock
// Simple passthrough: returns the key so assertions can match the key string.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && (opts.current !== undefined || opts.limit !== undefined)) {
        // Interpolate {{current}} and {{limit}} in the returned key string
        return key
          .replace("{{current}}", String(opts.current ?? ""))
          .replace("{{limit}}", String(opts.limit ?? ""));
      }
      return key;
    },
  }),
}));

// SubscriptionContext mock
import type { Plan, SubscriptionUsage } from "src/services/backend/subscriptionService";

const stubPlans: Plan[] = [
  { id: "1", name: "free",     monthly_price: 0,   currency: "UAH" },
  { id: "2", name: "pro",      monthly_price: 299,  currency: "UAH" },
  { id: "3", name: "advanced", monthly_price: 599,  currency: "UAH" },
  { id: "4", name: "business", monthly_price: 999,  currency: "UAH" },
];

const stubUsage: SubscriptionUsage = {
  devices_used: 2,
  device_limit: 2,
  scenarios_used: 3,
  scenario_limit: 3,
  ai_tokens_used: 0,
  ai_token_limit: null,
  ai_drafts_used: 30,
  ai_draft_limit: 30,
  device_sharing: false,
  ai_access: false,
};

vi.mock("src/contexts/SubscriptionContext", () => ({
  useSubscription: () => ({
    status: null,
    usage: stubUsage,
    plans: stubPlans,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

import UpgradeModal from "../UpgradeModal";
import type { GateKey } from "src/hooks/useGate";

afterEach(() => {
  cleanup();
  mockNavigate.mockReset();
});

// Helper
function renderModal(props: {
  feature: GateKey;
  current?: number;
  limit?: number | null;
  requiredPlan?: string;
  onClose?: () => void;
}, wrapper?: ({ children }: { children: ReactNode }) => ReactNode) {
  const onClose = props.onClose ?? vi.fn();
  return render(
    <UpgradeModal
      feature={props.feature}
      current={props.current}
      limit={props.limit}
      requiredPlan={props.requiredPlan}
      onClose={onClose}
    />,
    wrapper ? { wrapper } : undefined,
  );
}

// Tests

describe("UpgradeModal", () => {
  describe("gate-specific header rendering", () => {
    it("renders header for device_sharing", () => {
      renderModal({ feature: "device_sharing", requiredPlan: "pro" });
      // Modal.Header renders <h2>; PlanComparison renders <h3> — use level:2 to be specific
      expect(screen.getByRole("heading", { level: 2 })).toBeDefined();
      // The i18n key is passed through: gate.device_sharing.header
      expect(screen.getByText(/gate\.device_sharing\.header/)).toBeDefined();
    });

    it("renders header for device_limit with current/limit interpolation", () => {
      renderModal({ feature: "device_limit", current: 2, limit: 2, requiredPlan: "pro" });
      // Key passes through with interpolated values: gate.device_limit.header (current=2, limit=2)
      expect(screen.getByText(/gate\.device_limit\.header/)).toBeDefined();
    });

    it("renders header for scenario_limit", () => {
      renderModal({ feature: "scenario_limit", current: 3, limit: 3, requiredPlan: "pro" });
      expect(screen.getByText(/gate\.scenario_limit\.header/)).toBeDefined();
    });

    it("renders header for ai_draft_daily_limit", () => {
      renderModal({ feature: "ai_draft_daily_limit", current: 30, limit: 30, requiredPlan: "pro" });
      expect(screen.getByText(/gate\.ai_draft_daily_limit\.header/)).toBeDefined();
    });

    it("renders header for ai_access", () => {
      renderModal({ feature: "ai_access", requiredPlan: "pro" });
      expect(screen.getByText(/gate\.ai_access\.header/)).toBeDefined();
    });
  });

  describe("footer actions", () => {
    it('"View plans" calls navigate("/subscription") then onClose', () => {
      const onClose = vi.fn();
      renderModal({ feature: "device_sharing", requiredPlan: "pro", onClose });
      const viewPlansBtn = screen.getByText("gate.viewPlans");
      fireEvent.click(viewPlansBtn);
      expect(mockNavigate).toHaveBeenCalledWith("/subscription");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('"Dismiss" calls onClose', () => {
      const onClose = vi.fn();
      renderModal({ feature: "ai_access", requiredPlan: "pro", onClose });
      const dismissBtn = screen.getByText("gate.dismiss");
      fireEvent.click(dismissBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("Modal properties", () => {
    it("renders a dialog (Modal is open)", () => {
      renderModal({ feature: "device_sharing", requiredPlan: "pro" });
      expect(screen.getByRole("dialog")).toBeDefined();
    });

    it("applies size=full (max-w-5xl on dialog element)", () => {
      renderModal({ feature: "ai_access", requiredPlan: "pro" });
      const dialog = screen.getByRole("dialog");
      expect(dialog.className).toContain("max-w-5xl");
    });
  });
});
