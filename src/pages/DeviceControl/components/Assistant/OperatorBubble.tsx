import type { FC } from 'react';

/**
 * Left-aligned plain-text bubble for operator-authored messages.
 *
 * CHAT-03: operator messages render as plain text, not markdown. Markdown
 * input rendering is deferred to v1.5+ (see 20-CONTEXT deferred list).
 */
export interface OperatorBubbleProps {
  text: string;
}

export const OperatorBubble: FC<OperatorBubbleProps> = ({ text }) => (
  <div className="flex justify-start">
    <div className="max-w-[80%] rounded-lg bg-tertiary text-text px-3 py-2 text-sm whitespace-pre-wrap break-words">
      {text}
    </div>
  </div>
);
