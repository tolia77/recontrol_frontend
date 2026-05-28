/**
 * ScenariosPanel.ai-origin vitest — Phase 23 / Plan 23-11 Task 2 (AI-10).
 *
 * Verifies the OpenRouter `usage.total_tokens` round-trip:
 *   - DraftResponse carries usage.total_tokens at draft-time
 *   - Panel handleDraftReady stashes it on the modal state
 *   - [Accept and save] forwards it as `created_via_ai_token_count` in the
 *     scenariosService.create payload (the field the backend persists on
 *     `scenarios.created_via_ai_token_count` and copies onto
 *     `scenario_runs.total_ai_gen_tokens` at run start)
 *
 * The mock fabric mirrors ScenariosPanel.ai.test.tsx (Plan 23-09): the
 * `useDraftGeneration` hook is mocked so we can flip `hookState` to a
 * `{ kind: 'success', draft: DraftResponse }` and re-render. The segment's
 * own success-branch effect fires `onDraftReady(draft.draft, total_tokens)`
 * which the panel stashes on modal state.
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
import type { ScenarioRunBroadcast } from "../../../hooks/realtime/useScenarioRunChannel";
import type {
  DraftResponse,
  Scenario,
  ScenarioCreatePayload,
} from "src/services/backend/scenariosService.ts";

// -----------------------------------------------------------------------------
// Mocks (mirrors ScenariosPanel.ai.test.tsx — must precede component import)
// -----------------------------------------------------------------------------

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
  useScenarioRunChannel: (
    ws: WebSocket | null,
    onBroadcast: (msg: ScenarioRunBroadcast) => void,
  ) => {
    void ws;
    void onBroadcast;
    return { dispatch: vi.fn() };
  },
}));

vi.mock("src/i18n.ts", () => ({
  default: { language: "en" },
}));

type HookState =
  | { kind: "idle" }
  | { kind: "generating"; startedAt: number }
  | { kind: "success"; draft: DraftResponse }
  | { kind: "error"; code: string; details: unknown }
  | { kind: "cancelled" };

let hookState: HookState = { kind: "idle" };
const generateSpy = vi.fn();
const cancelSpy = vi.fn();
const resetSpy = vi.fn();

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

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

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

function makeDraftResponse(totalTokens: number): DraftResponse {
  return {
    draft: {
      name: "AI nginx diag",
      description: "AI-suggested diagnostic",
      command_steps: [
        {
          binary: "systemctl",
          args: ["status", "nginx"],
          cwd: "/",
          description: "Check service",
        },
      ],
    },
    quota: {
      tokens_used: 100,
      tokens_limit: 50000,
      drafts_used: 1,
      drafts_limit: 30,
    },
    usage: { total_tokens: totalTokens },
  };
}

function renderPanel(): ReturnType<typeof render> {
  const fakeWs = { readyState: 1 } as unknown as WebSocket;
  return render(
    <ToastProvider>
      <ScenariosPanel deviceId="dev-1" ws={fakeWs} deviceName="dev-1" />
    </ToastProvider>,
  );
}

function triggerSuccess(
  rerender: (ui: React.ReactElement) => void,
  draft: DraftResponse,
): void {
  hookState = { kind: "success", draft };
  rerender(
    <ToastProvider>
      <ScenariosPanel
        deviceId="dev-1"
        ws={{ readyState: 1 } as unknown as WebSocket}
        deviceName="dev-1"
      />
    </ToastProvider>,
  );
}

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Tests (Plan 23-11 / AI-10)
// -----------------------------------------------------------------------------

describe("ScenariosPanel — AI-10 token persistence", () => {
  it("[Accept and save] forwards usage.total_tokens as created_via_ai_token_count", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    mockedCreate.mockResolvedValue({
      scenario: makeScenario({ created_via_ai: true }),
    });

    const { rerender } = renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined(),
    );

    act(() => triggerSuccess(rerender, makeDraftResponse(1234)));
    await waitFor(() =>
      expect(screen.getByTestId("draft-review-accept")).toBeDefined(),
    );

    fireEvent.click(screen.getByTestId("draft-review-accept"));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());

    const payload = mockedCreate.mock.calls[0][0] as ScenarioCreatePayload;
    expect(payload.created_via_ai).toBe(true);
    expect(payload.created_via_ai_token_count).toBe(1234);
  });

  it("forwards a different token count (proves the value is not hardcoded)", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    mockedCreate.mockResolvedValue({
      scenario: makeScenario({ created_via_ai: true }),
    });

    const { rerender } = renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined(),
    );

    act(() => triggerSuccess(rerender, makeDraftResponse(5678)));
    await waitFor(() =>
      expect(screen.getByTestId("draft-review-accept")).toBeDefined(),
    );

    fireEvent.click(screen.getByTestId("draft-review-accept"));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());

    const payload = mockedCreate.mock.calls[0][0] as ScenarioCreatePayload;
    expect(payload.created_via_ai_token_count).toBe(5678);
  });

  it("forwards usage.total_tokens === 0 when backend reported zero (defensive)", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "ai");
    mockedCreate.mockResolvedValue({
      scenario: makeScenario({ created_via_ai: true }),
    });

    const { rerender } = renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("scenarios-ai-segment")).toBeDefined(),
    );

    act(() => triggerSuccess(rerender, makeDraftResponse(0)));
    await waitFor(() =>
      expect(screen.getByTestId("draft-review-accept")).toBeDefined(),
    );

    fireEvent.click(screen.getByTestId("draft-review-accept"));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());

    const payload = mockedCreate.mock.calls[0][0] as ScenarioCreatePayload;
    // 0 is a real value (not null) — backend will still persist it
    expect(payload.created_via_ai_token_count).toBe(0);
    // Sanity: created_via_ai stays true
    expect(payload.created_via_ai).toBe(true);
  });
});
