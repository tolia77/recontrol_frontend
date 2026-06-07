import { useTranslation } from "react-i18next";
import type { Scenario } from "src/services/backend/scenariosService";
import { Button } from "src/components/ui";

export interface ScenariosRowProps {
  scenario: Scenario;
  currentUserId: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRun: () => void;
  // D-22-08: disables [▶ Run] when the parent ScenariosLibrary knows a run is
  // already in-flight on this row's pinned device (single-in-flight signal).
  runDisabled?: boolean;
  // Hides [▶ Run] entirely. Used by the device-less /scenarios dashboard page,
  // where there is no live device socket to launch a run over.
  showRun?: boolean;
}

function relative(dateIso: string | null | undefined): string {
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

export default function ScenariosRow({
  scenario,
  currentUserId,
  onEdit,
  onDuplicate,
  onDelete,
  onRun,
  runDisabled = false,
  showRun = true,
}: ScenariosRowProps) {
  const { t } = useTranslation("scenarios");
  // SHARE-06: owner vs recipient. Recipients get a read-only marker and do NOT
  // see [Edit] / [Duplicate] / [Delete] (those endpoints would 403 server-side).
  const isOwner = scenario.user_id === currentUserId;
  const descriptionPreview = (scenario.description || "").slice(0, 80);
  const stepCount = scenario.command_steps?.length ?? 0;
  const runCount = scenario.run_count ?? 0;

  return (
    <li
      className="border-border bg-surface flex items-start gap-2 rounded-md border px-3 py-2"
      data-testid={`scenarios-row-${scenario.id}`}
    >
      {/* D-22-08: primary [▶ Run] action on left edge in success token. The
        Button primitive's variant="primary" sets bg-primary; the !bg-success
        override forces the success token per UI-SPEC §[▶ Run] on library row.
        Hidden entirely on the device-less /scenarios page (showRun=false). */}
      {showRun && (
        <Button
          variant="primary"
          size="sm"
          className="!bg-success hover:!bg-success/80"
          onClick={onRun}
          disabled={runDisabled}
          data-testid="scenarios-row-run"
        >
          ▶ {t("library.actions.run")}
        </Button>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-primary truncate font-medium">
            {scenario.name}
          </span>
          {!isOwner && scenario.owner_email && (
            <span
              className="rounded-sm bg-primary/8 px-1.5 py-0.5 text-caption text-primary"
              data-testid="shared-by-badge"
            >
              {t("library.sharedByBadge", { owner: scenario.owner_email })}
            </span>
          )}
          {scenario.pinned_device_id && (
            <span className="bg-primary/10 text-foreground rounded-sm px-1.5 py-0.5 text-caption">
              {t("library.pinnedDeviceChip", {
                device: scenario.pinned_device_id.slice(0, 8),
              })}
            </span>
          )}
        </div>
        {descriptionPreview && (
          <div className="text-muted-foreground truncate text-body">
            {descriptionPreview}
          </div>
        )}
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-caption">
          <span>{t("library.runCount", { count: runCount })}</span>
          <span aria-hidden="true">·</span>
          <span>{t("library.stepCount", { count: stepCount })}</span>
          <span aria-hidden="true">·</span>
          <span>
            {scenario.last_run_at
              ? t("library.lastRun", {
                  relative: relative(scenario.last_run_at),
                })
              : t("library.lastRunNever")}
          </span>
        </div>
      </div>
      {/* D-22-08: P21 right-cluster actions are hidden for recipients (SHARE
        rules). Recipients see only [▶ Run] + the 'Shared by' chip rendered in
        the metadata block above. */}
      {isOwner && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="text-primary hover:bg-primary/8 rounded-sm px-2 py-1 text-caption"
            onClick={onEdit}
            data-testid="scenarios-row-edit"
          >
            {t("library.actions.edit")}
          </button>
          <button
            type="button"
            className="text-primary hover:bg-primary/8 rounded-sm px-2 py-1 text-caption"
            onClick={onDuplicate}
            data-testid="scenarios-row-duplicate"
          >
            {t("library.actions.duplicate")}
          </button>
          <button
            type="button"
            className="text-destructive rounded-sm px-2 py-1 text-caption hover:bg-destructive/10"
            onClick={onDelete}
            data-testid="scenarios-row-delete"
          >
            {t("library.actions.delete")}
          </button>
        </div>
      )}
    </li>
  );
}
