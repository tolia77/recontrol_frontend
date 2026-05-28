import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { scenarios as scenariosEn } from "src/locales/en/scenarios";
import { ToastProvider } from "src/components/ui";
import type {
  ScenarioRun,
  ScenarioRunStatus,
  ScenarioRunStep,
  ScenarioRunStepStatus,
} from "src/services/backend/scenarioRunsService";

// Mock the service BEFORE importing the component.
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

import { scenarioRunsService } from "src/services/backend/scenarioRunsService";
import ScenariosHistory from "../ScenariosHistory";

const mockedIndex = vi.mocked(scenarioRunsService.index);
const mockedDestroyAll = vi.mocked(scenarioRunsService.destroyAll);

function page(runs: ScenarioRun[], total: number = runs.length) {
  return { runs, total };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStep(
  i: number,
  status: ScenarioRunStepStatus,
  overrides: Partial<ScenarioRunStep> = {},
): ScenarioRunStep {
  return {
    id: `step-${i}-${Math.random().toString(36).slice(2, 8)}`,
    scenario_run_id: "run-x",
    step_index: i,
    binary: "/bin/echo",
    status,
    exit_code: status === "success" ? 0 : 1,
    stderr_first_line: null,
    started_at: "2026-05-19T00:00:00Z",
    ended_at: "2026-05-19T00:00:01Z",
    duration_ms: 1000,
    ...overrides,
  };
}

function makeRun(
  id: string,
  status: ScenarioRunStatus = "completed",
  overrides: Partial<ScenarioRun> = {},
): ScenarioRun {
  return {
    id,
    user_id: "user-1",
    device_id: "dev-1",
    scenario_id: "scen-1",
    scenario_name_snapshot: `Run ${id}`,
    step_count: 3,
    started_at: "2026-05-19T00:00:00Z",
    ended_at: "2026-05-19T00:00:30Z",
    status,
    failed_step_index: null,
    total_ai_gen_tokens: null,
    created_at: "2026-05-19T00:00:00Z",
    updated_at: "2026-05-19T00:00:30Z",
    ...overrides,
  };
}

function renderHistory(
  props: Partial<React.ComponentProps<typeof ScenariosHistory>> = {},
) {
  return render(
    <ToastProvider>
      <ScenariosHistory onSelectRun={props.onSelectRun ?? (() => {})} />
    </ToastProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ScenariosHistory", () => {
  it("shows loading state initially", () => {
    mockedIndex.mockReturnValue(new Promise(() => {})); // never resolves
    renderHistory();
    expect(screen.getByTestId("scenarios-history-loading")).toBeDefined();
  });

  it("renders a row per ScenarioRun returned by index()", async () => {
    mockedIndex.mockResolvedValue(
      page([
        makeRun("r1", "completed"),
        makeRun("r2", "failed"),
        makeRun("r3", "user_stopped"),
      ]),
    );
    renderHistory();
    await waitFor(() => {
      expect(screen.getByTestId("history-row-r1")).toBeDefined();
      expect(screen.getByTestId("history-row-r2")).toBeDefined();
      expect(screen.getByTestId("history-row-r3")).toBeDefined();
    });
  });

  it("shows the empty state when no runs", async () => {
    mockedIndex.mockResolvedValue(page([]));
    renderHistory();
    await waitFor(() => {
      expect(screen.getByTestId("scenarios-history-empty")).toBeDefined();
    });
    expect(screen.getByTestId("scenarios-history-empty").textContent).toContain(
      "No runs yet.",
    );
  });

  it("renders the status badge with the correct color class per run status", async () => {
    mockedIndex.mockResolvedValue(
      page([
        makeRun("r1", "completed"),
        makeRun("r2", "failed"),
        makeRun("r3", "user_stopped"),
      ]),
    );
    renderHistory();
    await waitFor(() => screen.getByTestId("history-row-r1"));
    const row1 = within(screen.getByTestId("history-row-r1")).getByTestId(
      "history-row-badge",
    );
    const row2 = within(screen.getByTestId("history-row-r2")).getByTestId(
      "history-row-badge",
    );
    const row3 = within(screen.getByTestId("history-row-r3")).getByTestId(
      "history-row-badge",
    );
    expect(row1.className).toContain("green");
    expect(row2.className).toContain("red");
    expect(row3.className).toContain("amber");
  });

  it("renders the exit-code glyph row from buildExitCodeTimeline when steps are provided", async () => {
    mockedIndex.mockResolvedValue(
      page([
        makeRun("r1", "failed", {
          steps: [
            makeStep(0, "success"),
            makeStep(1, "success"),
            makeStep(2, "failed"),
          ],
        }),
      ]),
    );
    renderHistory();
    await waitFor(() => screen.getByTestId("history-row-r1"));
    const glyphRow = within(screen.getByTestId("history-row-r1")).getByTestId(
      "history-row-glyphs",
    );
    expect(glyphRow.textContent).toContain("✓");
    expect(glyphRow.textContent).toContain("✗");
  });

  it("calls onSelectRun(runId) when a row is clicked", async () => {
    mockedIndex.mockResolvedValue(page([makeRun("rABC", "completed")]));
    const onSelectRun = vi.fn();
    renderHistory({ onSelectRun });
    await waitFor(() => screen.getByTestId("history-row-rABC"));
    fireEvent.click(screen.getByTestId("history-row-rABC"));
    expect(onSelectRun).toHaveBeenCalledTimes(1);
    expect(onSelectRun).toHaveBeenCalledWith("rABC");
  });

  it("paginates forward when [Next →] is clicked", async () => {
    const page1 = Array.from({ length: 25 }, (_, i) =>
      makeRun(`p1-r${i}`, "completed"),
    );
    const page2 = [makeRun("p2-r0", "completed")];
    mockedIndex
      .mockResolvedValueOnce(page(page1, 26))
      .mockResolvedValueOnce(page(page2, 26));
    renderHistory();
    await waitFor(() => screen.getByTestId("history-row-p1-r0"));
    fireEvent.click(screen.getByTestId("history-next"));
    await waitFor(() => screen.getByTestId("history-row-p2-r0"));
    expect(mockedIndex).toHaveBeenCalledTimes(2);
    expect(mockedIndex).toHaveBeenNthCalledWith(2, { page: 2, per_page: 25 });
  });

  it("disables [← Prev] on page 1", async () => {
    mockedIndex.mockResolvedValue(page([makeRun("r1")]));
    renderHistory();
    await waitFor(() => screen.getByTestId("history-row-r1"));
    const prev = screen.getByTestId("history-prev") as HTMLButtonElement;
    expect(prev.disabled).toBe(true);
  });

  it("disables [Next →] when the current page is the last page", async () => {
    mockedIndex.mockResolvedValue(page([makeRun("r1"), makeRun("r2")]));
    renderHistory();
    await waitFor(() => screen.getByTestId("history-row-r1"));
    const next = screen.getByTestId("history-next") as HTMLButtonElement;
    expect(next.disabled).toBe(true);
  });

  it("hides [✕ Delete all history] when there are no runs", async () => {
    mockedIndex.mockResolvedValue(page([]));
    renderHistory();
    await waitFor(() => screen.getByTestId("scenarios-history-empty"));
    expect(screen.queryByTestId("history-delete-all")).toBeNull();
  });

  it("opens the mass-delete confirm modal when [✕ Delete all history] is clicked", async () => {
    mockedIndex.mockResolvedValue(page([makeRun("r1")]));
    renderHistory();
    await waitFor(() => screen.getByTestId("history-row-r1"));
    fireEvent.click(screen.getByTestId("history-delete-all"));
    expect(screen.getByTestId("mass-delete-modal")).toBeDefined();
  });

  it("calls scenarioRunsService.destroyAll() on confirm and refreshes the list", async () => {
    mockedIndex
      .mockResolvedValueOnce(page([makeRun("r1"), makeRun("r2")]))
      .mockResolvedValueOnce(page([]));
    mockedDestroyAll.mockResolvedValue();
    renderHistory();
    await waitFor(() => screen.getByTestId("history-row-r1"));
    fireEvent.click(screen.getByTestId("history-delete-all"));
    // Type the required phrase
    const input = screen.getByTestId("mass-delete-input");
    fireEvent.change(input, { target: { value: "DELETE" } });
    fireEvent.click(screen.getByTestId("mass-delete-confirm"));
    await waitFor(() => {
      expect(mockedDestroyAll).toHaveBeenCalledTimes(1);
    });
    // Refresh re-invokes index()
    await waitFor(() => {
      expect(mockedIndex).toHaveBeenCalledTimes(2);
    });
    // Modal should close after success
    await waitFor(() => {
      expect(screen.queryByTestId("mass-delete-modal")).toBeNull();
    });
  });

  it("shows an error Toast when destroyAll() rejects", async () => {
    mockedIndex.mockResolvedValue(page([makeRun("r1")]));
    mockedDestroyAll.mockRejectedValue(new Error("boom"));
    renderHistory();
    await waitFor(() => screen.getByTestId("history-row-r1"));
    fireEvent.click(screen.getByTestId("history-delete-all"));
    fireEvent.change(screen.getByTestId("mass-delete-input"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(screen.getByTestId("mass-delete-confirm"));
    await waitFor(() => {
      expect(mockedDestroyAll).toHaveBeenCalledTimes(1);
    });
    // Toast (role="alert") surfaces
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  it("closes the modal on Cancel without calling destroyAll", async () => {
    mockedIndex.mockResolvedValue(page([makeRun("r1")]));
    renderHistory();
    await waitFor(() => screen.getByTestId("history-row-r1"));
    fireEvent.click(screen.getByTestId("history-delete-all"));
    fireEvent.click(screen.getByTestId("mass-delete-cancel"));
    await waitFor(() => {
      expect(screen.queryByTestId("mass-delete-modal")).toBeNull();
    });
    expect(mockedDestroyAll).not.toHaveBeenCalled();
  });

  it('renders the "Showing X-Y of N" indicator', async () => {
    mockedIndex.mockResolvedValue(
      page([makeRun("r1"), makeRun("r2"), makeRun("r3")]),
    );
    renderHistory();
    await waitFor(() => screen.getByTestId("history-row-r1"));
    const indicator = screen.getByTestId("history-showing");
    expect(indicator.textContent).toMatch(/1.+3/);
  });
});
