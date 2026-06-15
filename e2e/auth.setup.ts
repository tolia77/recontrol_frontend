// e2e/auth.setup.ts — Playwright auth setup for the Phase 42.2 audit crawl.
//
// Logs in once via the committed audit fixtures (D-05 revised) and writes
// storageState to playwright/.auth/user.json so downstream crawl tests can
// reuse the authenticated session.
//
// Credentials come from e2e/audit-fixtures.ts — NOT process.env.
// Inputs are selected by name/type attribute (i18n label text differs by locale).
import { test as setup } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";
import { AUDIT_EMAIL, AUDIT_PASSWORD } from "./audit-fixtures";

// ESM does not expose __dirname; derive it from import.meta.url instead.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authFile = path.join(__dirname, "../playwright/.auth/user.json");

setup("authenticate as audit admin", async ({ page }) => {
  await page.goto("/login");
  // Select by input name/type — i18n label text differs by locale.
  await page.locator('input[name="email"]').fill(AUDIT_EMAIL);
  await page.locator('input[name="password"]').fill(AUDIT_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard");
  await page.context().storageState({ path: authFile });
});
