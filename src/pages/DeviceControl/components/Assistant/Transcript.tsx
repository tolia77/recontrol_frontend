import { useCallback, useEffect, useRef, type FC } from "react";
import { useTranslation } from "react-i18next";
import type { Row } from "./transcriptReducer";
import OperatorBubble from "./OperatorBubble";
import AssistantMessage from "./AssistantMessage";
import ToolCallCard from "./ToolCallCard";
import ConfirmationCard from "./ConfirmationCard";

/**
 * Scroll container + RowRenderer dispatcher (Plan 20-07; ToolRowPlaceholder
 * replaced by ToolCallCard / ConfirmationCard in Plan 20-08).
 *
 * Auto-scroll behavior (CHAT-02 / RESEARCH §Pattern 2):
 *   - Pinned to bottom as new rows arrive while the operator has not
 *     scrolled up.
 *   - Disengages on scroll-up (≥16px distance from bottom).
 *   - Re-engages when the operator returns to the bottom.
 *
 * 16px tolerance handles sub-pixel rounding and the moment between a token
 * append and the layout pass that grows scrollHeight; we explicitly avoid
 * smooth-scrolling because the intermediate frames would trip the disengage
 * threshold (RESEARCH §Pattern 2 Pitfall).
 *
 * Tool-row dispatching (20-08):
 *   - `row.state === 'awaiting_confirmation'` → ConfirmationCard. The card
 *     receives an `onConfirm(decision)` callback that closes over the row's
 *     `confirmationId` (validated upstream).
 *   - Any other tool row state → ToolCallCard.
 *
 * The dispatch pathway for `confirm_tool_call` lives in AssistantPanel.tsx
 * (sourced from `useAssistantChannel.dispatch`); Transcript receives the
 * pre-wired `onConfirm(confirmationId, decision)` callback and only routes.
 */

interface TranscriptProps {
  rows: Row[];
  onConfirm: (confirmationId: string, decision: "allow" | "deny") => void;
  /**
   * Show the "thinking" indicator at the bottom of the transcript. The panel
   * sets this while the agent is working but nothing is actively rendering
   * progress yet (waiting for the first token, or between a tool result and
   * the next token). Suppressed once an assistant row is streaming its caret.
   */
  showThinking?: boolean;
}

/** Three pulsing dots shown while the agent is working but silent. */
const ThinkingIndicator: FC = () => {
  const { t } = useTranslation("assistant");
  const label = t("thinking", { defaultValue: "Thinking…" });
  return (
    <div
      className="text-muted-foreground flex items-center gap-2 text-caption"
      role="status"
      aria-live="polite"
      data-testid="assistant-thinking-indicator"
    >
      <span className="flex gap-1" aria-hidden="true">
        <span className="bg-muted-foreground inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:0ms]" />
        <span className="bg-muted-foreground inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:150ms]" />
        <span className="bg-muted-foreground inline-block h-1.5 w-1.5 animate-pulse rounded-full [animation-delay:300ms]" />
      </span>
      {label}
    </div>
  );
};

function rowKey(row: Row): string {
  if (row.kind === "tool") return `tool:${row.toolCallId}`;
  return `${row.kind}:${row.id}`;
}

const RowRenderer: FC<{
  row: Row;
  onConfirm: TranscriptProps["onConfirm"];
}> = ({ row, onConfirm }) => {
  switch (row.kind) {
    case "operator":
      return <OperatorBubble text={row.text} />;
    case "assistant":
      return (
        <AssistantMessage
          markdown={row.markdown}
          isStreaming={row.isStreaming}
        />
      );
    case "tool":
      if (row.state === "awaiting_confirmation") {
        return (
          <ConfirmationCard
            row={row}
            onConfirm={(decision) => {
              if (row.confirmationId) onConfirm(row.confirmationId, decision);
            }}
          />
        );
      }
      return <ToolCallCard row={row} />;
    default: {
      // Exhaustiveness check — compile error if a new Row kind is added.
      const _exhaustive: never = row;
      return _exhaustive;
    }
  }
};

const Transcript: FC<TranscriptProps> = ({ rows, onConfirm, showThinking }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyToBottomRef = useRef(true);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickyToBottomRef.current = distanceFromBottom < 16;
  }, []);

  useEffect(() => {
    if (!stickyToBottomRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    // Two-phase scroll: jump now, then again after the next paint catches
    // any streamdown incremental layout growth.
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      if (!stickyToBottomRef.current) return;
      const el2 = containerRef.current;
      if (!el2) return;
      el2.scrollTop = el2.scrollHeight;
    });
  }, [rows, showThinking]);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="flex-1 space-y-3 overflow-y-auto px-4 py-2"
      data-testid="assistant-transcript"
    >
      {rows.map((row) => (
        <RowRenderer key={rowKey(row)} row={row} onConfirm={onConfirm} />
      ))}
      {showThinking && <ThinkingIndicator />}
    </div>
  );
};

export default Transcript;
