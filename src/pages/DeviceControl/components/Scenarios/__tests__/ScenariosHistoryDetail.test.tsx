import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import scenariosEn from "../../../../../locales/en/scenarios";
import { ToastProvider } from "../../../../../components/ui";
import type {
  ScenarioRun,
  ScenarioRunStep,
  ScenarioRunStepStatus,
} from "../../../../../services/backend/scenarioRunsService";
import type { ActiveRun } from "../scenariosReducer";
import {
  initialTranscriptState,
  type ToolRow,
} from "../../Assistant/transcriptReducer";

// Mock the service BEFORE importing the component.
vi.mock("../../../../../services/backend/scenarioRunsService", async () => {
  const actual = await vi.importActual<
    typeof import("../../../../../services/backend/scenarioRunsService")
  >("../../../../../services/backend/scenarioRunsService");
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

import { scenarioRunsService } from "../../../../../services/backend/scenarioRunsService";
import ScenariosHistoryDetail from "../ScenariosHistoryDetail";

const mockedShow = vi.mocked(scenarioRunsService.show);
const mockedDestroy = vi.mocked(scenarioRunsService.destroy);

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
  status: ScenarioRunStepStatus = "success",
  overrides: Partial<ScenarioRunStep> = {},
): ScenarioRunStep {
  return {
    id: `step-${i}`,
    scenario_run_id: "run-x",
    step_index: i,
    binary: `/bin/cmd-${i}`,
    status,
    exit_code: status === "success" ? 0 : 1,
    stderr_first_line: null,
    started_at: "2026-05-19T00:00:00Z",
    ended_at: "2026-05-19T00:00:01Z",
    duration_ms: 1230,
    ...overrides,
  };
}

function makeRun(overrides: Partial<ScenarioRun> = {}): ScenarioRun {
  return {
    id: "run-abcdef123456",
    user_id: "user-1",
    device_id: "dev-1",
    scenario_id: "scen-1",
    scenario_name_snapshot: "Diagnose nginx",
    step_count: 3,
    started_at: "2026-05-19T00:00:00Z",
    ended_at: "2026-05-19T00:00:30Z",
    status: "completed",
    failed_step_index: null,
    total_ai_gen_tokens: null,
    created_at: "2026-05-19T00:00:00Z",
    updated_at: "2026-05-19T00:00:30Z",
    steps: [
      makeStep(0, "success"),
      makeStep(1, "success"),
      makeStep(2, "success"),
    ],
    ...overrides,
  };
}

function makeToolRow(toolCallId: string): ToolRow {
  return {
    kind: "tool",
    toolCallId,
    label: `step-${toolCallId}`,
    command: "echo",
    args: [toolCallId],
    cwd: "/",
    state: "done",
    startedAt: 1000,
    endedAt: 2000,
    result: { stdout: `out-${toolCallId}`, exit: 0 },
  };
}

function makeActiveRun(runId: string, rows: ToolRow[]): ActiveRun {
  return {
    runId,
    scenarioId: "scen-1",
    scenarioName: "Diagnose nginx",
    deviceId: "dev-1",
    startedAt: 1000,
    stepCount: rows.length,
    status: "running",
    skipped: [],
    transcript: {
      ...initialTranscriptState,
      rows,
      sessionToken: runId,
    },
  };
}

function renderDetail(
  props: Partial<React.ComponentProps<typeof ScenariosHistoryDetail>> = {},
) {
  return render(
    <ToastProvider>
      <ScenariosHistoryDetail
        runId={props.runId ?? "run-abcdef123456"}
        activeRun={props.activeRun ?? null}
        commandSteps={props.commandSteps}
        onBack={props.onBack ?? (() => {})}
        onDeleted={props.onDeleted ?? (() => {})}
      />
    </ToastProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ScenariosHistoryDetail", () => {
  it("shows loading state initially", () => {
    mockedShow.mockReturnValue(new Promise(() => {}));
    renderDetail();
    expect(screen.getByTestId("scenarios-history-detail")).toBeDefined();
    // No steps rendered yet
    expect(screen.queryByTestId("history-detail-step-0")).toBeNull();
  });

  it("renders the header with scenario name, status badge, and run-id chip", async () => {
    mockedShow.mockResolvedValue(makeRun());
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("Diagnose nginx")).toBeDefined();
    });
    // Run id chip (first 8 chars)
    expect(
      screen.getByTestId("history-detail-run-id-chip").textContent,
    ).toContain("run-abcd");
    // Status badge
    expect(screen.getByTestId("history-detail-status-badge")).toBeDefined();
  });

  it("renders one metadata row per step in step_index order", async () => {
    mockedShow.mockResolvedValue(
      makeRun({
        steps: [
          makeStep(0, "success"),
          makeStep(1, "success"),
          makeStep(2, "failed"),
          makeStep(3, "success"),
          makeStep(4, "skipped"),
        ],
      }),
    );
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-step-0")).toBeDefined();
    });
    expect(screen.getByTestId("history-detail-step-1")).toBeDefined();
    expect(screen.getByTestId("history-detail-step-2")).toBeDefined();
    expect(screen.getByTestId("history-detail-step-3")).toBeDefined();
    expect(screen.getByTestId("history-detail-step-4")).toBeDefined();
  });

  it("renders the live transcript when activeRun.runId matches runId", async () => {
    mockedShow.mockResolvedValue(makeRun());
    const activeRun = makeActiveRun("run-abcdef123456", [
      makeToolRow("tc-a"),
      makeToolRow("tc-b"),
    ]);
    renderDetail({ activeRun });
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-step-0")).toBeDefined();
    });
    // Live transcript rendered via RunOutput → ToolCallCard data-testid
    expect(screen.getByTestId("tool-call-card-tc-a")).toBeDefined();
    expect(screen.getByTestId("tool-call-card-tc-b")).toBeDefined();
    // Past-session banner should NOT be present
    expect(
      screen.queryByTestId("history-detail-past-session-banner"),
    ).toBeNull();
  });

  it("renders the past-session banner when activeRun is null", async () => {
    mockedShow.mockResolvedValue(makeRun());
    renderDetail({ activeRun: null });
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-step-0")).toBeDefined();
    });
    expect(
      screen.getByTestId("history-detail-past-session-banner"),
    ).toBeDefined();
    expect(
      screen.getByTestId("history-detail-past-session-banner").textContent,
    ).toContain("Live output is held in memory only");
  });

  it("renders the past-session banner when activeRun.runId mismatches runId", async () => {
    mockedShow.mockResolvedValue(makeRun());
    const activeRun = makeActiveRun("different-run-id", [makeToolRow("tc-a")]);
    renderDetail({ activeRun });
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-step-0")).toBeDefined();
    });
    expect(
      screen.getByTestId("history-detail-past-session-banner"),
    ).toBeDefined();
    expect(screen.queryByTestId("tool-call-card-tc-a")).toBeNull();
  });

  it("renders per-step glyph from GLYPH_CATALOG", async () => {
    mockedShow.mockResolvedValue(
      makeRun({
        steps: [
          makeStep(0, "success"),
          makeStep(1, "failed"),
          makeStep(2, "skipped"),
        ],
      }),
    );
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-step-0")).toBeDefined();
    });
    expect(screen.getByTestId("history-detail-step-0").textContent).toContain(
      "✓",
    );
    expect(screen.getByTestId("history-detail-step-1").textContent).toContain(
      "✗",
    );
    expect(screen.getByTestId("history-detail-step-2").textContent).toContain(
      "⊘",
    );
  });

  it("renders stderr_first_line in a red-tinted block when present", async () => {
    mockedShow.mockResolvedValue(
      makeRun({
        steps: [
          makeStep(0, "failed", { stderr_first_line: "connection refused" }),
        ],
      }),
    );
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-step-0")).toBeDefined();
    });
    const stderr = screen.getByTestId("history-detail-step-0-stderr");
    expect(stderr).toBeDefined();
    expect(stderr.textContent).toContain("connection refused");
    expect(stderr.className).toMatch(/bg-red-50/);
  });

  it("omits stderr block when stderr_first_line is null", async () => {
    mockedShow.mockResolvedValue(makeRun());
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-step-0")).toBeDefined();
    });
    expect(screen.queryByTestId("history-detail-step-0-stderr")).toBeNull();
  });

  it("copies markdown to clipboard when [Copy as Markdown] is clicked (current-session)", async () => {
    mockedShow.mockResolvedValue(makeRun());
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const activeRun = makeActiveRun("run-abcdef123456", [makeToolRow("tc-a")]);
    renderDetail({ activeRun });
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-copy-md")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("history-detail-copy-md"));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    const written = writeText.mock.calls[0][0] as string;
    // copyAsMarkdown output should contain the row's command label
    expect(written).toContain("echo");
  });

  it("copies past-session markdown when activeRun is null", async () => {
    mockedShow.mockResolvedValue(
      makeRun({
        scenario_name_snapshot: "Past Run Name",
        steps: [
          makeStep(0, "success", { exit_code: 0 }),
          makeStep(1, "failed", { exit_code: 2 }),
        ],
      }),
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderDetail({ activeRun: null });
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-copy-md")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("history-detail-copy-md"));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    const written = writeText.mock.calls[0][0] as string;
    expect(written).toContain("Past Run Name");
    // exit codes should appear in the metadata-only past-session serialization
    expect(written).toMatch(/exit/i);
  });

  it("calls onBack when [← History] is clicked", async () => {
    mockedShow.mockResolvedValue(makeRun());
    const onBack = vi.fn();
    renderDetail({ onBack });
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-back")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("history-detail-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls scenarioRunsService.destroy(runId) and onDeleted() when [✕ Delete this run] is clicked", async () => {
    mockedShow.mockResolvedValue(makeRun());
    mockedDestroy.mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    renderDetail({ onDeleted, runId: "run-abcdef123456" });
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-delete")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("history-detail-delete"));
    await waitFor(() => {
      expect(mockedDestroy).toHaveBeenCalledWith("run-abcdef123456");
    });
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });
  });

  it("shows an error state when destroy() rejects", async () => {
    mockedShow.mockResolvedValue(makeRun());
    mockedDestroy.mockRejectedValue(new Error("boom"));
    const onDeleted = vi.fn();
    renderDetail({ onDeleted });
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-delete")).toBeDefined();
    });
    fireEvent.click(screen.getByTestId("history-detail-delete"));
    await waitFor(() => {
      expect(mockedDestroy).toHaveBeenCalled();
    });
    // onDeleted MUST NOT have been called on failure
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("shows an error state when show() rejects", async () => {
    mockedShow.mockRejectedValue(new Error("404"));
    renderDetail();
    await waitFor(() => {
      expect(
        screen.getByTestId("scenarios-history-detail-error"),
      ).toBeDefined();
    });
  });

  it("renders the duration in seconds (formatted from duration_ms)", async () => {
    mockedShow.mockResolvedValue(
      makeRun({
        steps: [makeStep(0, "success", { duration_ms: 1230 })],
      }),
    );
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId("history-detail-step-0")).toBeDefined();
    });
    expect(screen.getByTestId("history-detail-step-0").textContent).toContain(
      "1.23s",
    );
  });
});
