// Module-level callback bridge: backend service classes (outside React) call
// triggerUsageInvalidation after a successful count-changing mutation;
// SubscriptionProvider registers the handler via setUsageInvalidationHandler on
// mount. Mirrors planLimitBus. Debounced so a burst of mutations (e.g. bulk
// delete) coalesces into a single GET /subscriptions/usage refresh.

let handler: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Register (or clear) the global usage-invalidation handler.
 * Call from SubscriptionProvider on mount / unmount.
 */
export function setUsageInvalidationHandler(fn: (() => void) | null): void {
  handler = fn;
}

/**
 * Signal that server-side usage may have changed and should be re-fetched.
 * Debounced (300ms trailing). Safe no-op when no handler is registered.
 */
export function triggerUsageInvalidation(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    handler?.();
  }, 300);
}
