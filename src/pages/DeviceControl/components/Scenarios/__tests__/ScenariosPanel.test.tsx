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
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { scenarios as scenariosEn } from "src/locales/en/scenarios";
import { ToastProvider } from "src/components/ui";
import type { ScenarioRunBroadcast } from "src/pages/DeviceControl/hooks/realtime/useScenarioRunChannel";
import type { Scenario } from "src/services/backend/scenariosService";
import type {
  ScenarioRun,
  ScenarioRunStatus,
} from "src/services/backend/scenarioRunsService";

// -----------------------------------------------------------------------------
// Mocks — must be defined BEFORE importing the component.
// -----------------------------------------------------------------------------

vi.mock("src/services/backend/scenariosService", async () => {
  const actual = await vi.importActual<
    typeof import("src/services/backend/scenariosService")
  >("src/services/backend/scenariosService");
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
    },
  };
});

vi.mock("src/services/backend/scenarioRunsService", async () => {
  const actual = await vi.importActual<
    typeof import("src/services/backend/scenarioRunsService")
  >("src/services/backend/scenarioRunsService");
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

// Capture the onBroadcast handler so tests can fire synthetic broadcasts.
let capturedOnBroadcast: ((msg: ScenarioRunBroadcast) => void) | null = null;
const mockDispatch = vi.fn();

vi.mock("src/pages/DeviceControl/hooks/realtime/useScenarioRunChannel", () => ({
  useScenarioRunChannel: ({
    onBroadcast,
  }: {
    socket: WebSocket | null;
    onBroadcast: (msg: ScenarioRunBroadcast) => void;
  }) => {
    capturedOnBroadcast = onBroadcast;
    return { dispatch: mockDispatch };
  },
}));

// Gate always open in panel-level tests — gate behaviour is unit-tested in useGate.test.ts.
vi.mock("src/hooks/useGate", () => ({
  useGate: () => ({ allowed: true, reason: null }),
}));

import { scenariosService } from "src/services/backend/scenariosService";
import { scenarioRunsService } from "src/services/backend/scenarioRunsService";
import ScenariosPanel from "../ScenariosPanel";

const mockedScenariosIndex = vi.mocked(scenariosService.index);
const mockedScenariosShow = vi.mocked(scenariosService.show);
const mockedPolicyPreview = vi.mocked(scenariosService.policyPreview);
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
    command_steps: [
      { id: "cs-0", binary: "ls", args: ["-la"], cwd: "/" },
      { id: "cs-1", binary: "echo", args: ["hi"], cwd: "/" },
    ],
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

function makeRun(
  id: string,
  status: ScenarioRunStatus = "completed",
): ScenarioRun {
  return {
    id,
    user_id: "user-1",
    device_id: "dev-1",
    scenario_id: "scen-1",
    scenario_name_snapshot: `Run ${id}`,
    step_count: 2,
    started_at: "2026-05-19T00:00:00Z",
    ended_at: "2026-05-19T00:00:30Z",
    status,
    failed_step_index: null,
    total_ai_gen_tokens: null,
    created_at: "2026-05-19T00:00:00Z",
    updated_at: "2026-05-19T00:00:30Z",
  };
}

function makePolicyPreview(scenarioId: string = "scen-1") {
  return {
    steps: [
      {
        step_index: 0,
        id: "cs-0",
        decision: "allow" as const,
        reason: "ok",
        resolved_binary: "/bin/ls",
      },
      {
        step_index: 1,
        id: "cs-1",
        decision: "allow" as const,
        reason: "ok",
        resolved_binary: "/bin/echo",
      },
    ],
    current_policy_version: "v1",
    policy_drift: false,
    scenario_id: scenarioId,
  };
}

function renderPanel(deviceId: string = "dev-1") {
  // Provide a fake ws shape that satisfies the prop type (we mock the hook so
  // the panel never touches the socket directly).
  const fakeWs = { readyState: 1 } as unknown as WebSocket;
  return render(
    <ToastProvider>
      <ScenariosPanel deviceId={deviceId} ws={fakeWs} deviceName="dev-1" />
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

// Node 25's experimental --localstorage-file flag can intercept the global
// localStorage symbol before jsdom defines it. Install a minimal in-memory
// stub if the runtime's localStorage is non-functional so getUserId() can
// safely return null.
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
  mockedScenariosIndex.mockResolvedValue([makeScenario()]);
  mockedScenariosShow.mockResolvedValue(makeScenario());
  mockedPolicyPreview.mockResolvedValue(makePolicyPreview());
  mockedRunsIndex.mockResolvedValue({
    runs: [makeRun("r1"), makeRun("r2")],
    total: 2,
  });
  mockDispatch.mockReset();
  capturedOnBroadcast = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("ScenariosPanel — segmented control & sessionStorage", () => {
  it("renders SegmentedControl in library mode", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-panel-segment")).toBeDefined();
    });
  });

  it("renders SegmentedControl in history mode", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-panel-segment")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("scenarios-panel-segment-history"));
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-history")).toBeDefined();
    });
    // Segmented control still visible in history mode
    expect(screen.getByTestId("scenarios-panel-segment")).toBeDefined();
  });

  it("hides SegmentedControl in editor mode", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-panel-segment")).toBeDefined();
    });
    // Click + New scenario to enter editor mode
    fireEvent.click(screen.getByTestId("scenarios-new-button"));
    await waitFor(() => {
      expect(screen.queryByTestId("scenarios-panel-segment")).toBeNull();
    });
  });

  it("persists segment to sessionStorage on change", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-panel-segment")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("scenarios-panel-segment-history"));
    await waitFor(() => {
      expect(sessionStorage.getItem("scenarios_panel_segment")).toBe("history");
    });
  });

  it("rehydrates segment from sessionStorage on mount", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "history");
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-history")).toBeDefined();
    });
  });
});

describe("ScenariosPanel — launch flow (library → modal → run)", () => {
  it("opens PolicyPreviewModal when [▶ Run] is clicked", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-list")).toBeDefined();
    });
    // Click the row's run button
    const runBtn = screen.getByTestId("scenarios-row-run");
    fireEvent.click(runBtn);
    // Modal should open (in loading state initially)
    await waitFor(() => {
      expect(screen.getByTestId("policy-preview-backdrop")).toBeDefined();
    });
  });

  it("fetches policyPreview after [▶ Run] click using the row scenario", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-list")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("scenarios-row-run"));
    await waitFor(() => {
      expect(mockedPolicyPreview).toHaveBeenCalledWith("scen-1", "dev-1");
    });
    expect(mockedScenariosShow).not.toHaveBeenCalled();
  });

  it("renders the per-step rows from the policyPreview response", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-list")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("scenarios-row-run"));
    await waitFor(() => {
      expect(screen.getByTestId("policy-preview-step-0")).toBeDefined();
    });
    expect(screen.getByTestId("policy-preview-step-1")).toBeDefined();
  });

  it("dispatches start_run via the channel hook on modal [Run all]", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-list")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("scenarios-row-run"));
    await waitFor(() => {
      expect(screen.getByTestId("policy-preview-run-all")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("policy-preview-run-all"));
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        "start_run",
        expect.objectContaining({ scenario_id: "scen-1" }),
      );
    });
  });

  it("transitions to Run-mode after [Run all] and closes the modal", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-list")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("scenarios-row-run"));
    await waitFor(() => {
      expect(screen.getByTestId("policy-preview-run-all")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("policy-preview-run-all"));
    await waitFor(() => {
      expect(screen.queryByTestId("policy-preview-backdrop")).toBeNull();
    });
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-run-mode")).toBeDefined();
    });
  });

  it("closes the modal on [Dismiss] without transitioning mode", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-list")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("scenarios-row-run"));
    await waitFor(() => {
      expect(screen.getByTestId("policy-preview-dismiss")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("policy-preview-dismiss"));
    await waitFor(() => {
      expect(screen.queryByTestId("policy-preview-backdrop")).toBeNull();
    });
    // Mode still library — list is visible
    expect(screen.getByTestId("scenarios-list")).toBeDefined();
  });
});

describe("ScenariosPanel — single-in-flight Toast (D-22-11)", () => {
  it("surfaces run_in_progress as a Toast and stays in modal", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-list")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("scenarios-row-run"));
    await waitFor(() => {
      expect(screen.getByTestId("policy-preview-run-all")).toBeDefined();
    });
    // Simulate the backend transmitting a single-in-flight rejection.
    expect(capturedOnBroadcast).not.toBeNull();
    capturedOnBroadcast!({
      type: "error",
      message: "run_in_progress",
    });
    // Toast surfaces with the inProgressToast copy.
    await waitFor(() => {
      // The Toast portal renders the message text; the EN locale string
      // includes the deviceName: "A run is already in progress on dev-1."
      expect(screen.getByText(/already in progress/i)).toBeDefined();
    });
  });
});

describe("ScenariosPanel — history list & detail navigation", () => {
  it("transitions to history_detail when a History row is clicked", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "history");
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("history-row-r1")).toBeDefined();
    });
    // Mock show for the detail fetch
    vi.mocked(scenarioRunsService.show).mockResolvedValue({
      ...makeRun("r1"),
      steps: [],
    });
    fireEvent.click(screen.getByTestId("history-row-r1"));
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-history-detail")).toBeDefined();
    });
  });

  it("returns to history when HistoryDetail [← History] is called", async () => {
    sessionStorage.setItem("scenarios_panel_segment", "history");
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId("history-row-r1")).toBeDefined();
    });
    vi.mocked(scenarioRunsService.show).mockResolvedValue({
      ...makeRun("r1"),
      steps: [],
    });
    fireEvent.click(screen.getByTestId("history-row-r1"));
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-back")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("history-detail-back"));
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-history")).toBeDefined();
    });
    expect(screen.queryByTestId("scenarios-history-detail")).toBeNull();
  });
});
