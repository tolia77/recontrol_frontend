import type { FC } from "react";

/**
 * Left-aligned plain-text bubble for operator-authored messages.
 *
 * CHAT-03: operator messages render as plain text, not markdown. Markdown
 * input rendering is deferred to v1.5+ (see 20-CONTEXT deferred list).
 */
export interface OperatorBubbleProps {
  text: string;
}

const OperatorBubble: FC<OperatorBubbleProps> = ({ text }) => (
  <div className="flex justify-start">
    <div className="bg-tertiary text-text max-w-[80%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap">
      {text}
    </div>
  </div>
);

export default OperatorBubble;
