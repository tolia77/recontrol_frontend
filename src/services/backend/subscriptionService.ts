import { backendInstance } from "src/services/backend/config.ts";

// ── Shared types ─────────────────────────────────────────────────────────────

export interface SubscriptionStatus {
  state: "pending" | "active" | "upgrading" | "past_due" | "cancelled" | "expired";
  plan_name: "free" | "pro" | "advanced" | "business";
  period_end: string | null;
  scheduled_plan: "free" | "pro" | "advanced" | "business" | null;
  price: number | null;       // kopiyky; null when plan has no price record
  currency: string | null;   // "UAH"
}

export interface Plan {
  id: string;
  name: "free" | "pro" | "advanced" | "business";
  monthly_price: number;     // kopiyky
  currency: string;
}

export interface SubscriptionUsage {
  devices_used: number;
  device_limit: number | null;       // null = unlimited
  scenarios_used: number;
  scenario_limit: number | null;     // null = unlimited
  ai_tokens_used: number;
  ai_token_limit: number | null;     // null = unlimited
  ai_drafts_used: number;
  ai_draft_limit: number | null;     // null = unlimited
  device_sharing: boolean;
  ai_access: boolean;                // server-provided runtime flag (RD-2)
}

export interface LiqPayBlob {
  data: string;
  signature: string;
  action_url: string;
}

export type UpgradeDowngradeResponse =
  | LiqPayBlob
  | { status: "downgrade_scheduled"; scheduled_plan: string };

export interface PlanLimitEnvelope {
  error: "plan_limit_reached";
  limit_name:
    | "device_limit"
    | "scenario_limit"
    | "ai_token_limit"
    | "ai_draft_limit"
    | "device_sharing"
    | "ai_access";
  limit: number | null;
  current: number;
  plan_name: string;
  reset_at?: string;
}

// ── SubscriptionContextValue (also exported for SubscriptionContext.tsx) ─────

export interface SubscriptionContextValue {
  status: SubscriptionStatus | null;  // null = never subscribed (404 from API)
  usage: SubscriptionUsage | null;   // null until first successful fetch
  plans: Plan[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// ── Internal response envelopes ───────────────────────────────────────────────

interface PlansResponse {
  plans: Plan[];
}

// ── subscriptionService ───────────────────────────────────────────────────────

export const subscriptionService = {
  async getStatus(): Promise<SubscriptionStatus> {
    const { data } = await backendInstance.get<SubscriptionStatus>(
      "/subscriptions/status",
    );
    return data;
  },

  async getPlans(): Promise<Plan[]> {
    const { data } = await backendInstance.get<PlansResponse>("/plans");
    return data.plans;
  },

  async getUsage(): Promise<SubscriptionUsage> {
    const { data } = await backendInstance.get<SubscriptionUsage>(
      "/subscriptions/usage",
    );
    return data;
  },

  async checkout(planId: string, resultUrl: string): Promise<LiqPayBlob> {
    const { data } = await backendInstance.post<LiqPayBlob>(
      "/subscriptions/checkout",
      { plan_id: planId, result_url: resultUrl },
    );
    return data;
  },

  async upgradeDowngrade(planId: string): Promise<UpgradeDowngradeResponse> {
    const { data } = await backendInstance.post<UpgradeDowngradeResponse>(
      "/subscriptions/upgrade-downgrade",
      { plan_id: planId },
    );
    return data;
  },

  async cancel(): Promise<{ status: string }> {
    const { data } = await backendInstance.delete<{ status: string }>(
      "/subscriptions/cancel",
    );
    return data;
  },
};
