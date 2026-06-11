/**
 * ScenariosPanel.ai vitest — Phase 23 / Plan 23-09 Task 3.
 *
 * Integration coverage for the AI segment widening + DraftReviewModal mount
 * + Accept/Edit/Regenerate flow + sessionStorage rehydration + D-11
 * dry_intent_warning stripping at the Accept seam.
 *
 * ≥7 examples (we ship 10):
 *   1. SegmentedControl renders 3 pills (Library / History / AI)
 *   2. Clicking AI pill transitions panel mode to 'ai' AND mounts ScenariosAISegment
 *   3. onDraftReady opens DraftReviewModal with the draft
 *   4. [Accept and save] calls scenariosService.create with created_via_ai:true,
 *      closes modal, shows toast, transitions to library
 *   5. [Edit Draft] transitions to editor with prefill === draft AND backTarget='ai'
 *   6. Editor [← Back] with backTarget='ai' returns to AI segment, NOT library
 *   7. [Regenerate Draft] closes modal AND bumps regenerateToken so the segment
 *      re-fires generate(originalPrompt)
 *   8. sessionStorage rehydration: 'ai' value boots into AI mode
 *   9. D-11 dry_intent_warning stripping at Accept (both every-predicate AND
 *      JSON.stringify-contains assertions)
 *  10. Editor with backTarget='ai' renders "Back to AI prompt" label
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { scenarios as scenariosEn } from "src/locales/en/scenarios.ts";
import { ToastProvider } from "src/components/ui";
import type { ScenarioRunBroadcast } from "src/pages/DeviceControl/hooks/realtime/useScenarioRunChannel";
import type {
  DraftResponse,
  Scenario,
  ScenarioCreatePayload,
} from "src/services/backend/scenariosService.ts";

// Mocks — must be defined BEFORE importing the component.

vi.mock("src/services/backend/scenariosService.ts", async () => {
  const actual = await vi.importActual<
    typeof import("src/services/backend/scenariosService.ts")
  >("src/services/backend/scenariosService.ts");
  return {
    ...actual,
    scenariosService: {
      index: vi.fn(),
      show: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
      duplicate: vi.fn(),
      policyPreview: vi.fn(),
      createDraft: vi.fn(),
    },
  };
});

vi.mock("src/services/backend/scenarioRunsService.ts", async () => {
  const actual = await vi.importActual<
    typeof import("src/services/backend/scenarioRunsService.ts")
  >("src/services/backend/scenarioRunsService.ts");
  return {
    ...actual,
    scenarioRunsService: {
      index: vi.fn(),
      show: vi.fn(),
      destroy: vi.fn(),
      destroyAll: vi.fn(),
    },
  };
});

vi.mock("../../../hooks/realtime/useScenarioRunChannel", () => ({
  useScenarioRunChannel: ({
    onBroadcast,
  }: {
    consumer: unknown;
    onBroadcast: (msg: ScenarioRunBroadcast) => void;
  }) => {
    void onBroadcast;
    return { dispatch: vi.fn() };
  },
}));

// Mock i18n.language so the AISegment fires generate() with 'en'.
vi.mock("src/i18n.ts", () => ({
  i18n: { language: "en" },
}));

// Gate always open in panel-level tests — gate behaviour is unit-tested in useGate.test.ts.
vi.mock("src/hooks/useGate", () => ({
  useGate: () => ({ allowed: true, reason: null }),
}));

// Mock useDraftGeneration so we can drive the panel's AI flow deterministically.
type HookState =
  | { kind: "idle" }
  | { kind: "generating"; startedAt: number }
  | { kind: "success"; draft: DraftResponse }
  | { kind: "error"; code: string; details: unknown }
  | { kind: "cancelled" };

const generateSpy = vi.fn();
const cancelSpy = vi.fn();
const resetSpy = vi.fn();
// onDraftReady inside the segment effect is gated on state.kind === 'success';
// each test that wants to trigger handleDraftReady installs a state and uses
// the `forceSuccess` helper to flip the mocked hook + re-render.
let hookState: HookState = { kind: "idle" };

// React hook re-render trigger: each call to the mock returns the latest
// hookState. To force re-evaluation we wrap the panel in a "version" key.
vi.mock("../useDraftGeneration", () => ({
  useDraftGeneration: () => ({
    state: hookState,
    generate: generateSpy,
    cancel: cancelSpy,
    reset: resetSpy,
  }),
}));

import { scenariosService } from "src/services/backend/scenariosService.ts";
import { scenarioRunsService } from "src/services/backend/scenarioRunsService.ts";
import ScenariosPanel from "../ScenariosPanel";

const mockedCreate = vi.mocked(scenariosService.create);
const mockedIndex = vi.mocked(scenariosService.index);
const mockedRunsIndex = vi.mocked(scenarioRunsService.index);

// Fixtures

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: "scen-1",
    user_id: "user-1",
    name: "Diagnose nginx",
    description: null,
    command_steps: [{ id: "cs-0", binary: "ls", args: ["-la"], cwd: "/" }],
    pinned_device_id: null,
    is_shared: false,
    created_via_ai: false,
    owner_email: null,
    created_at: "2026-05-19T00:00:00Z",
    updated_at: "2026-05-19T00:00:00Z",
    last_run_at: null,
    run_count: 0,
    ...overrides,
  };
}

function makeDraftResponse(): DraftResponse {
  return {
    draft: {
      name: "AI Diagnose nginx",
      description: "AI-suggested diagnostic",
      command_steps: [
        {
          binary: "systemctl",
          args: ["status", "nginx"],
          cwd: "/",
          description: "Check service",
        },
        {
          binary: "find",
          args: ["/var/log", "-name", "*.gz", "-delete"],
          cwd: "/",
          description: "Cleanup",
          dry_intent_warning: {
            pattern: "find_delete",
            message_key: "ai.dry_intent.find_delete",
          },
        },
      ],
    },
    quota: {
      tokens_used: 100,
      tokens_limit: 50000,
      drafts_used: 1,
      drafts_limit: 30,
    },
    usage: { total_tokens: 456 },
  };
}

function renderPanel(deviceId: string = "dev-1") {
  return render(
    <ToastProvider>
      <ScenariosPanel deviceId={deviceId} consumer={null} connected={true} deviceName="dev-1" />
    </ToastProvider>,
  );
}

// Lifecycle

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

function ensureStorageStubs(): void {
  const memoryStorage = (): Storage => {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      removeItem: (k: string) => {
        map.delete(k);
      },
      setItem: (k: string, v: string) => {
        map.set(k, String(v));
      },
    };
  };
  try {
    if (
      typeof localStorage === "undefined" ||
      typeof localStorage.getItem !== "function"
    ) {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: memoryStorage(),
      });
    }
  } catch {
    /* ignore */
  }
  try {
    if (
      typeof sessionStorage === "undefined" ||
      typeof sessionStorage.getItem !== "function"
    ) {
      Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: memoryStorage(),
      });
    }
  } catch {
    /* ignore */
  }
}

beforeEach(() => {
  ensureStorageStubs();
  sessionStorage.clear();
  localStorage.clear();
  mockedIndex.mockResolvedValue([makeScenario()]);
  mockedRunsIndex.mockResolvedValue({ runs: [], total: 0 });
  mockedCreate.mockReset();
  generateSpy.mockReset();
  cancelSpy.mockReset();
  resetSpy.mockReset();
  hookState = { kind: "idle" };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Tests

describe("ScenariosPanel — AI segment widening (Plan 23-09)", () => {
  it("renders 3-segment SegmentedControl: Library / History / AI", async () => {
    renderPanel();
    await waitFor(() => {
      expect(
        screen.getByTestId("scenarios-panel-segment-library"),
      ).toBeDefined();
    });
    expect(screen.getByTestId("scenarios-panel-segment-history")).toBeDefined();
    expect(screen.getByTestId("scenarios-panel-segment-ai")).toBeDefined();
    expect(
      screen.getByTestId("scenarios-panel-segment-ai").textContent,
    ).toContain("AI");
  });

  it("clicking the AI pill mounts ScenariosAISegment", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-panel-segment-ai")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("scenarios-panel-segment-ai"));
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined();
    });
    // Prompt textarea from ScenariosAISegment visible
    expect(screen.getByLabelText(scenariosEn.ai.promptLabel)).toBeDefined();
  });

  it('sessionStorage rehydration: setItem("ai") → mount boots into AI mode', async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined();
    });
    // AI segment pill is the active one
    const aiPill = screen.getByTestId("scenarios-panel-segment-ai");
    expect(aiPill.getAttribute("aria-selected")).toBe("true");
  });
});

describe("ScenariosPanel — DraftReviewModal flow", () => {
  function triggerSuccess(rerender: (ui: React.ReactElement) => void) {
    // Flip the mocked hook to success and force a re-render so the segment's
    // success-effect fires `onDraftReady`.
    hookState = { kind: "success", draft: makeDraftResponse() };
    rerender(
      <ToastProvider>
        <ScenariosPanel
          deviceId="dev-1"
          consumer={null}
          connected={true}
          deviceName="dev-1"
        />
      </ToastProvider>,
    );
  }

  it("onDraftReady opens DraftReviewModal with the draft", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    const { rerender } = renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined();
    });
    act(() => {
      triggerSuccess(rerender);
    });
    await waitFor(() => {
      expect(screen.getByTestId("draft-review-backdrop")).toBeDefined();
    });
    expect(screen.getByTestId("draft-review-name").textContent).toBe(
      "AI Diagnose nginx",
    );
  });

  it("[Accept and save] calls scenariosService.create with created_via_ai:true and transitions to library", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    mockedCreate.mockResolvedValue({
      scenario: makeScenario({ created_via_ai: true }),
    });
    const { rerender } = renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined(),
    );
    act(() => triggerSuccess(rerender));
    await waitFor(() =>
      expect(screen.getByTestId("draft-review-accept")).toBeDefined(),
    );
    fireEvent.click(screen.getByTestId("draft-review-accept"));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    const payload = mockedCreate.mock.calls[0][0] as ScenarioCreatePayload & {
      created_via_ai?: boolean;
    };
    expect(payload.created_via_ai).toBe(true);
    expect(payload.name).toBe("AI Diagnose nginx");
    // Modal closes
    await waitFor(() =>
      expect(screen.queryByTestId("draft-review-backdrop")).toBeNull(),
    );
    // Transitions to library
    await waitFor(() =>
      expect(screen.getByTestId("scenarios-list")).toBeDefined(),
    );
  });

  it("D-11: Accept payload strips dry_intent_warning from every step", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    mockedCreate.mockResolvedValue({
      scenario: makeScenario({ created_via_ai: true }),
    });
    const { rerender } = renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined(),
    );
    act(() => triggerSuccess(rerender));
    await waitFor(() =>
      expect(screen.getByTestId("draft-review-accept")).toBeDefined(),
    );
    fireEvent.click(screen.getByTestId("draft-review-accept"));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    const payload = mockedCreate.mock.calls[0][0] as ScenarioCreatePayload;
    // EVERY step in the payload lacks the dry_intent_warning key
    expect(
      payload.command_steps.every(
        (s) => !Object.prototype.hasOwnProperty.call(s, "dry_intent_warning"),
      ),
    ).toBe(true);
    // Defensive serialized check — guarantees no nested re-introduction
    expect(JSON.stringify(payload)).not.toContain("dry_intent_warning");
  });

  it("[Edit Draft] transitions to editor with prefill + backTarget=ai", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    const { rerender } = renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined(),
    );
    act(() => triggerSuccess(rerender));
    await waitFor(() =>
      expect(screen.getByTestId("draft-review-edit")).toBeDefined(),
    );
    fireEvent.click(screen.getByTestId("draft-review-edit"));
    // Modal closes, editor mounts
    await waitFor(() =>
      expect(screen.queryByTestId("draft-review-backdrop")).toBeNull(),
    );
    await waitFor(() =>
      expect(screen.getByTestId("scenario-editor")).toBeDefined(),
    );
    // Editor name field seeded from prefill
    const nameInput = screen.getByTestId("editor-name") as HTMLInputElement;
    expect(nameInput.value).toBe("AI Diagnose nginx");
    // Back button label is the AI variant
    expect(screen.getByTestId("editor-back").textContent).toContain(
      "← Back to AI prompt",
    );
  });

  it("Editor [← Back] with backTarget=ai returns to AI segment, NOT library", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    const { rerender } = renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined(),
    );
    act(() => triggerSuccess(rerender));
    await waitFor(() =>
      expect(screen.getByTestId("draft-review-edit")).toBeDefined(),
    );
    fireEvent.click(screen.getByTestId("draft-review-edit"));
    await waitFor(() =>
      expect(screen.getByTestId("editor-back")).toBeDefined(),
    );
    // The form is dirty because prefill seeded values — DirtyGuardModal will
    // fire. To bypass dirty-state for this back-routing check, we use Discard
    // inside the dirty modal. Actually simpler: the back button under
    // backTarget='ai' should route to AI even after we discard via dirty.
    fireEvent.click(screen.getByTestId("editor-back"));
    // After click: either the dirty modal appears OR we go straight back.
    // Since the editor seeds and immediately matches the snapshot (dirty=false
    // initially) — let's just check we're not in the editor anymore.
    await waitFor(() => {
      expect(screen.queryByTestId("scenario-editor")).toBeNull();
    });
    // Should be back in AI segment
    expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined();
    expect(screen.queryByTestId("scenarios-list")).toBeNull();
  });

  it("[Discard draft] closes modal without saving", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    const { rerender } = renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined(),
    );
    act(() => triggerSuccess(rerender));
    await waitFor(() =>
      expect(screen.getByTestId("draft-review-discard")).toBeDefined(),
    );
    fireEvent.click(screen.getByTestId("draft-review-discard"));
    await waitFor(() =>
      expect(screen.queryByTestId("draft-review-backdrop")).toBeNull(),
    );
    expect(mockedCreate).not.toHaveBeenCalled();
    // Still on AI segment
    expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined();
  });

  it("[Regenerate Draft] closes modal AND fires generate() with prior prompt", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    const { rerender } = renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined(),
    );
    // First: simulate operator typing + clicking Generate to capture prompt.
    const textarea = screen.getByLabelText(scenariosEn.ai.promptLabel);
    fireEvent.change(textarea, {
      target: { value: "diagnose nginx logs" },
    });
    // Find the Generate button by its accent label.
    const generateBtn = screen
      .getByText(scenariosEn.ai.generate)
      .closest("button");
    expect(generateBtn).not.toBeNull();
    fireEvent.click(generateBtn!);
    // generate spy was called with the prompt; the segment captured
    // lastAIPrompt at the panel via onPromptSubmitted.
    expect(generateSpy).toHaveBeenCalledWith("diagnose nginx logs", "en");
    generateSpy.mockClear();
    // Now drive success → modal opens
    act(() => triggerSuccess(rerender));
    await waitFor(() =>
      expect(screen.getByTestId("draft-review-regenerate")).toBeDefined(),
    );
    // Flip hook back to 'idle' so the regenerate-token effect can call generate
    // again without the segment short-circuiting on the same success state.
    hookState = { kind: "idle" };
    fireEvent.click(screen.getByTestId("draft-review-regenerate"));
    // Modal closes
    await waitFor(() =>
      expect(screen.queryByTestId("draft-review-backdrop")).toBeNull(),
    );
    // Segment regenerate-token effect re-fires generate with the original
    // prompt. Since the panel re-renders after the token bump and our mocked
    // hook returns idle, the effect should fire.
    await waitFor(() => {
      expect(generateSpy).toHaveBeenCalledWith("diagnose nginx logs", "en");
    });
  });
});
