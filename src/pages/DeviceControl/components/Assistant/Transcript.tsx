import { useCallback, useEffect, useRef, type FC } from "react";
import type { Row } from "./transcriptReducer";
import { OperatorBubble } from "./OperatorBubble";
import { AssistantMessage } from "./AssistantMessage";
import { ToolCallCard } from "./ToolCallCard";
import { ConfirmationCard } from "./ConfirmationCard";

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
}

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

export const Transcript: FC<TranscriptProps> = ({ rows, onConfirm }) => {
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
  }, [rows]);

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
    </div>
  );
};
