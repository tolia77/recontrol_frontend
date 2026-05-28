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

import { scenarios as scenariosEn } from "../../../../../locales/en/scenarios";
import { ScenariosRunMode } from "../ScenariosRunMode";
import type { ActiveRun, ActiveRunStatus } from "../scenariosReducer";
import {
  initialTranscriptState,
  type ToolRow,
  type TranscriptState,
} from "../../Assistant/transcriptReducer";
import { ToastProvider } from "../../../../../components/ui";
import type { ReactElement } from "react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeAll(async () => {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      ns: ["scenarios"],
      defaultNS: "scenarios",
      resources: {
        en: { scenarios: scenariosEn },
      },
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

function makeToolRow(
  toolCallId: string,
  state: ToolRow["state"] = "done",
): ToolRow {
  return {
    kind: "tool",
    toolCallId,
    label: `step-${toolCallId}`,
    command: "echo",
    args: [toolCallId],
    cwd: "/",
    state,
    startedAt: 1000,
    endedAt: state === "done" || state === "error" ? 2000 : undefined,
    result:
      state === "done" ? { stdout: `out-${toolCallId}`, exit: 0 } : undefined,
  };
}

function makeTranscript(rows: ToolRow[]): TranscriptState {
  return {
    ...initialTranscriptState,
    rows,
    sessionToken: "run-1",
  };
}

interface MakeRunOpts {
  status?: ActiveRunStatus;
  rows?: ToolRow[];
  stepCount?: number;
  skipped?: ActiveRun["skipped"];
}

function makeActiveRun(opts: MakeRunOpts = {}): ActiveRun {
  return {
    runId: "run-1",
    scenarioId: "scen-1",
    scenarioName: "Diagnose nginx",
    deviceId: "dev-1",
    startedAt: 1_000,
    stepCount: opts.stepCount ?? 5,
    status: opts.status ?? "running",
    skipped: opts.skipped ?? [],
    transcript: makeTranscript(opts.rows ?? []),
  };
}

const COMMAND_STEPS = [
  { id: "cs-0", binary: "echo", args: ["a"], cwd: "/" },
  { id: "cs-1", binary: "echo", args: ["b"], cwd: "/" },
  { id: "cs-2", binary: "echo", args: ["c"], cwd: "/" },
  { id: "cs-3", binary: "echo", args: ["d"], cwd: "/" },
  { id: "cs-4", binary: "echo", args: ["e"], cwd: "/" },
];

function renderWithToast(el: ReactElement) {
  return render(<ToastProvider>{el}</ToastProvider>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ScenariosRunMode — header buttons", () => {
  it("renders [Stop run] when status=running", () => {
    const onStop = vi.fn();
    const onBack = vi.fn();
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "running" })}
        deviceName="dev-1"
        backTo="library"
        onStop={onStop}
        onBack={onBack}
        commandSteps={COMMAND_STEPS}
      />,
    );
    const stop = screen.getByTestId("scenarios-run-stop");
    expect(stop).toBeTruthy();
    expect(stop.textContent).toContain("Stop run");
  });

  it("shows Stopping… and disables the button when status=stopping", () => {
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "stopping" })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    const stop = screen.getByTestId("scenarios-run-stop") as HTMLButtonElement;
    expect(stop.textContent).toContain("Stopping");
    expect(stop.disabled).toBe(true);
  });

  it("hides [Stop run] when status is terminal (completed)", () => {
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "completed" })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    expect(screen.queryByTestId("scenarios-run-stop")).toBeNull();
  });

  it("renders [← Back to library] when backTo=library and status terminal", () => {
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "completed" })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    const back = screen.getByTestId("scenarios-run-back");
    expect(back.textContent).toContain("Back to library");
  });

  it("renders [← History] when backTo=history and status terminal", () => {
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "completed" })}
        deviceName="dev-1"
        backTo="history"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    const back = screen.getByTestId("scenarios-run-back");
    expect(back.textContent).toContain("History");
  });

  it("renders [Copy as Markdown] only on terminal status", () => {
    const { rerender } = renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "running" })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    expect(screen.queryByTestId("scenarios-run-copy-md")).toBeNull();
    rerender(
      <ToastProvider>
        <ScenariosRunMode
          activeRun={makeActiveRun({ status: "completed" })}
          deviceName="dev-1"
          backTo="library"
          onStop={vi.fn()}
          onBack={vi.fn()}
          commandSteps={COMMAND_STEPS}
        />
      </ToastProvider>,
    );
    expect(screen.getByTestId("scenarios-run-copy-md")).toBeTruthy();
  });
});

describe("ScenariosRunMode — interactions", () => {
  it("calls onStop when [Stop run] is clicked", () => {
    const onStop = vi.fn();
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "running" })}
        deviceName="dev-1"
        backTo="library"
        onStop={onStop}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    fireEvent.click(screen.getByTestId("scenarios-run-stop"));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("calls onBack when the back button is clicked", () => {
    const onBack = vi.fn();
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "completed" })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={onBack}
        commandSteps={COMMAND_STEPS}
      />,
    );
    fireEvent.click(screen.getByTestId("scenarios-run-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("copies markdown to clipboard when [Copy as Markdown] is clicked and surfaces a success toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({
          status: "completed",
          rows: [makeToolRow("tc-1", "done"), makeToolRow("tc-2", "done")],
        })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    fireEvent.click(screen.getByTestId("scenarios-run-copy-md"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toMatch(/echo/);
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Copied transcript to clipboard",
      );
    });
  });

  it("handles clipboard write failure with an error toast", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({
          status: "completed",
          rows: [makeToolRow("tc-1", "done")],
        })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    fireEvent.click(screen.getByTestId("scenarios-run-copy-md"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Could not copy to clipboard",
      );
    });
  });
});

describe("ScenariosRunMode — beforeunload", () => {
  it("registers a beforeunload handler while status=running", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "running" })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    const calls = addSpy.mock.calls.filter((c) => c[0] === "beforeunload");
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT register beforeunload when status is terminal", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "completed" })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    const calls = addSpy.mock.calls.filter((c) => c[0] === "beforeunload");
    expect(calls.length).toBe(0);
  });

  it("unregisters beforeunload on cleanup AND on status transition to terminal", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const props = {
      deviceName: "dev-1",
      backTo: "library" as const,
      onStop: vi.fn(),
      onBack: vi.fn(),
      commandSteps: COMMAND_STEPS,
    };
    const { rerender } = renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "running" })}
        {...props}
      />,
    );
    rerender(
      <ToastProvider>
        <ScenariosRunMode
          activeRun={makeActiveRun({ status: "completed" })}
          {...props}
        />
      </ToastProvider>,
    );
    const calls = removeSpy.mock.calls.filter((c) => c[0] === "beforeunload");
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ScenariosRunMode — body rendering", () => {
  it("renders one RunOutput per tool row in transcript order", () => {
    const rows = [
      makeToolRow("tc-A", "done"),
      makeToolRow("tc-B", "done"),
      makeToolRow("tc-C", "running"),
    ];
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "running", rows })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    expect(screen.getByTestId("tool-call-card-tc-A")).toBeTruthy();
    expect(screen.getByTestId("tool-call-card-tc-B")).toBeTruthy();
    expect(screen.getByTestId("tool-call-card-tc-C")).toBeTruthy();
  });

  it("passes skippedReason to RunOutput for skipped step indices", () => {
    // Make tool rows whose toolCallIds match the commandSteps[1] and commandSteps[2] ids
    const rows = [
      makeToolRow(COMMAND_STEPS[0].id, "done"),
      makeToolRow(COMMAND_STEPS[1].id, "done"),
      makeToolRow(COMMAND_STEPS[2].id, "done"),
    ];
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({
          status: "failed",
          rows,
          skipped: [{ stepIndex: 1, reason: "previous_step_failed" }],
        })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    // Skipped wrapper present for commandSteps[1].id
    expect(
      screen.getByTestId(`run-output-skipped-${COMMAND_STEPS[1].id}`),
    ).toBeTruthy();
    // Non-skipped row should NOT have the skipped wrapper
    expect(
      screen.queryByTestId(`run-output-skipped-${COMMAND_STEPS[0].id}`),
    ).toBeNull();
  });

  it("renders the step counter with current/total values", () => {
    // 2 done rows + 1 in-flight = currentStep should be 3, total 5
    const rows = [
      makeToolRow("tc-1", "done"),
      makeToolRow("tc-2", "done"),
      makeToolRow("tc-3", "running"),
    ];
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "running", rows, stepCount: 5 })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    const counter = screen.getByTestId("scenarios-run-step-counter");
    expect(counter.textContent).toContain("3");
    expect(counter.textContent).toContain("5");
  });

  it("renders root and structural data-testid scenarios-run-mode", () => {
    renderWithToast(
      <ScenariosRunMode
        activeRun={makeActiveRun({ status: "running" })}
        deviceName="dev-1"
        backTo="library"
        onStop={vi.fn()}
        onBack={vi.fn()}
        commandSteps={COMMAND_STEPS}
      />,
    );
    expect(screen.getByTestId("scenarios-run-mode")).toBeTruthy();
  });
});
