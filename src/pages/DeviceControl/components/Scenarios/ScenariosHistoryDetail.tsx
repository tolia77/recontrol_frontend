import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, useToast } from "src/components/ui";
import {
  scenarioRunsService,
  type ScenarioRun,
  type ScenarioRunStatus,
  type ScenarioRunStep,
} from "src/services/backend/scenarioRunsService";
import { GLYPH_CATALOG, STATUS_BADGE_CLASS } from "./exitCodeGlyphs";
import RunOutput from "./RunOutput";
import { copyAsMarkdown } from "src/pages/DeviceControl/components/Assistant/copyAsMarkdown";
import type { ActiveRun } from "./scenariosReducer";
import type { ToolRow } from "src/pages/DeviceControl/components/Assistant/transcriptReducer";

/**
 * ScenariosHistoryDetail — full-takeover history detail per D-22-09 / AUDIT-04.
 *
 * Renders the persisted ScenarioRun (header + per-step metadata rows) plus,
 * for runs whose lifetime overlaps the current panel session, the live
 * ToolCallCard transcript inline above the per-step rows. For past-session
 * runs (or when no activeRun is supplied), a muted banner explains that the
 * live output is no longer available and only the persisted metadata remains.
 *
 * Live-vs-past branch invariant (AUDIT-04):
 *   live transcript renders IFF `activeRun?.runId === runId`. Otherwise the
 *   past-session banner is shown above the always-rendered per-step metadata
 *   rows.
 *
 * Copy-as-Markdown (UI-06):
 *   - Current-session path uses the verbatim copyAsMarkdown(rows) reuse.
 *   - Past-session path uses an inline metadata-only serializer since the DB
 *     never persists stdout (SAFETY-01).
 *
 * Per-row delete (AUDIT-05 single-delete arm, D-22-09): single click executes
 * scenarioRunsService.destroy(runId); on success the parent transitions back
 * to the history list via onDeleted().
 */

const RUN_ID_CHIP_LEN = 8;

export interface HistoryDetailCommandStep {
  id: string;
  binary: string;
  args: string[];
  cwd: string;
  description?: string;
}

export interface ScenariosHistoryDetailProps {
  runId: string;
  // When non-null AND `activeRun.runId === runId`, the live transcript renders
  // inline. Otherwise the past-session banner is shown.
  activeRun: ActiveRun | null;
  // Optional command_steps (from the parent's loaded scenario) — reserved for
  // future enrichment of the per-step rows; the current AUDIT-04 surface only
  // uses the persisted ScenarioRunStep payload.
  commandSteps?: ReadonlyArray<HistoryDetailCommandStep>;
  onBack: () => void;
  onDeleted: () => void;
}

function formatDurationSeconds(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
  return `${(ms / 1000).toFixed(2)}s`;
}

function statusBadgeClass(status: ScenarioRunStatus): string {
  return STATUS_BADGE_CLASS[status] ?? "";
}

// Past-session markdown serializer — metadata only (DB has no stdout per
// SAFETY-01). Produces a human-readable Markdown block with the run header
// and a fenced section per step listing binary, status, exit code, and
// duration.
function serializePastSession(run: ScenarioRun): string {
  const lines: string[] = [];
  lines.push(`# ${run.scenario_name_snapshot} — ${run.status}`);
  if (run.started_at) lines.push(`started_at: ${run.started_at}`);
  if (run.ended_at) lines.push(`ended_at: ${run.ended_at}`);
  lines.push("");
  const steps = run.steps ?? [];
  for (const step of steps) {
    const dur = formatDurationSeconds(step.duration_ms);
    lines.push(
      `## step ${step.step_index + 1} — ${step.binary} (${step.status}, exit ${
        step.exit_code ?? "—"
      }, ${dur})`,
    );
    if (step.stderr_first_line) {
      lines.push("```");
      lines.push(`stderr: ${step.stderr_first_line}`);
      lines.push("```");
    }
    lines.push("");
  }
  return lines.join("\n");
}

function glyphFor(status: ScenarioRunStep["status"]) {
  const entry = GLYPH_CATALOG[status];
  return entry ?? GLYPH_CATALOG.running;
}

export default function ScenariosHistoryDetail({
  runId,
  activeRun,
  onBack,
  onDeleted,
}: ScenariosHistoryDetailProps) {
  const { t } = useTranslation("scenarios");
  const toast = useToast();
  const [run, setRun] = useState<ScenarioRun | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Fetch effect — cancellation-guarded per the P21 ScenariosLibrary pattern.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    scenarioRunsService
      .show(runId)
      .then((data) => {
        if (!cancelled) setRun(data);
      })
      .catch(() => {
        if (!cancelled) setError("error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const isLive = activeRun !== null && activeRun.runId === runId;

  // Live transcript tool rows (filtered to kind === 'tool').
  const liveToolRows: ToolRow[] = useMemo(() => {
    if (!isLive || !activeRun) return [];
    return activeRun.transcript.rows.filter(
      (r): r is ToolRow => r.kind === "tool",
    );
  }, [isLive, activeRun]);

  const handleCopyMarkdown = useCallback(async () => {
    let md: string;
    if (isLive && activeRun) {
      md = copyAsMarkdown(activeRun.transcript.rows);
    } else if (run) {
      md = serializePastSession(run);
    } else {
      return;
    }
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("clipboard_unavailable");
      }
      await navigator.clipboard.writeText(md);
      toast.success(t("run.copyMarkdownSuccess"));
    } catch {
      toast.error(t("run.copyMarkdownError"));
    }
  }, [isLive, activeRun, run, toast, t]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await scenarioRunsService.destroy(runId);
      toast.success(t("history.deleteRun"));
      onDeleted();
    } catch {
      toast.error(t("history.deleteRun"));
    } finally {
      setDeleting(false);
    }
  }, [runId, onDeleted, toast, t]);

  if (error) {
    return (
      <div className="flex flex-col" data-testid="scenarios-history-detail">
        <header className="border-lightgray flex items-center justify-between border-b px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            data-testid="history-detail-back"
          >
            {t("run.backToHistory")}
          </Button>
        </header>
        <div
          className="text-error px-4 py-8 text-center text-sm"
          data-testid="scenarios-history-detail-error"
        >
          {t("library.empty")}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col"
      data-testid="scenarios-history-detail"
    >
      {/* Header */}
      <header className="border-lightgray flex items-center justify-between border-b px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            data-testid="history-detail-back"
          >
            {t("run.backToHistory")}
          </Button>
          {run && (
            <>
              <span
                className="text-primary truncate text-sm font-medium"
                title={run.scenario_name_snapshot}
              >
                {run.scenario_name_snapshot}
              </span>
              <span
                className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${statusBadgeClass(
                  run.status,
                )}`}
                data-testid="history-detail-status-badge"
              >
                {t(`history.runStatus.${run.status}`)}
              </span>
              <span
                className="rounded bg-gray-100 px-2 py-1 font-mono text-xs"
                data-testid="history-detail-run-id-chip"
              >
                {run.id.slice(0, RUN_ID_CHIP_LEN)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyMarkdown}
            disabled={loading || !!error}
            data-testid="history-detail-copy-md"
          >
            {t("run.copyMarkdown")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={deleting}
            disabled={deleting || loading}
            data-testid="history-detail-delete"
          >
            ✕ {t("history.deleteRun")}
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <div
            className="text-darkgray px-4 py-6 text-center text-sm"
            data-testid="scenarios-history-detail-loading"
          >
            …
          </div>
        )}

        {!loading && run && (
          <>
            {/* Live transcript section (current-session only — AUDIT-04) */}
            {isLive && liveToolRows.length > 0 && (
              <div
                className="mb-4 space-y-2"
                data-testid="history-detail-live-transcript"
              >
                {liveToolRows.map((row) => (
                  <RunOutput key={row.toolCallId} row={row} />
                ))}
              </div>
            )}

            {/* Past-session banner (not current session) */}
            {!isLive && (
              <div
                className="border-lightgray text-darkgray mb-4 flex items-center gap-2 rounded border bg-gray-50 px-3 py-2 text-sm"
                data-testid="history-detail-past-session-banner"
              >
                <span aria-hidden="true">ⓘ</span>
                <span>{t("history.pastSessionBanner")}</span>
              </div>
            )}

            {/* Per-step metadata rows — always rendered (AUDIT-04) */}
            <div className="space-y-2">
              {(run.steps ?? []).map((step) => {
                const g = glyphFor(step.status);
                return (
                  <div
                    key={step.id}
                    data-testid={`history-detail-step-${step.step_index}`}
                    className="border-lightgray space-y-1 rounded border px-3 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-darkgray font-mono text-xs">
                        {step.step_index + 1}
                      </span>
                      <span className={`${g.colorClass} font-mono`}>
                        {g.glyph}
                      </span>
                      <span
                        className="text-primary truncate font-mono text-sm"
                        title={step.binary}
                      >
                        {step.binary}
                      </span>
                      <span className="text-darkgray ml-auto text-xs">
                        {formatDurationSeconds(step.duration_ms)}
                      </span>
                    </div>
                    <div className="text-darkgray font-mono text-xs">
                      started_at: {step.started_at ?? "—"} · ended_at:{" "}
                      {step.ended_at ?? "—"} · exit: {step.exit_code ?? "—"}
                    </div>
                    {step.stderr_first_line && (
                      <div
                        data-testid={`history-detail-step-${step.step_index}-stderr`}
                        className="mt-1 rounded bg-red-50 px-2 py-1 font-mono text-xs break-all text-red-800"
                      >
                        {step.stderr_first_line}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
