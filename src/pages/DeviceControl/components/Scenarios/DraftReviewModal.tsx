/**
 * DraftReviewModal — Phase 23 / Plan 23-09 Task 1.
 *
 * Center-screen review overlay for an AI-generated draft. Mirrors
 * PolicyPreviewModal's overlay+card sizing pattern (D-22-04 / UI-SPEC
 * §DraftReviewModal lines 167-208) but with a different body: per-step rows
 * carrying the AI-draft binary+args+cwd summary plus an optional amber
 * `dry_intent_warning` badge.
 *
 * Pure-presentational: accept / edit / regenerate / cancel are callback
 * props delegated to the parent. The parent (ScenariosPanel, Task 3) owns
 * `scenariosService.create({...draft, created_via_ai: true})` on accept and
 * routes [Edit Draft] back into ScenarioEditor with `prefill` + `backTarget`.
 *
 * Per D-11, the parent strips `dry_intent_warning` before persisting; this
 * modal preserves it in its prop tree so the badge stays visible across
 * modal re-opens (e.g. operator hits Edit Draft, returns via dirty guard).
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import Button from "src/components/ui/Button.tsx";
import type {
  DraftResponse,
  DraftStep,
  DryIntentWarning,
} from "src/services/backend/scenariosService.ts";

export interface DraftReviewModalProps {
  open: boolean;
  draft: DraftResponse["draft"] | null;
  loading?: boolean;
  onAccept: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  onCancel: () => void;
}

// UI-SPEC §DraftReviewModal lines 256-266: 7 pattern IDs map to canonical
// English display strings. These flow into the amber badge label
// (`⚠ <display>`); the tooltip text comes from `t(message_key)` which is
// localized per the locale keys shipped in Plan 23-07.
const PATTERN_DISPLAY_NAMES: Record<string, string> = {
  find_delete: "find -delete",
  dd_of_dev: "dd of=/dev/",
  chmod_777_recursive: "chmod -R 777",
  mkfs: "mkfs",
  truncate_zero: "truncate -s 0",
  redirect_to_system: "> /system path",
  rm_rf_root_adjacent: "rm -rf",
};

function patternDisplayName(pattern: string): string {
  return PATTERN_DISPLAY_NAMES[pattern] ?? pattern;
}

// 80-char truncation for the binary+args row per UI-SPEC line 182.
function truncate80(text: string): string {
  if (text.length <= 80) return text;
  return `${text.slice(0, 77)}...`;
}

function formatBinaryArgs(step: DraftStep): string {
  const argLine =
    step.args.length > 0
      ? `${step.binary} ${step.args.join(" ")}`
      : step.binary;
  return truncate80(argLine);
}

interface DryIntentBadgeProps {
  warning: DryIntentWarning;
}

function DryIntentBadge({ warning }: DryIntentBadgeProps) {
  const { t } = useTranslation("scenarios");
  const tooltip = t(warning.message_key);
  const display = patternDisplayName(warning.pattern);
  return (
    <span
      data-testid={`draft-review-dry-intent-${warning.pattern}`}
      className="text-caption-small rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-700"
      title={tooltip}
      aria-label={`Warning: ${tooltip}`}
    >
      ⚠ {display}
    </span>
  );
}

export default function DraftReviewModal({
  open,
  draft,
  loading = false,
  onAccept,
  onEdit,
  onRegenerate,
  onCancel,
}: DraftReviewModalProps) {
  const { t } = useTranslation("scenarios");

  // ESC dismisses while open — mirrors PolicyPreviewModal lines 91-100.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open || !draft) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div
      data-testid="draft-review-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("ai.draftReviewTitle")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
    >
      <div
        data-testid="draft-review-card"
        className="bg-background mx-4 flex max-h-[70vh] w-full max-w-2xl flex-col rounded-lg shadow-lg"
      >
        {/* Header */}
        <header className="border-lightgray border-b px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3
                className="text-text text-lg font-medium"
                data-testid="draft-review-name"
              >
                {draft.name}
              </h3>
              {draft.description && (
                <p
                  className="text-body-small text-darkgray mt-1"
                  data-testid="draft-review-description"
                >
                  {draft.description}
                </p>
              )}
            </div>
            <span
              className="text-caption-small bg-tertiary text-primary rounded-full px-2 py-0.5 whitespace-nowrap"
              data-testid="draft-review-ai-chip"
            >
              {t("ai.draftReviewTitle")}
            </span>
          </div>
        </header>

        {/* Body — scrollable per-step rows */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {draft.command_steps.map((step, idx) => {
            const isLast = idx === draft.command_steps.length - 1;
            return (
              <div
                key={idx}
                data-testid={`draft-review-step-${idx}`}
                className={`py-3 ${isLast ? "" : "border-lightgray border-b"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-small text-darkgray font-medium">
                    Step {idx + 1}
                  </span>
                  {step.dry_intent_warning && (
                    <DryIntentBadge warning={step.dry_intent_warning} />
                  )}
                </div>
                <div
                  className="text-body-small text-text mt-1 font-mono"
                  data-testid={`draft-review-step-${idx}-cmd`}
                >
                  {formatBinaryArgs(step)}
                </div>
                <div className="text-caption-small text-darkgray">
                  cwd: {step.cwd}
                </div>
                {step.description && (
                  <div className="text-caption-small text-darkgray italic">
                    {step.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sticky footer */}
        <div className="border-lightgray bg-background flex items-center justify-between border-t px-6 py-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
            data-testid="draft-review-discard"
            type="button"
          >
            {t("ai.discardDraft")}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onRegenerate}
              data-testid="draft-review-regenerate"
              type="button"
            >
              {t("ai.regenerate")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onEdit}
              data-testid="draft-review-edit"
              type="button"
            >
              {t("ai.editDraft")}
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onAccept}
              disabled={loading}
              loading={loading}
              data-testid="draft-review-accept"
              type="button"
            >
              {t("ai.acceptAndSave")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
