import { useState, type FC } from "react";
import { useTranslation } from "react-i18next";
import Card from "src/components/ui/Card";
import type { ToolRow, ToolRowState } from "./transcriptReducer";

/**
 * ToolCallCard (Plan 20-08).
 *
 * Renders a tool row (`row.kind === 'tool'` with `state ∈ {pending, running,
 * done, error, denied}`) using the existing `Card` primitive (CHAT-10 — no
 * new layout abstractions).
 *
 * Composition:
 *   - StatusBadge — pill that maps each ToolRowState to a Tailwind palette
 *     token. Includes a spinner glyph on `running`.
 *   - Command label — `$ <command> <args joined>` in monospaced font.
 *   - Elapsed time — `ran in {{seconds}}s` once `endedAt` is set
 *     (REQUIREMENTS §CHAT-04).
 *   - Collapsed `<details>` body — stdout/stderr capped at MAX_LINES_DEFAULT
 *     (200) lines with a "show all" escape that flips a local `showAll`
 *     state (REQUIREMENTS §CHAT-05).
 *
 * Security invariant (RESEARCH §Security Domain Pattern — XSS via tool
 * stdout): tool output renders as plain `<pre>`, NEVER as markdown or HTML.
 * Backend already strips ANSI / control chars (Phase 19 D-09); the frontend
 * does not re-sanitize.
 *
 * The ConfirmationCard variant (`awaiting_confirmation` state) is a sibling
 * component selected by Transcript.tsx's RowRenderer; ToolCallCard renders
 * the post-decision states only.
 */

const MAX_LINES_DEFAULT = 200;

interface StatusBadgeProps {
  state: ToolRowState;
}

const stateClass: Record<ToolRowState, string> = {
  awaiting_confirmation: "bg-amber text-white",
  pending: "bg-gray-200 text-darkgray",
  running: "bg-secondary text-white",
  done: "bg-accent text-white",
  error: "bg-error text-white",
  denied: "bg-lightgray text-darkgray",
};

const StatusBadge: FC<StatusBadgeProps> = ({ state }) => {
  const { t } = useTranslation("assistant");
  const label = t(`toolCall.status.${state}`, {
    defaultValue: state.replace(/_/g, " "),
  });
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${stateClass[state]}`}
      data-testid={`tool-status-${state}`}
    >
      {state === "running" && (
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
};

function clipTo(
  text: string,
  maxLines: number,
): { clipped: string; truncated: boolean } {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return { clipped: text, truncated: false };
  return {
    clipped: lines.slice(0, maxLines).join("\n"),
    truncated: true,
  };
}

interface ToolCallCardProps {
  row: ToolRow;
}

const ToolCallCard: FC<ToolCallCardProps> = ({ row }) => {
  const { t } = useTranslation("assistant");
  const [showAll, setShowAll] = useState(false);

  const elapsed =
    row.endedAt && row.startedAt
      ? ((row.endedAt - row.startedAt) / 1000).toFixed(1)
      : null;

  const stdoutText = row.result?.stdout ?? "";
  const stderrText = row.result?.stderr ?? "";
  const combinedRaw = [stdoutText, stderrText].filter(Boolean).join("\n");
  const { clipped, truncated } = showAll
    ? { clipped: combinedRaw, truncated: false }
    : clipTo(combinedRaw, MAX_LINES_DEFAULT);

  const argsText = row.args.map((a) => String(a)).join(" ");

  return (
    <Card
      padding="sm"
      className="border-secondary border-l-4"
      data-testid={`tool-call-card-${row.toolCallId}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge state={row.state} />
        <span className="min-w-0 flex-1 font-mono text-sm break-all">
          $ {row.command}
          {argsText && ` ${argsText}`}
        </span>
        {elapsed !== null && (
          <span className="text-darkgray text-xs">
            {t("toolCall.elapsed", {
              seconds: elapsed,
              defaultValue: `ran in ${elapsed}s`,
            })}
          </span>
        )}
      </div>

      {row.result?.error && row.state === "error" && (
        <div className="text-error mt-2 font-mono text-xs break-all">
          {row.result.error}
        </div>
      )}

      {combinedRaw.length > 0 && (
        <details className="mt-2">
          <summary className="text-darkgray cursor-pointer text-xs select-none">
            {t("toolCall.showOutput", { defaultValue: "show output" })}
          </summary>
          <pre className="bg-background mt-1 max-h-80 overflow-auto rounded p-2 text-xs break-all whitespace-pre-wrap">
            {clipped}
          </pre>
          {truncated && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-secondary mt-1 text-xs hover:underline"
            >
              {t("toolCall.showAll", { defaultValue: "show all" })}
            </button>
          )}
        </details>
      )}
    </Card>
  );
};

export default ToolCallCard;
