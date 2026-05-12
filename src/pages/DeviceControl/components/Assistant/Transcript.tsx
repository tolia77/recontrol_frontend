import { useCallback, useEffect, useRef, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { Row, ToolRow } from './transcriptReducer';
import { OperatorBubble } from './OperatorBubble';
import { AssistantMessage } from './AssistantMessage';

/**
 * Scroll container + RowRenderer dispatcher (Plan 20-07).
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
 * The tool-row placeholder shipped here is a minimal one-liner; the full
 * ToolCallCard + ConfirmationCard composition lands in Plan 20-08.
 */

interface TranscriptProps {
  rows: Row[];
}

function rowKey(row: Row): string {
  if (row.kind === 'tool') return `tool:${row.toolCallId}`;
  return `${row.kind}:${row.id}`;
}

const ToolRowPlaceholder: FC<{ row: ToolRow }> = ({ row }) => {
  const { t } = useTranslation('assistant');
  return (
    <div
      className="rounded border border-gray-200 bg-white px-3 py-2 text-xs font-mono"
      data-testid={`tool-row-${row.toolCallId}`}
    >
      <span className="text-darkgray">[{row.state}]</span>{' '}
      <span>$ {row.command}</span>
      {row.args.length > 0 && (
        <span> {row.args.map((a) => String(a)).join(' ')}</span>
      )}
      {row.state === 'awaiting_confirmation' && (
        <div className="mt-1 text-darkgray">
          {t('toolCall.placeholderAwaiting', {
            defaultValue: 'awaiting confirmation',
          })}
        </div>
      )}
    </div>
  );
};

const RowRenderer: FC<{ row: Row }> = ({ row }) => {
  switch (row.kind) {
    case 'operator':
      return <OperatorBubble text={row.text} />;
    case 'assistant':
      return <AssistantMessage markdown={row.markdown} isStreaming={row.isStreaming} />;
    case 'tool':
      return <ToolRowPlaceholder row={row} />;
    default: {
      // Exhaustiveness check — compile error if a new Row kind is added.
      const _exhaustive: never = row;
      return _exhaustive;
    }
  }
};

export const Transcript: FC<TranscriptProps> = ({ rows }) => {
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
      className="flex-1 overflow-y-auto px-4 py-2 space-y-3"
      data-testid="assistant-transcript"
    >
      {rows.map((row) => (
        <RowRenderer key={rowKey(row)} row={row} />
      ))}
    </div>
  );
};
