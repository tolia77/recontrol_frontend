import type { FC } from "react";
import { useTranslation } from "react-i18next";
import Button from "src/components/ui/Button";
import type { PanelStatus } from "./transcriptReducer";

const MAX_STEPS = 25;

export interface AssistantHeaderProps {
  status: PanelStatus;
  stepCount: number;
  onStop: () => void;
  onCopy: () => void;
  /** New chat: clears UI transcript + backend conversation history. Disabled while a loop is active. */
  onNewChat: () => void;
  /** When true, Stop and Copy buttons receive min-h-[44px] min-w-[44px] touch targets (DCTL-04 D-11) */
  isMobile?: boolean;
}

/**
 * Panel header bar (CHAT-06 / CHAT-07 / CHAT-09).
 *
 * Layout: step counter on the left (hidden when `stepCount === 0`), Copy as
 * Markdown + Stop buttons on the right.
 *
 * Invariants:
 *   - Step counter hidden when 0 (CONTEXT "hidden when idle"; per RESEARCH
 *     §Pitfall 5 the counter increments on `tool_call_start` so a turn that
 *     never reaches a tool stays at 0).
 *   - Stop button is always rendered; `disabled` when status is not in
 *     {streaming, awaiting_confirmation}. Variant is fixed to `danger` so the
 *     red accent appears the moment the loop becomes active (CONTEXT "red
 *     accent when a loop is running").
 *   - Copy as Markdown is variant `ghost` — non-destructive utility, always
 *     enabled even on an empty transcript (downstream `onCopy` handles the
 *     empty-string clipboard write cleanly).
 *
 * Click → backend wire:
 *   - onStop → AssistantPanel dispatches `stop_loop` over AssistantChannel.
 *   - onCopy → AssistantPanel writes the serialized transcript to clipboard.
 *
 * No quota meter (D-08 — deferred to v1.5+ admin tooling).
 */
const AssistantHeader: FC<AssistantHeaderProps> = ({
  status,
  stepCount,
  onStop,
  onCopy,
  onNewChat,
  isMobile,
}) => {
  const { t } = useTranslation("assistant");
  const loopActive =
    status === "streaming" || status === "awaiting_confirmation";
  const stopDisabled = !loopActive;

  const touchTargetClass = isMobile ? "min-h-[44px] min-w-[44px]" : undefined;

  return (
    <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2">
      {stepCount > 0 && (
        <span
          className="text-muted-foreground font-mono text-caption"
          aria-live="polite"
          data-testid="assistant-step-counter"
        >
          {t("header.step", {
            n: stepCount,
            max: MAX_STEPS,
            defaultValue: `Step ${stepCount} / ${MAX_STEPS}`,
          })}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewChat}
          disabled={loopActive}
          aria-label={t("header.newChat", { defaultValue: "New chat" })}
          title={t("header.newChat", { defaultValue: "New chat" })}
          data-testid="assistant-new-chat-button"
          className={touchTargetClass}
        >
          {t("header.newChat", { defaultValue: "New chat" })}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopy}
          aria-label={t("header.copy", { defaultValue: "Copy as Markdown" })}
          title={t("header.copy", { defaultValue: "Copy as Markdown" })}
          className={touchTargetClass}
        >
          {t("header.copy", { defaultValue: "Copy as Markdown" })}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={onStop}
          disabled={stopDisabled}
          aria-label={t("header.stop", { defaultValue: "Stop" })}
          title={t("header.stop", { defaultValue: "Stop" })}
          data-testid="assistant-stop-button"
          className={touchTargetClass}
        >
          {t("header.stop", { defaultValue: "Stop" })}
        </Button>
      </div>
    </div>
  );
};

export default AssistantHeader;
