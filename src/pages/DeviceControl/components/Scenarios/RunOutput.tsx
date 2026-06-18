import type { FC } from "react";
import { useTranslation } from "react-i18next";
import ToolCallCard from "src/pages/DeviceControl/components/Assistant/ToolCallCard";
import type { ToolRow } from "src/pages/DeviceControl/components/Assistant/transcriptReducer";

/**
 * RunOutput — thin presentational wrapper around ToolCallCard, hosting one step
 * of a scenario run.
 *
 * When the step was skipped (a `scenario_step_skipped` envelope arrived for
 * this step's index), the parent passes a `skippedReason` string. The wrapper
 * then dims the card (`opacity-50`) and appends a small muted `⊘ Skipped` label
 * below it.
 *
 * Invariants:
 *   - ToolCallCard is rendered without modification.
 *   - `row` is passed through unchanged — never mutated.
 *   - Pure presentational; accepts no callbacks.
 */

export interface RunOutputProps {
  row: ToolRow;
  skippedReason?: string;
}

const RunOutput: FC<RunOutputProps> = ({ row, skippedReason }) => {
  const { t } = useTranslation("scenarios");

  if (!skippedReason) {
    return <ToolCallCard row={row} />;
  }

  return (
    <div
      className="opacity-50"
      data-testid={`run-output-skipped-${row.toolCallId}`}
    >
      <ToolCallCard row={row} />
      <span className="text-muted-foreground mt-1 inline-block text-caption">
        ⊘ {t("history.stepStatus.skipped")}
      </span>
    </div>
  );
};

export default RunOutput;
