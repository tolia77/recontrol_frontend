import { useCallback, useEffect, useMemo } from "react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button, useToast } from "src/components/ui";
import RunOutput from "./RunOutput";
import { copyAsMarkdown } from "src/pages/DeviceControl/components/Assistant/copyAsMarkdown";
import type { ActiveRun, ActiveRunStatus } from "./scenariosReducer";
import type { ToolRow } from "src/pages/DeviceControl/components/Assistant/transcriptReducer";

/**
 * ScenariosRunMode — full-takeover panel that owns the device-control right
 * pane while a scenario run is alive (D-22-01 / 03 / 10). Renders the streaming
 * per-step output via the verbatim-reused ToolCallCard (UI-03 — wrapped by
 * RunOutput from this directory). On terminal status, swaps the Stop button
 * for back-button + Copy-as-Markdown (UI-06 — copyAsMarkdown reused verbatim).
 *
 * Pure-presentational + side-effects-bound: the parent (ScenariosPanel in Plan
 * 22.10) owns the scenariosReducer state and the hook's dispatch. This
 * component receives the ActiveRun snapshot and callbacks, owns only the
 * beforeunload listener (Pitfall 14) and the navigator.clipboard call.
 *
 * Pitfalls (22-RESEARCH):
 *   - beforeunload listener registered ONLY while status === 'running' to
 *     avoid spurious prompts after run finishes (T-22-32).
 *   - Step counter is derived per render — no state to keep in sync.
 *   - Stop button stays mounted during 'stopping' with loading + disabled so
 *     repeated clicks are no-ops (T-22-33).
 */

// Terminal statuses (mirror of TERMINAL_STATUSES in scenariosReducer.ts; we
// don't export from the reducer to avoid coupling — this is the smallest
// duplication needed and stays in lockstep with the reducer's set).
const TERMINAL_STATUSES: ReadonlyArray<ActiveRunStatus> = [
  "completed",
  "failed",
  "user_stopped",
  "policy_deny",
  "access_revoked",
  "tab_closed",
  "abandoned",
  "error",
];

function isTerminal(status: ActiveRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface ScenariosRunModeCommandStep {
  id: string;
  binary: string;
  args: string[];
  cwd: string;
  description?: string;
}

export interface ScenariosRunModeProps {
  activeRun: ActiveRun;
  deviceName: string;
  backTo: "library" | "history";
  onStop: () => void;
  onBack: () => void;
  /**
   * The scenario's command_steps, in declaration order. Used to map the
   * `activeRun.skipped[].stepIndex` (numeric) to the tool row's `toolCallId`
   * (which is the step UUID — runner uses step UUIDs as tool_call_ids per
   * Plan 22.03). The parent ScenariosPanel has the scenario loaded so this is
   * cheap to plumb through.
   */
  commandSteps: ReadonlyArray<ScenariosRunModeCommandStep>;
}

function ScenariosRunMode({
  activeRun,
  deviceName,
  backTo,
  onStop,
  onBack,
  commandSteps,
}: ScenariosRunModeProps): JSX.Element {
  const { t } = useTranslation("scenarios");
  const toast = useToast();

  const terminal = isTerminal(activeRun.status);
  const isRunning = activeRun.status === "running";
  const isStopping = activeRun.status === "stopping";

  // beforeunload guard: only while running. Registers fresh on transition to
  // running (T-22-32 — never while terminal).
  useEffect(() => {
    if (activeRun.status !== "running") return;
    const message = t("run.beforeUnloadMessage");
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [activeRun.status, t]);

  // Tool rows (filter the transcript down to ToolRow kind).
  const toolRows: ToolRow[] = useMemo(
    () =>
      activeRun.transcript.rows.filter((r): r is ToolRow => r.kind === "tool"),
    [activeRun.transcript.rows],
  );

  // Map from step UUID → skipped reason, via the commandSteps index lookup.
  const skippedByToolCallId: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of activeRun.skipped) {
      const step = commandSteps[s.stepIndex];
      if (step) map[step.id] = s.reason;
    }
    return map;
  }, [activeRun.skipped, commandSteps]);

  // Step counter: (# of done tool rows) + (1 if running), capped at stepCount.
  const currentStep = useMemo(() => {
    const doneCount = toolRows.filter((r) => r.state === "done").length;
    const inflight = isRunning ? 1 : 0;
    return Math.min(doneCount + inflight, activeRun.stepCount);
  }, [toolRows, isRunning, activeRun.stepCount]);

  const handleCopyMarkdown = useCallback(async () => {
    const md = copyAsMarkdown(activeRun.transcript.rows);
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("clipboard_unavailable");
      }
      await navigator.clipboard.writeText(md);
      toast.success(t("run.copyMarkdownSuccess"));
    } catch {
      toast.error(t("run.copyMarkdownError"));
    }
  }, [activeRun.transcript.rows, toast, t]);

  const backLabel =
    backTo === "library" ? t("editor.backToLibrary") : t("run.backToHistory");

  return (
    <div
      data-testid="scenarios-run-mode"
      className="bg-background flex h-full flex-col"
    >
      {/* Header */}
      <header className="border-lightgray flex items-center justify-between border-b px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="text-primary max-w-[180px] truncate text-sm font-medium"
            data-testid="scenarios-run-scenario-name"
            title={activeRun.scenarioName}
          >
            {activeRun.scenarioName}
          </span>
          <span
            className="ml-2 rounded bg-gray-100 px-2 py-1 text-xs"
            data-testid="scenarios-run-device-chip"
          >
            {deviceName}
          </span>
          <span
            className="text-darkgray ml-2 text-xs"
            data-testid="scenarios-run-step-counter"
          >
            {t("run.stepCounter", {
              current: currentStep,
              total: activeRun.stepCount,
              count: activeRun.stepCount,
            })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!terminal && (
            <Button
              variant="danger"
              size="sm"
              loading={isStopping}
              disabled={isStopping}
              onClick={onStop}
              data-testid="scenarios-run-stop"
            >
              {isStopping ? t("run.stopping") : t("run.stop")}
            </Button>
          )}
          {terminal && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                data-testid="scenarios-run-back"
              >
                {backLabel}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyMarkdown}
                data-testid="scenarios-run-copy-md"
              >
                {t("run.copyMarkdown")}
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div
        className="flex-1 space-y-2 overflow-y-auto px-4 py-3"
        data-testid="scenarios-run-body"
      >
        {toolRows.map((row) => (
          <RunOutput
            key={row.toolCallId}
            row={row}
            skippedReason={skippedByToolCallId[row.toolCallId]}
          />
        ))}
      </div>
    </div>
  );
}

export default ScenariosRunMode;
