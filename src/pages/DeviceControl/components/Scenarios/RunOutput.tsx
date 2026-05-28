import type { FC } from "react";
import { useTranslation } from "react-i18next";
import ToolCallCard from "../Assistant/ToolCallCard";
import type { ToolRow } from "../Assistant/transcriptReducer";

/**
 * RunOutput — thin presentational wrapper around the existing v1.4 ToolCallCard
 * (UI-03: verbatim reuse). Hosts one step of a scenario run.
 *
 * When the step was skipped (a `scenario_step_skipped` envelope arrived for
 * this step's index), the parent passes a `skippedReason` string. The wrapper
 * applies `opacity-50` to the entire card and appends a small muted label
 * (`⊘ Skipped`) below it (UI-SPEC §Run-mode takeover body, lines 218–222).
 *
 * Invariants:
 *   - ToolCallCard is imported and rendered without modification (UI-03).
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
      <span className="text-darkgray mt-1 inline-block text-xs">
        ⊘ {t("history.stepStatus.skipped")}
      </span>
    </div>
  );
};

export default RunOutput;
