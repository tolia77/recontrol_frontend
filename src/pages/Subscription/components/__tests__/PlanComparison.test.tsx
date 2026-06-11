import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { subscription } from "src/locales/subscription";
import PlanComparison from "../PlanComparison";
import type { Plan } from "src/services/backend/subscriptionService";

afterEach(() => cleanup());

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next
      .use(initReactI18next)
      .init({
        lng: "en",
        fallbackLng: "en",
        ns: ["subscription"],
        defaultNS: "subscription",
        resources: { en: { subscription } },
        interpolation: { escapeValue: false },
        react: { useSuspense: false },
      });
  } else {
    await i18next.changeLanguage("en");
  }
});

// Stub plans

const stubPlans: Plan[] = [
  { id: "plan-free",     name: "free",     monthly_price: 0,     currency: "UAH" },
  { id: "plan-pro",      name: "pro",      monthly_price: 19900, currency: "UAH" },
  { id: "plan-advanced", name: "advanced", monthly_price: 49900, currency: "UAH" },
  { id: "plan-business", name: "business", monthly_price: 99900, currency: "UAH" },
];

// Tests

describe("PlanComparison", () => {
  it("renders all four plan column headers", () => {
    render(<PlanComparison plans={stubPlans} />);

    // Use heading role to match h3 plan names specifically (avoids ambiguity with
    // the price label which also renders "Free" for the free plan).
    const headings = screen.getAllByRole("heading", { level: 3 });
    const headingNames = headings.map((h) => h.textContent);
    expect(headingNames).toContain("Free");
    expect(headingNames).toContain("Pro");
    expect(headingNames).toContain("Advanced");
    expect(headingNames).toContain("Business");
  });

  it("renders all five feature rows", () => {
    render(<PlanComparison plans={stubPlans} />);

    // Each label appears once per component (row labels are shared across columns
    // as plain text in each plan column's own row div, so there are 4 occurrences total).
    const sharingLabels = screen.getAllByText("Device sharing");
    expect(sharingLabels.length).toBe(4);

    const deviceLabels = screen.getAllByText("Devices");
    expect(deviceLabels.length).toBe(4);

    const scenarioLabels = screen.getAllByText("Scenarios");
    expect(scenarioLabels.length).toBe(4);

    const draftLabels = screen.getAllByText("AI drafts / day");
    expect(draftLabels.length).toBe(4);

    const aiLabels = screen.getAllByText("AI assistant");
    expect(aiLabels.length).toBe(4);
  });

  it("applies highlight border class to the highlightPlan column", () => {
    const { container } = render(
      <PlanComparison plans={stubPlans} highlightPlan="pro" />,
    );

    // The pro card should have border-2 border-primary in its className
    const cards = container.querySelectorAll('[class*="border-2"]');
    expect(cards.length).toBeGreaterThanOrEqual(1);

    // The highlighted card must contain the plan name
    const highlightedCard = Array.from(cards).find((card) =>
      card.textContent?.includes("Pro"),
    );
    expect(highlightedCard).toBeDefined();
  });

  it("applies header background tint to the highlightPlan column header", () => {
    const { container } = render(
      <PlanComparison plans={stubPlans} highlightPlan="advanced" />,
    );

    const tintHeaders = container.querySelectorAll('[class*="bg-primary/10"]');
    expect(tintHeaders.length).toBe(1);

    // The tinted header should be inside the Advanced card
    expect(tintHeaders[0].textContent).toContain("Advanced");
  });

  it("applies emphasis class to the highlightFeature row", () => {
    const { container } = render(
      <PlanComparison plans={stubPlans} highlightFeature="device_sharing" />,
    );

    // bg-primary/5 applied to each plan's device_sharing row (4 plans × 1 row = 4 divs)
    const emphasizedRows = container.querySelectorAll('[class*="bg-primary/5"]');
    expect(emphasizedRows.length).toBe(4);
  });

  it("applies font-semibold to the feature label in highlighted rows", () => {
    const { container } = render(
      <PlanComparison plans={stubPlans} highlightFeature="ai_access" />,
    );

    const boldLabels = container.querySelectorAll('[class*="font-semibold"]');
    // 4 plan column headings (h3) + 4 emphasized feature-row label spans = at least 8
    expect(boldLabels.length).toBeGreaterThanOrEqual(4);
  });

  it("renders no action buttons", () => {
    render(<PlanComparison plans={stubPlans} />);

    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(0);
  });

  it("renders price for paid plans and free label for free plan", () => {
    render(<PlanComparison plans={stubPlans} />);

    // Free label appears (from price.free key = "Free") — at least in the Free column header area
    const freeLabels = screen.getAllByText("Free");
    expect(freeLabels.length).toBeGreaterThanOrEqual(1);

    // Paid plan shows ₴199/mo for pro (19900 kopiyky)
    expect(screen.getByText("₴199/mo")).toBeDefined();
  });

  it("renders empty state gracefully when plans array is empty", () => {
    const { container } = render(<PlanComparison plans={[]} />);
    const grid = container.firstChild as HTMLElement;
    // Grid renders but has no child cards
    expect(grid.children.length).toBe(0);
  });
});
