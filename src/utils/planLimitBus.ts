import type { PlanLimitEnvelope } from "src/services/backend/subscriptionService.ts";

// Module-level callback bridge: the axios response interceptor (module-level
// code, outside React) calls triggerPlanLimitNudge; Layout registers the
// handler via setPlanLimitHandler on mount.

let handler: ((envelope: PlanLimitEnvelope) => void) | null = null;

/**
 * Register (or clear) the global plan-limit nudge handler.
 * Call from Layout on mount / unmount.
 */
export function setPlanLimitHandler(
  fn: ((envelope: PlanLimitEnvelope) => void) | null,
): void {
  handler = fn;
}

/**
 * Trigger the global upgrade nudge with the 402 envelope.
 * Safe no-op when no handler is registered.
 */
export function triggerPlanLimitNudge(envelope: PlanLimitEnvelope): void {
  handler?.(envelope);
}
