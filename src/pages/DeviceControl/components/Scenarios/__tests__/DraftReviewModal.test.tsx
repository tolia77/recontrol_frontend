/**
 * DraftReviewModal vitest — Phase 23 / Plan 23-09 Task 1.
 *
 * ≥14 examples covering: null when closed, per-step rendering, all 7
 * dry_intent pattern display names, amber badge classes + title attribute,
 * absence of badge when warning missing, footer button order, each
 * footer-button click → correct callback, ESC + backdrop dismiss, loading
 * state disables Accept, dialog accessibility attributes.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { scenarios as scenariosEn } from "src/locales/en/scenarios.ts";
import DraftReviewModal from "../DraftReviewModal";
import type { DraftResponse } from "src/services/backend/scenariosService.ts";

afterEach(() => cleanup());

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      ns: ["scenarios"],
      defaultNS: "scenarios",
      resources: { en: { scenarios: scenariosEn } },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  } else {
    await i18next.changeLanguage("en");
  }
});

type Draft = DraftResponse["draft"];

function makeDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    name: "Diagnose nginx",
    description: "Inspect logs and verify the service",
    command_steps: [
      {
        binary: "systemctl",
        args: ["status", "nginx"],
        cwd: "/",
        description: "Check service health",
      },
      {
        binary: "journalctl",
        args: ["-u", "nginx", "-n", "50"],
        cwd: "/var/log",
        description: null,
      },
    ],
    ...overrides,
  };
}

const noop = (): void => {};

const baseProps = {
  open: true,
  loading: false,
  onAccept: noop,
  onEdit: noop,
  onRegenerate: noop,
  onCancel: noop,
};

describe("DraftReviewModal", () => {
  it("returns null when open === false", () => {
    const { container } = render(
      <DraftReviewModal {...baseProps} open={false} draft={makeDraft()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all command_steps rows with binary/args/cwd", () => {
    const draft = makeDraft();
    render(<DraftReviewModal {...baseProps} draft={draft} />);
    // Two step rows
    expect(screen.getByTestId("draft-review-step-0")).toBeDefined();
    expect(screen.getByTestId("draft-review-step-1")).toBeDefined();
    // Binary+args composition
    expect(screen.getByTestId("draft-review-step-0-cmd").textContent).toContain(
      "systemctl status nginx",
    );
    expect(screen.getByTestId("draft-review-step-1-cmd").textContent).toContain(
      "journalctl -u nginx -n 50",
    );
    // cwd lines visible (use getAllByText since '/' is a substring of '/var/log')
    expect(screen.getAllByText(/^cwd: \/$/).length).toBe(1);
    expect(screen.getByText(/cwd: \/var\/log/)).toBeDefined();
  });

  it("renders an amber dry_intent badge with bg-warning/10 + text-warning + title attribute", () => {
    const draft = makeDraft({
      command_steps: [
        {
          binary: "find",
          args: ["/var/log", "-name", "*.gz", "-delete"],
          cwd: "/",
          description: null,
          dry_intent_warning: {
            pattern: "find_delete",
            message_key: "ai.dry_intent.find_delete",
          },
        },
      ],
    });
    render(<DraftReviewModal {...baseProps} draft={draft} />);
    const badge = screen.getByTestId("draft-review-dry-intent-find_delete");
    expect(badge).toBeDefined();
    // Visual classes
    expect(badge.className).toContain("bg-warning/10");
    expect(badge.className).toContain("text-warning");
    // ⚠ glyph + display name
    expect(badge.textContent).toContain("⚠");
    expect(badge.textContent).toContain("find -delete");
    // Tooltip via title attribute
    expect(badge.getAttribute("title")).toBe(
      scenariosEn.ai.dry_intent.find_delete,
    );
    // aria-label includes 'Warning:'
    expect(badge.getAttribute("aria-label")).toContain("Warning:");
  });

  it("does NOT render an amber badge when step lacks dry_intent_warning", () => {
    const draft = makeDraft();
    render(<DraftReviewModal {...baseProps} draft={draft} />);
    // Default fixture has no dry_intent_warning on either step
    expect(screen.queryByTestId(/draft-review-dry-intent-/)).toBeNull();
  });

  // (5) — parametric — all 7 pattern ids resolve to UI-SPEC display names
  const patternCases: Array<{
    pattern: string;
    display: string;
    key: keyof typeof scenariosEn.ai.dry_intent;
  }> = [
    { pattern: "find_delete", display: "find -delete", key: "find_delete" },
    { pattern: "dd_of_dev", display: "dd of=/dev/", key: "dd_of_dev" },
    {
      pattern: "chmod_777_recursive",
      display: "chmod -R 777",
      key: "chmod_777_recursive",
    },
    { pattern: "mkfs", display: "mkfs", key: "mkfs" },
    {
      pattern: "truncate_zero",
      display: "truncate -s 0",
      key: "truncate_zero",
    },
    {
      pattern: "redirect_to_system",
      display: "> /system path",
      key: "redirect_to_system",
    },
    {
      pattern: "rm_rf_root_adjacent",
      display: "rm -rf",
      key: "rm_rf_root_adjacent",
    },
  ];

  it.each(patternCases)(
    'resolves pattern $pattern → "$display"',
    ({ pattern, display, key }) => {
      const draft = makeDraft({
        command_steps: [
          {
            binary: "echo",
            args: ["test"],
            cwd: "/",
            description: null,
            dry_intent_warning: {
              pattern,
              message_key: `ai.dry_intent.${pattern}`,
            },
          },
        ],
      });
      render(<DraftReviewModal {...baseProps} draft={draft} />);
      const badge = screen.getByTestId(`draft-review-dry-intent-${pattern}`);
      expect(badge.textContent).toContain(display);
      expect(badge.getAttribute("title")).toBe(scenariosEn.ai.dry_intent[key]);
    },
  );

  it("footer renders [Discard draft] [Regenerate Draft] [Edit Draft] [Accept and save] in order", () => {
    render(<DraftReviewModal {...baseProps} draft={makeDraft()} />);
    const discard = screen.getByTestId("draft-review-discard");
    const regen = screen.getByTestId("draft-review-regenerate");
    const edit = screen.getByTestId("draft-review-edit");
    const accept = screen.getByTestId("draft-review-accept");
    // All four present
    expect(discard.textContent).toContain("Discard draft");
    expect(regen.textContent).toContain("Regenerate Draft");
    expect(edit.textContent).toContain("Edit Draft");
    expect(accept.textContent).toContain("Accept and save");
    // Visual document order: discard ... regen ... edit ... accept
    const all = [discard, regen, edit, accept];
    for (let i = 0; i < all.length - 1; i++) {
      expect(
        all[i].compareDocumentPosition(all[i + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("[Accept and save] click invokes onAccept exactly once", () => {
    const onAccept = vi.fn();
    render(
      <DraftReviewModal
        {...baseProps}
        draft={makeDraft()}
        onAccept={onAccept}
      />,
    );
    fireEvent.click(screen.getByTestId("draft-review-accept"));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("[Edit Draft] click invokes onEdit exactly once", () => {
    const onEdit = vi.fn();
    render(
      <DraftReviewModal {...baseProps} draft={makeDraft()} onEdit={onEdit} />,
    );
    fireEvent.click(screen.getByTestId("draft-review-edit"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("[Regenerate Draft] click invokes onRegenerate exactly once", () => {
    const onRegenerate = vi.fn();
    render(
      <DraftReviewModal
        {...baseProps}
        draft={makeDraft()}
        onRegenerate={onRegenerate}
      />,
    );
    fireEvent.click(screen.getByTestId("draft-review-regenerate"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("[Discard draft] click invokes onCancel exactly once", () => {
    const onCancel = vi.fn();
    render(
      <DraftReviewModal
        {...baseProps}
        draft={makeDraft()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId("draft-review-discard"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("Escape keydown invokes onCancel", () => {
    const onCancel = vi.fn();
    render(
      <DraftReviewModal
        {...baseProps}
        draft={makeDraft()}
        onCancel={onCancel}
      />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("backdrop click (target===currentTarget) invokes onCancel; inner card click does not", () => {
    const onCancel = vi.fn();
    render(
      <DraftReviewModal
        {...baseProps}
        draft={makeDraft()}
        onCancel={onCancel}
      />,
    );
    // Click inside inner card — should NOT cancel
    fireEvent.click(screen.getByTestId("draft-review-card"));
    expect(onCancel).not.toHaveBeenCalled();
    // Click on backdrop (which IS the currentTarget when clicked) — should cancel
    fireEvent.click(screen.getByTestId("draft-review-backdrop"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("loading=true disables [Accept and save] and shows spinner state", () => {
    render(
      <DraftReviewModal {...baseProps} draft={makeDraft()} loading={true} />,
    );
    const accept = screen.getByTestId(
      "draft-review-accept",
    ) as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
    // Button component renders a spinner span with animate-spin class when loading
    expect(accept.querySelector(".animate-spin")).not.toBeNull();
  });

  it("outer overlay has role=dialog, aria-modal=true, aria-label", () => {
    render(<DraftReviewModal {...baseProps} draft={makeDraft()} />);
    const backdrop = screen.getByTestId("draft-review-backdrop");
    expect(backdrop.getAttribute("role")).toBe("dialog");
    expect(backdrop.getAttribute("aria-modal")).toBe("true");
    expect(backdrop.getAttribute("aria-label")).toBe(
      scenariosEn.ai.draftReviewTitle,
    );
  });
});
