import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslation } from "react-i18next";
import ChipInput from "src/components/ui/ChipInput";
import type {
  CommandStep,
  VerdictAtSave,
} from "src/services/backend/scenariosService";

export interface StepRowProps {
  step: CommandStep;
  index: number;
  verdict?: VerdictAtSave;
  onChange: (next: CommandStep) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

// D-10 / D-11: server returns verdict_at_save per step on save; platform-agnostic
// allow / needs_confirm / deny is rendered as a coloured pill using the project
// palette (accent / amber / error tokens defined in src/index.css @theme).
function VerdictBadge({ verdict }: { verdict?: VerdictAtSave }) {
  const { t } = useTranslation("scenarios");
  if (!verdict) return null;
  const map: Record<
    VerdictAtSave["decision"],
    { className: string; label: string }
  > = {
    allow: {
      className: "bg-success/15 text-success",
      label: t("editor.verdictBadges.allow"),
    },
    needs_confirm: {
      className: "bg-warning/20 text-warning",
      label: t("editor.verdictBadges.needsConfirm"),
    },
    deny: {
      className: "bg-destructive/15 text-destructive",
      label: t("editor.verdictBadges.deny"),
    },
  };
  const m = map[verdict.decision];
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 text-caption ${m.className}`}
      data-testid={`verdict-${verdict.decision}`}
      title={verdict.reason}
    >
      {m.label}
    </span>
  );
}

// D-08: compact row anatomy —
//   [≡ drag][step#][verdict?]  [Duplicate][×]
//   [binary 40% | cwd 60%]
//   [args ChipInput]
//   <details> description </details>
export default function StepRow({
  step,
  index,
  verdict,
  onChange,
  onDuplicate,
  onRemove,
  disabled = false,
}: StepRowProps) {
  const { t } = useTranslation("scenarios");
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: step.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded border p-2 ${
        verdict?.decision === "deny"
          ? "border-destructive bg-destructive/5"
          : "border-border bg-surface"
      }`}
      data-testid={`step-row-${index}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="text-muted-foreground hover:text-primary cursor-grab"
          aria-label={t("editor.steps.dragHandle")}
          {...attributes}
          {...listeners}
          data-testid={`step-drag-${index}`}
        >
          ≡
        </button>
        <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-caption">
          {t("editor.steps.stepNumber", { n: index + 1 })}
        </span>
        <VerdictBadge verdict={verdict} />
        <div className="flex-1" />
        <button
          type="button"
          className="rounded-sm px-2 py-0.5 text-caption hover:bg-surface-muted disabled:opacity-50"
          onClick={onDuplicate}
          disabled={disabled}
          data-testid={`step-duplicate-${index}`}
        >
          {t("editor.steps.duplicate")}
        </button>
        <button
          type="button"
          className="text-destructive hover:bg-destructive/10 rounded-sm px-2 py-0.5 text-caption disabled:opacity-50"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t("editor.steps.remove")}
          data-testid={`step-remove-${index}`}
        >
          ×
        </button>
      </div>
      <div className="mt-2 grid grid-cols-[40%_60%] gap-2">
        <div>
          <label className="text-muted-foreground block text-caption">
            {t("editor.steps.binaryLabel")}
          </label>
          <input
            type="text"
            value={step.binary}
            maxLength={128}
            onChange={(e) => onChange({ ...step, binary: e.target.value })}
            placeholder={t("editor.steps.binaryPlaceholder")}
            className="border-border w-full rounded border px-2 py-1 text-body"
            disabled={disabled}
            data-testid={`step-binary-${index}`}
          />
        </div>
        <div>
          <label className="text-muted-foreground block text-caption">
            {t("editor.steps.cwdLabel")}
          </label>
          <input
            type="text"
            value={step.cwd}
            maxLength={512}
            onChange={(e) => onChange({ ...step, cwd: e.target.value })}
            placeholder={t("editor.steps.cwdPlaceholder")}
            className="border-border w-full rounded border px-2 py-1 text-body"
            disabled={disabled}
            data-testid={`step-cwd-${index}`}
          />
        </div>
      </div>
      <div className="mt-2">
        <label className="text-muted-foreground block text-caption">
          {t("editor.steps.argsLabel")}
        </label>
        <ChipInput
          value={step.args}
          onChange={(args) => onChange({ ...step, args })}
          placeholder={t("editor.steps.argsPlaceholder")}
          maxChips={32}
          maxChipLength={1024}
          disabled={disabled}
          data-testid={`step-args-${index}`}
        />
      </div>
      <details className="mt-2" open={Boolean(step.description)}>
        <summary className="text-muted-foreground cursor-pointer text-caption">
          {t("editor.steps.descriptionLabel")}
        </summary>
        <textarea
          value={step.description ?? ""}
          maxLength={200}
          onChange={(e) => onChange({ ...step, description: e.target.value })}
          placeholder={t("editor.steps.descriptionPlaceholder")}
          className="border-border mt-1 w-full rounded border px-2 py-1 text-body"
          rows={2}
          disabled={disabled}
          data-testid={`step-description-${index}`}
        />
      </details>
    </div>
  );
}
