/**
 * ScenariosAISegment vitest — Phase 23 / Plan 23-08 Task 2.
 *
 * vi.mocks `useDraftGeneration` so each test pins the hook to a known state
 * shape and inspects the rendered UI. The hook itself is exercised in its own
 * spec (useDraftGeneration.test.ts) — this file verifies the segment wires
 * state → UI per UI-SPEC ScenariosAISegment Layout (lines 119-165).
 *
 * Coverage (≥10 examples; threat-model anchor: T-23-31 lastPrompt persistence,
 * verified via Storage.prototype.setItem spy with zero calls):
 *   1. Renders prompt textarea (maxLength=1000) + placeholder + Generate label
 *   2. Generate disabled when prompt empty; enabled after typing
 *   3. Generate click invokes hook.generate with (prompt, 'en')
 *   4. state.generating → button label switches to ⏹ Cancel, counter visible,
 *      textarea disabled
 *   5. Cancel click invokes hook.cancel
 *   6. state.success → onDraftReady(draft.draft) invoked
 *   7. state.error 'draft_unparseable' → error card with unparseable copy
 *   8a-8e. error code routing per code
 *   9. Dismiss hides error card; prompt text preserved (D-06)
 *   10. Quota indicator renders both rows; turns amber at >=90% usage
 *   11. lastPrompt display: no sessionStorage / localStorage setItem calls
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { scenarios as scenariosEn } from "src/locales/en/scenarios.ts";
import type {
  DraftQuota,
  DraftResponse,
} from "src/services/backend/scenariosService.ts";
import type {
  DraftGenerationState,
  UseDraftGenerationResult,
} from "../useDraftGeneration";

// Mock i18n.language → always 'en' for deterministic locale assertion.
vi.mock("src/i18n.ts", () => ({
  i18n: { language: "en" },
}));

// Mock useGate — gate defaults open (allowed: true) so the existing tests
// exercise the original Generate flow unchanged. Gate-closed behaviour is
// covered by the gate unit tests in src/hooks/__tests__/useGate.test.ts.
vi.mock("src/hooks/useGate", () => ({
  useGate: () => ({ allowed: true, reason: null }),
}));

// Mock useDraftGeneration. Each test sets hookState + spies via mockReturnValue.
const generateSpy = vi.fn();
const cancelSpy = vi.fn();
const resetSpy = vi.fn();
let hookState: DraftGenerationState = { kind: "idle" };

vi.mock("../useDraftGeneration", () => ({
  useDraftGeneration: (): UseDraftGenerationResult => ({
    state: hookState,
    generate: generateSpy,
    cancel: cancelSpy,
    reset: resetSpy,
  }),
}));

// Importing AFTER vi.mock so the component picks up the mocked hook.
import ScenariosAISegment from "../ScenariosAISegment";

afterEach(() => {
  cleanup();
  generateSpy.mockReset();
  cancelSpy.mockReset();
  resetSpy.mockReset();
  hookState = { kind: "idle" };
});

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

function makeDraft(): DraftResponse {
  return {
    draft: {
      name: "Diagnose nginx",
      description: "Check nginx status",
      command_steps: [
        {
          binary: "systemctl",
          args: ["status", "nginx"],
          cwd: "/",
          description: null,
        },
      ],
    },
    quota: {
      tokens_used: 100,
      tokens_limit: 10000,
      drafts_used: 1,
      drafts_limit: 30,
    },
    usage: { total_tokens: 123 },
  };
}

function defaultProps(
  overrides: Partial<{
    onDraftReady: (d: DraftResponse["draft"], totalTokens: number) => void;
    initialQuota: DraftQuota;
  }> = {},
) {
  return {
    onDraftReady: vi.fn(),
    initialQuota: undefined,
    ...overrides,
  };
}

describe("ScenariosAISegment", () => {
  it("1. renders prompt textarea (maxLength=1000), placeholder, and Generate button", () => {
    render(<ScenariosAISegment {...defaultProps()} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea).toBeDefined();
    expect(textarea.maxLength).toBe(1000);
    expect(textarea.placeholder).toBe(
      "e.g. Diagnose why nginx isn't responding",
    );
    expect(
      screen.getByRole("button", { name: /generate draft/i }),
    ).toBeDefined();
  });

  it("2. Generate button is disabled when prompt is empty; enabled after typing", () => {
    render(<ScenariosAISegment {...defaultProps()} />);
    const btn = screen.getByRole("button", {
      name: /generate draft/i,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "restart nginx" } });
    expect(btn.disabled).toBe(false);
  });

  it('3. typing + clicking Generate invokes hook.generate(prompt, "en")', () => {
    render(<ScenariosAISegment {...defaultProps()} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "restart nginx" } });
    fireEvent.click(screen.getByRole("button", { name: /generate draft/i }));
    expect(generateSpy).toHaveBeenCalledTimes(1);
    // Third arg is the target platform — undefined here (no platform prop).
    expect(generateSpy).toHaveBeenCalledWith("restart nginx", "en", undefined);
  });

  it("4. state.generating → button label switches to ⏹ Cancel, counter visible, textarea disabled", () => {
    hookState = { kind: "generating", startedAt: Date.now() };
    render(<ScenariosAISegment {...defaultProps()} />);
    expect(
      screen.getByRole("button", { name: /cancel generation/i }),
    ).toBeDefined();
    // Elapsed counter — at startedAt = now, the counter reads 0 seconds.
    expect(screen.getByText(/Generating/i)).toBeDefined();
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it("5. Cancel click while generating invokes hook.cancel", () => {
    hookState = { kind: "generating", startedAt: Date.now() };
    render(<ScenariosAISegment {...defaultProps()} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel generation/i }));
    expect(cancelSpy).toHaveBeenCalledTimes(1);
  });

  it("6. state.success → onDraftReady is invoked with the inner draft payload and usage.total_tokens", () => {
    const draft = makeDraft();
    hookState = { kind: "success", draft };
    const onDraftReady = vi.fn();
    render(<ScenariosAISegment {...defaultProps({ onDraftReady })} />);
    expect(onDraftReady).toHaveBeenCalledTimes(1);
    // Plan 23-11 (AI-10): second arg is `usage.total_tokens` for end-to-end
    // token persistence onto `scenarios.created_via_ai_token_count`.
    expect(onDraftReady).toHaveBeenCalledWith(
      draft.draft,
      draft.usage.total_tokens,
    );
  });

  it("7. state.error draft_unparseable → error card renders unparseable copy", () => {
    hookState = { kind: "error", code: "draft_unparseable" };
    render(<ScenariosAISegment {...defaultProps()} />);
    const card = screen.getByTestId("ai-error-card");
    expect(card).toBeDefined();
    expect(card.textContent).toContain("invalid draft");
  });

  it.each([
    [
      "draft_unsafe",
      /step .* rejected by the safety policy/i,
      { response: { data: { step_index: 1 } } },
    ],
    [
      "draft_attempts_exceeded",
      /30 daily AI draft attempts/i,
      { response: { data: { resets_in: "in 5 minutes" } } },
    ],
    [
      "tokens_exceeded",
      /AI token limit/i,
      { response: { data: { resets_in: "in 1 hour" } } },
    ],
    ["network", /Couldn't reach the AI service/i, undefined],
    ["upstream_rate_limited", /Too many requests/i, undefined],
  ])(
    "8. error code %s → renders matching localized copy",
    (code, pattern, details) => {
      hookState = { kind: "error", code, details };
      render(<ScenariosAISegment {...defaultProps()} />);
      const card = screen.getByTestId("ai-error-card");
      expect(card.textContent).toMatch(pattern);
    },
  );

  it("9. Dismiss click hides error card AND preserves prompt text", () => {
    hookState = { kind: "error", code: "draft_unparseable" };
    render(<ScenariosAISegment {...defaultProps()} />);
    // First type into the textarea — error already showing, but prompt input
    // remains enabled in error state.
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "restart nginx" } });
    expect(textarea.value).toBe("restart nginx");

    expect(screen.getByTestId("ai-error-card")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByTestId("ai-error-card")).toBeNull();
    // Prompt text retained per D-06.
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "restart nginx",
    );
  });

  it("10. quota indicator renders both rows; turns amber when usage >= 90%", () => {
    const amberQuota: DraftQuota = {
      tokens_used: 100,
      tokens_limit: 10000,
      drafts_used: 28, // >= 30 * 0.9 = 27
      drafts_limit: 30,
    };
    render(
      <ScenariosAISegment {...defaultProps({ initialQuota: amberQuota })} />,
    );
    const quotaCard = screen.getByTestId("ai-quota-card");
    expect(quotaCard.textContent).toContain("28 / 30");
    expect(quotaCard.textContent).toContain("100 / 10000");
    // Amber class applied to the inner wrapper.
    expect(quotaCard.innerHTML).toContain("text-warning");
  });

  it("10b. quota indicator stays muted (not amber) under 90% usage", () => {
    const okQuota: DraftQuota = {
      tokens_used: 100,
      tokens_limit: 10000,
      drafts_used: 5,
      drafts_limit: 30,
    };
    render(<ScenariosAISegment {...defaultProps({ initialQuota: okQuota })} />);
    const quotaCard = screen.getByTestId("ai-quota-card");
    expect(quotaCard.innerHTML).not.toContain("text-warning");
    expect(quotaCard.innerHTML).toContain("text-muted-foreground");
  });

  it("11. last-prompt display appears after generate; NO sessionStorage/localStorage setItem calls", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    setItemSpy.mockClear();

    render(<ScenariosAISegment {...defaultProps()} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "restart nginx" } });
    fireEvent.click(screen.getByRole("button", { name: /generate draft/i }));

    // The last-prompt display should now be rendered (state still idle in the
    // mock hook — the component stamps lastPrompt synchronously on Generate
    // click).
    expect(screen.getByTestId("ai-last-prompt").textContent).toContain(
      "restart nginx",
    );

    // T-23-31 mitigation: lastPrompt is component-state ONLY. Verify no
    // Storage.setItem calls occurred during the flow.
    expect(setItemSpy).not.toHaveBeenCalled();

    setItemSpy.mockRestore();
  });
});
