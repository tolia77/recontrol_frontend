import type { FC } from 'react';
import { Streamdown } from 'streamdown';

/**
 * Full-width assistant message rendered through Streamdown.
 *
 * CHAT-03 / RESEARCH §"Streamdown render":
 *   - Streamdown handles incomplete bold / code / list boundaries without
 *     flicker (its progressive parser keeps trailing partial tokens hidden
 *     until they close).
 *   - Default sanitizer chain (rehype-sanitize + rehype-harden) protects
 *     against XSS via injected HTML; we never set `skipHtml={false}` and
 *     never bypass with dangerouslySetInnerHTML (threat T-20-07-02).
 *   - `isStreaming` only drives the trailing caret in this plan; the
 *     streamdown `isAnimating` token-fade animation is out of scope here
 *     (RESEARCH notes its API is unstable in 2.5.0).
 */
export interface AssistantMessageProps {
  markdown: string;
  isStreaming: boolean;
}

export const AssistantMessage: FC<AssistantMessageProps> = ({ markdown, isStreaming }) => (
  <div className="prose prose-sm max-w-none">
    <Streamdown>{markdown}</Streamdown>
    {isStreaming && (
      <span
        className="inline-block w-2 h-4 ml-1 align-middle bg-darkgray animate-pulse"
        aria-hidden="true"
      />
    )}
  </div>
);
