// Module-level callback bridge: the auth flows (Login / Signup) announce that
// the user just authenticated via triggerAuthChange; SubscriptionProvider
// registers the handler via setAuthChangeHandler on mount and re-fetches.
// Mirrors planLimitBus / usageInvalidationBus.
//
// Rationale: SubscriptionProvider is mounted once globally (above the router,
// see main.tsx) because gated consumers exist outside Layout (/device-control).
// Its mount fetch therefore runs before login and 401s, leaving a stale error
// in context that a same-session login (SPA navigate, no reload) never clears.
// This event lets the provider re-fetch on the logged-out -> logged-in
// transition without the provider re-implementing auth checks.
//
// Emit ONLY on real login/signup. Do NOT emit from saveTokens: that also runs
// on every silent token rotation (refreshAccessTokenOnce, ~1min TTL), which
// would refetch the subscription every minute. Logout needs no emit either --
// it does a full window.location reload that remounts the provider fresh.

let handler: (() => void) | null = null;

/**
 * Register (or clear) the global auth-change handler.
 * Call from SubscriptionProvider on mount / unmount.
 */
export function setAuthChangeHandler(fn: (() => void) | null): void {
  handler = fn;
}

/**
 * Signal that the user just authenticated (login / signup) and dependent
 * context should re-fetch. Safe no-op when no handler is registered.
 */
export function triggerAuthChange(): void {
  handler?.();
}
