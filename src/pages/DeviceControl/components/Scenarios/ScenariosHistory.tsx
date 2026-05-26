import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, useToast, LoadingState, ErrorState, EmptyState } from "../../../../components/ui";
import {
  scenarioRunsService,
  type ScenarioRun,
  type ScenarioRunStatus,
} from "../../../../services/backend/scenarioRunsService";
import { STATUS_BADGE_CLASS, buildExitCodeTimeline } from "./exitCodeGlyphs";
import MassDeleteConfirmModal from "./MassDeleteConfirmModal";

// AUDIT-03 + AUDIT-05 (mass-delete arm) visible surface. Plan 22.10 wires the
// onSelectRun callback into the panel's mode router to open HistoryDetail.

const PER_PAGE = 25;

export interface ScenariosHistoryProps {
  onSelectRun: (runId: string) => void;
}

function relativeTimestamp(dateIso: string | null): string {
  if (!dateIso) return "";
  const diff = Date.now() - new Date(dateIso).getTime();
  if (Number.isNaN(diff)) return "";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function durationLabel(run: ScenarioRun): string {
  if (!run.started_at || !run.ended_at) return "—";
  const ms =
    new Date(run.ended_at).getTime() - new Date(run.started_at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

interface HistoryRowProps {
  run: ScenarioRun;
  onSelect: (runId: string) => void;
}

function HistoryRow({ run, onSelect }: HistoryRowProps) {
  const { t } = useTranslation("scenarios");
  const statusKey = run.status as ScenarioRunStatus;
  const badgeClass = STATUS_BADGE_CLASS[statusKey] ?? "";
  const timeline = buildExitCodeTimeline(run, run.steps);

  return (
    <li
      className="border-lightgray flex cursor-pointer items-start gap-3 border-b px-3 py-2 hover:bg-gray-50"
      onClick={() => onSelect(run.id)}
      role="button"
      aria-label={t(`history.runStatus.${statusKey}`)}
      data-testid={`history-row-${run.id}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(run.id);
        }
      }}
    >
      <span
        className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${badgeClass}`}
        data-testid="history-row-badge"
      >
        {t(`history.runStatus.${statusKey}`)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-primary truncate text-sm font-medium">
          {run.scenario_name_snapshot}
        </span>
        <div className="text-darkgray flex items-center gap-2 text-xs">
          {run.device_id && (
            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono">
              {run.device_id.slice(0, 8)}
            </span>
          )}
          <span>{durationLabel(run)}</span>
        </div>
        {timeline.length > 0 && (
          <div
            className="mt-1 flex items-center font-mono text-sm tracking-wide"
            data-testid="history-row-glyphs"
          >
            {timeline.map((entry) =>
              entry.key === "overflow" ? (
                <span
                  key={entry.key}
                  className="text-darkgray ml-1 rounded bg-gray-100 px-2 py-1 text-xs"
                >
                  {entry.glyph}
                </span>
              ) : (
                <span key={entry.key} className={`${entry.colorClass} mr-0.5`}>
                  {entry.glyph}
                </span>
              ),
            )}
          </div>
        )}
      </div>
      <span className="text-darkgray shrink-0 text-xs">
        {relativeTimestamp(run.started_at)}
      </span>
    </li>
  );
}

export default function ScenariosHistory({
  onSelectRun,
}: ScenariosHistoryProps) {
  const { t } = useTranslation("scenarios");
  const toast = useToast();
  const [runs, setRuns] = useState<ScenarioRun[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  // Bumped after a successful destroyAll so the fetch effect re-runs without
  // changing `page` (which would lose the user's pagination cursor in the
  // common case of a refresh-while-on-page-1).
  const [refreshTick, setRefreshTick] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    scenarioRunsService
      .index({ page, per_page: PER_PAGE })
      .then((result) => {
        if (cancelled) return;
        setRuns(result.runs);
        setTotal(result.total);
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
  }, [page, refreshTick]);

  const pageCount = runs.length;
  const from = pageCount === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = pageCount === 0 ? 0 : (page - 1) * PER_PAGE + pageCount;

  const prevDisabled = page === 1;
  const nextDisabled = page * PER_PAGE >= total;

  const handleConfirmDeleteAll = useCallback(async () => {
    setDeleting(true);
    try {
      await scenarioRunsService.destroyAll();
      toast.success(t("history.deleteAllRuns"));
      setDeleteModalOpen(false);
      // Reset back to page 1 and refresh.
      if (page !== 1) {
        setPage(1);
      } else {
        setRefreshTick((tick) => tick + 1);
      }
    } catch {
      toast.error(t("history.deleteAllRuns"));
      setDeleteModalOpen(false);
    } finally {
      setDeleting(false);
    }
  }, [page, t, toast]);

  return (
    <div className="flex flex-col" data-testid="scenarios-history">
      <div className="border-lightgray flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-darkgray text-xs" data-testid="history-showing">
            {t("history.toolbar.showing", { from, to, total })}
          </span>
          <button
            type="button"
            className="text-primary rounded px-2 py-1 text-xs hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={prevDisabled}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            data-testid="history-prev"
          >
            {t("history.toolbar.prev")}
          </button>
          <button
            type="button"
            className="text-primary rounded px-2 py-1 text-xs hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={nextDisabled}
            onClick={() => setPage((p) => p + 1)}
            data-testid="history-next"
          >
            {t("history.toolbar.next")}
          </button>
        </div>
        {total > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setDeleteModalOpen(true)}
            data-testid="history-delete-all"
          >
            ✕ {t("history.deleteAllRuns")}
          </Button>
        )}
      </div>

      {loading && (
        <div data-testid="scenarios-history-loading">
          <LoadingState />
        </div>
      )}
      {!loading && error && (
        <div data-testid="scenarios-history-error">
          <ErrorState
            message={error}
            onRetry={() => setRefreshTick((prev) => prev + 1)}
            retryLabel={t("common:retry")}
          />
        </div>
      )}
      {!loading && !error && total === 0 && (
        <div data-testid="scenarios-history-empty">
          <EmptyState title={t("history.emptyState")} />
        </div>
      )}
      {!loading && !error && total > 0 && (
        <ul className="flex flex-col" data-testid="scenarios-history-list">
          {runs.map((run) => (
            <HistoryRow key={run.id} run={run} onSelect={onSelectRun} />
          ))}
        </ul>
      )}

      <MassDeleteConfirmModal
        open={deleteModalOpen}
        count={total}
        loading={deleting}
        onConfirm={handleConfirmDeleteAll}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}
