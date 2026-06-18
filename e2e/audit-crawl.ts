// e2e/audit-crawl.ts — headless hot-path network audit crawl.
//
// Captures per-route network waterfalls for all headless-crawlable routes.
// The operator-assisted DeviceControl path is excluded (it requires a real
// desktop device connected). Only routes that render correctly in headless
// mode are included in HOT_PATHS below.
//
// Auth flows via the committed audit fixtures (e2e/audit-fixtures.ts) through
// the auth.setup.ts storageState — credentials are NOT read from the environment.
//
// Transient 401s are tolerated: the in-browser axios interceptor auto-refreshes
// the 1-minute JWT access token. Tests do not fail on auth-refresh round-trips.
//
// Output: .audit/<name>-waterfall.json per route (gitignored).
//
// Run:
//   npx playwright test e2e/ --project=setup
//   npx playwright test e2e/audit-crawl.ts --project=chromium
import { test, expect } from "@playwright/test";
import * as fs from "fs";

// Backend base URL loaded from .env.audit (VITE_BACKEND_URL=http://127.0.0.1:3013).
// We filter captured requests to backend calls by checking for :3013 in the URL.
const AUDIT_BACKEND_HOST = "127.0.0.1:3013";

// Headless-crawlable hot paths derived from App.tsx route table.
// Routes requiring an operator-assisted session are intentionally omitted:
//   - The streaming control page requires a real desktop device.
//   - /subscription/return requires a payment-provider redirect.
//   - /devices/:deviceId/settings requires a known device UUID in the URL.
const HOT_PATHS = [
  { name: "dashboard", path: "/dashboard" },
  { name: "devices", path: "/devices" },
  { name: "scenarios", path: "/scenarios" },
  { name: "subscription", path: "/subscription" },
  { name: "admin-users", path: "/admin/users" },
  { name: "admin-subs", path: "/admin/subscriptions" },
  { name: "admin-devices", path: "/admin/devices" },
  { name: "admin-ai-usage", path: "/admin/ai-usage" },
  { name: "pricing", path: "/pricing" },
  { name: "settings", path: "/settings" },
];

interface RequestEntry {
  url: string;
  method: string;
  status: number;
  startTime: number;
  // Timing fields (ms). Cached/reused connections return -1 for DNS/connect
  // fields; Math.max(0, ...) guards clamp those to 0 (Pitfall 2).
  dnsMs: number;
  connectMs: number;
  requestMs: number;
  responseMs: number;
  totalMs: number;
}

for (const route of HOT_PATHS) {
  test(`audit: ${route.name}`, async ({ page }) => {
    const entries: RequestEntry[] = [];

    // Register response listener before navigation so we capture all requests
    // including the initial document request.
    page.on("response", (res) => {
      const req = res.request();
      // Only capture requests to the audit backend (port 3013).
      if (!req.url().includes(AUDIT_BACKEND_HOST)) return;

      const t = req.timing();
      entries.push({
        url: req.url(),
        method: req.method(),
        status: res.status(),
        startTime: t.startTime,
        // Guard every delta against -1 (cached/reused connection, no measurement).
        dnsMs: Math.max(0, t.domainLookupEnd - t.domainLookupStart),
        connectMs: Math.max(0, t.connectEnd - t.connectStart),
        requestMs: Math.max(0, t.responseStart - t.requestStart),
        responseMs: Math.max(0, t.responseEnd - t.responseStart),
        // totalMs: time from request start to full response received
        totalMs: Math.max(0, t.responseEnd - t.requestStart),
      });
    });

    await page.goto(route.path);
    // Wait for all in-flight XHR/fetch activity to settle (networkidle = no
    // more than 0 connections for at least 500ms). Tolerates auth refresh 401s
    // because the in-browser interceptor handles them transparently.
    await page.waitForLoadState("networkidle");

    // Write per-route waterfall to the gitignored .audit/ directory.
    fs.mkdirSync(".audit", { recursive: true });
    fs.writeFileSync(
      `.audit/${route.name}-waterfall.json`,
      JSON.stringify({ route: route.path, entries }, null, 2),
    );

    // Basic smoke: the authenticated session must still be active after nav.
    // The page should NOT have been redirected to /login (would indicate auth failure).
    // This is more robust than toBeEmpty() which can fail when React is still
    // mounting children after networkidle fires.
    expect(page.url()).not.toContain("/login");
  });
}
