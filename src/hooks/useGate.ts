// UX gate only — backend 402 is the authoritative enforcement; fail-open when usage is null.
// requiredPlan uses tier ORDERING + current plan only — never per-tier numeric limits.
import { useSubscription } from "src/contexts/SubscriptionContext";

// Types

export type GateKey =
  | "device_sharing"
  | "device_limit"
  | "scenario_limit"
  | "ai_draft_daily_limit"
  | "ai_access";

export interface GateResult {
  allowed: boolean;
  reason: "feature" | "count" | null;
  current?: number;
  limit?: number | null;
  requiredPlan?: string;
}

// Tier ordering

const TIER_ORDER = ["free", "pro", "advanced", "business"] as const;

// Static map: which tier first unlocks each boolean-gated feature.
// These are feature-unlock tiers only, NOT numeric limit values.
const BOOLEAN_GATE_UNLOCK_TIER: Record<"device_sharing" | "ai_access", string> =
  {
    device_sharing: "pro",
    ai_access: "pro",
  };

// Helpers

/**
 * Returns the plan name of the cheapest paid tier strictly ABOVE the user's
 * current plan, or undefined if the current plan is already the top tier.
 * Uses tier ordering only — no numeric per-plan limit constants.
 */
function nextTierAbove(currentPlanName: string): string | undefined {
  const idx = TIER_ORDER.indexOf(
    currentPlanName as (typeof TIER_ORDER)[number],
  );
  // idx === -1 means unknown tier; treat like free (idx 0) — next is "pro"
  const currentIdx = idx === -1 ? 0 : idx;
  const nextIdx = currentIdx + 1;
  if (nextIdx >= TIER_ORDER.length) return undefined; // already on top tier
  return TIER_ORDER[nextIdx];
}

// Hook

export function useGate(gate: GateKey): GateResult {
  const { usage, plans, status } = useSubscription();

  // Fail-open: if usage is null (still loading), never block the user.
  if (!usage) return { allowed: true, reason: null };

  const currentPlanName = status?.plan_name ?? "free";

  // Boolean gates
  if (gate === "device_sharing") {
    if (usage.device_sharing) return { allowed: true, reason: null };
    const unlockTier = BOOLEAN_GATE_UNLOCK_TIER.device_sharing;
    const catalogPlan = plans.find((p) => p.name === unlockTier);
    return {
      allowed: false,
      reason: "feature",
      requiredPlan: catalogPlan?.name ?? unlockTier,
    };
  }

  if (gate === "ai_access") {
    if (usage.ai_access) return { allowed: true, reason: null };
    const unlockTier = BOOLEAN_GATE_UNLOCK_TIER.ai_access;
    const catalogPlan = plans.find((p) => p.name === unlockTier);
    return {
      allowed: false,
      reason: "feature",
      requiredPlan: catalogPlan?.name ?? unlockTier,
    };
  }

  // Count gates
  let used: number;
  let limit: number | null;

  if (gate === "device_limit") {
    used = usage.devices_used;
    limit = usage.device_limit;
  } else if (gate === "scenario_limit") {
    used = usage.scenarios_used;
    limit = usage.scenario_limit;
  } else {
    // ai_draft_daily_limit
    used = usage.ai_drafts_used;
    limit = usage.ai_draft_limit;
  }

  // null limit means unlimited — always allowed
  if (limit === null || used < limit) return { allowed: true, reason: null };

  // At or over the limit — gate is closed
  const nextTier = nextTierAbove(currentPlanName);
  const catalogPlan = nextTier
    ? plans.find((p) => p.name === nextTier)
    : undefined;
  const requiredPlan = catalogPlan?.name ?? nextTier;

  return {
    allowed: false,
    reason: "count",
    current: used,
    limit,
    requiredPlan,
  };
}
