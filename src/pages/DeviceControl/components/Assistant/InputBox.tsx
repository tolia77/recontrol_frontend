import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import Button from "src/components/ui/Button";
import type { PanelStatus } from "./transcriptReducer";

const TICK_MS = 30_000;
// ~8 lines at ~24px line-height = 192px. Keep in sync with the CSS class
// utilities below (and Tailwind's text-sm leading defaults).
const MAX_TEXTAREA_PX = 192;

/**
 * Compute hours+minutes remaining until the next 00:00 UTC boundary.
 *
 * RESEARCH §Pitfall 7: read `Date.now()` at render time so the value can never
 * drift while the tab is throttled in the background. A `setInterval` is only
 * used to force a re-render every ~30 s; the *displayed* value is always
 * derived from the current wall-clock.
 */
function timeToNextUtcMidnight(now: number): {
  hours: number;
  minutes: number;
} {
  const nowDate = new Date(now);
  const next = new Date(
    Date.UTC(
      nowDate.getUTCFullYear(),
      nowDate.getUTCMonth(),
      nowDate.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  const deltaMs = next.getTime() - now;
  const totalMinutes = Math.max(0, Math.floor(deltaMs / 60000));
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export interface InputBoxProps {
  status: PanelStatus;
  onSubmit: (text: string) => void;
  /** When true, mobile-specific adaptations are applied (DCTL-04) */
  isMobile?: boolean;
  /**
   * When >0 and isMobile, the outer container applies paddingBottom equal to
   * this value so the input is pinned above the soft keyboard (DCTL-04 D-10).
   */
  keyboardHeightPx?: number;
}

/**
 * Multi-line input box (CHAT-08 / D-07 / QUOTA-06).
 *
 * Behavior:
 *   - Enter submits; Shift+Enter inserts a newline (CHAT-08).
 *   - Auto-grows from 1 row up to ~8 lines (192px); past that, scrolls.
 *   - Disabled while a loop is running (`status === 'streaming' |
 *     'awaiting_confirmation'`) with a localized tooltip.
 *   - Disabled with an inline reset-time message above the input when
 *     `status === 'halted_quota'` (D-07). The countdown is derived from
 *     `Date.now()` each render and re-rendered every 30 s via `setInterval`
 *     (RESEARCH §Pitfall 7 — countdown drift on tab inactivity).
 *   - Send button is always visible (CONTEXT discretion: discoverability) and
 *     disabled when input is empty or the panel is disabled.
 */
const InputBox: FC<InputBoxProps> = ({ status, onSubmit, isMobile, keyboardHeightPx = 0 }) => {
  const { t } = useTranslation("assistant");
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tick the component every 30s while halted_quota so the displayed
  // reset-time countdown stays in sync. The state value is unused — only the
  // re-render matters; the actual reset-time math reads Date.now() below.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== "halted_quota") return;
    const id = window.setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, [status]);

  // Auto-grow: reset height to auto so scrollHeight reflects content, then cap
  // at MAX_TEXTAREA_PX. Runs in a layout effect so the user never sees the
  // textarea snap.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_TEXTAREA_PX);
    el.style.height = `${next}px`;
  }, [value]);

  const loopActive =
    status === "streaming" || status === "awaiting_confirmation";
  const halted = status === "halted_quota";
  const disabled = loopActive || halted;

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setValue("");
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const tooltip = loopActive
    ? t("input.waitingTooltip", {
        defaultValue: "Waiting for agent — press Stop to interrupt",
      })
    : undefined;

  let resetMsg: string | null = null;
  if (halted) {
    const { hours, minutes } = timeToNextUtcMidnight(Date.now());
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    resetMsg = t("input.halted_quota.inlineMessage", {
      hh,
      mm,
      defaultValue: `Daily quota reached — resets at 00:00 UTC (in ${hh}h ${mm}m)`,
    });
  }

  // When on mobile with the keyboard open, pad the outer container so the
  // input rides above the soft keyboard (DCTL-04 D-10). The transcript above
  // (overflow-y-auto) keeps scrolling normally; only this container shifts.
  const outerStyle =
    isMobile && keyboardHeightPx > 0
      ? { paddingBottom: keyboardHeightPx }
      : undefined;

  return (
    <div className="border-border bg-surface border-t" style={outerStyle}>
      {resetMsg && (
        <div
          className="text-destructive bg-destructive/5 border-destructive/20 border-b px-3 py-2 text-caption"
          role="status"
          aria-live="polite"
          data-testid="assistant-halted-quota-message"
        >
          {resetMsg}
        </div>
      )}
      <div className="flex items-end gap-2 p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
          title={tooltip}
          placeholder={t("input.placeholder", {
            defaultValue: "Ask the assistant to act on this device…",
          })}
          aria-label={t("input.placeholder", {
            defaultValue: "Ask the assistant to act on this device…",
          })}
          className="border-border focus-visible:ring-primary/30 disabled:text-muted-foreground disabled:bg-surface-muted flex-1 resize-none rounded-sm border px-3 py-2 text-body focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed"
          style={{ maxHeight: `${MAX_TEXTAREA_PX}px` }}
          data-testid="assistant-input-textarea"
        />
        <Button
          variant="primary"
          size="sm"
          disabled={disabled || !value.trim()}
          onClick={submit}
          aria-label={t("input.send", { defaultValue: "Send" })}
          data-testid="assistant-send-button"
          className={isMobile ? "min-h-[44px] min-w-[44px]" : undefined}
        >
          {t("input.send", { defaultValue: "Send" })}
        </Button>
      </div>
    </div>
  );
};

export default InputBox;
