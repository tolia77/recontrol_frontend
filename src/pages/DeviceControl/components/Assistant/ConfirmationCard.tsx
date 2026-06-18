import type { FC } from "react";
import { useTranslation } from "react-i18next";
import Card from "src/components/ui/Card";
import Button from "src/components/ui/Button";
import type { ToolRow } from "./transcriptReducer";
import { WarningTriangleIcon } from "./icons";

/**
 * ConfirmationCard.
 *
 * Per-zone-tinted variant of ToolCallCard rendered when
 * `row.state === 'awaiting_confirmation'`. Selection between ToolCallCard
 * and ConfirmationCard happens in Transcript.tsx's RowRenderer.
 *
 * Zone tint:
 *   - `outside_list` → amber accent on a Card surface; soft amber background.
 *     (The legacy `deny_list` zone was removed with the deny-list.)
 *
 * Buttons:
 *   - `[Allow once]` (variant="secondary") — dispatches
 *     `confirm_tool_call({confirmation_id, decision: 'allow'})` over the
 *     AssistantChannel via the `onConfirm` callback prop (sourced from
 *     `useAssistantChannel.dispatch` in AssistantPanel).
 *   - `[Deny]` (variant="danger") — dispatches the same envelope with
 *     `decision: 'deny'`. Backend delivers `{error: 'denied_by_operator'}`
 *     to the LLM and the reducer transitions the row state to `'denied'` on
 *     the next `tool_call_result` broadcast.
 *
 * Wire-format invariant: backend's AssistantChannel#confirm_tool_call expects
 * `confirmation_id` (NOT `tool_call_id`) — verified at
 * `recontrol_backend/app/channels/assistant_channel.rb:63-72`. The card
 * always sends `row.confirmationId`.
 *
 * The buttons disable when `confirmationId` is undefined (defense-in-depth
 * against malformed envelopes); production envelopes always carry it.
 *
 * NEVER rendered as a modal — always inline in the transcript. NEVER
 * auto-dismisses on a timeout (the backend ConfirmationRegistry enforces the
 * 120s wall-clock; the frontend just waits).
 */

const ZONE_ACCENT: Record<NonNullable<ToolRow["zone"]>, string> = {
  outside_list: "border-l-4 border-warning bg-warning/5",
};

const ZONE_BADGE: Record<NonNullable<ToolRow["zone"]>, string> = {
  outside_list: "bg-warning/15 text-warning",
};

interface ConfirmationCardProps {
  row: ToolRow;
  onConfirm: (decision: "allow" | "deny") => void;
}

const ConfirmationCard: FC<ConfirmationCardProps> = ({
  row,
  onConfirm,
}) => {
  const { t } = useTranslation("assistant");
  const zone = row.zone ?? "outside_list";
  const accentClass = ZONE_ACCENT[zone];
  const badgeClass = ZONE_BADGE[zone];
  const iconColor = "text-warning";

  // Localized reason; falls back to a sensible default if the locale key is
  // missing (`row.reason` is server-provided and may be a forward-compat
  // string the current locale bundle does not cover).
  const reasonKey = `confirmation.reasons.${row.reason ?? zone}`;
  const reasonText = t(reasonKey, {
    defaultValue:
      "This command is outside the safe-list and needs your approval.",
  });

  const zoneLabel = t(`confirmation.zone.${zone}`, {
    defaultValue: "Outside allow-list",
  });

  const argsText = row.args.map((a) => String(a)).join(" ");
  const confirmationId = row.confirmationId;
  const canDecide = Boolean(confirmationId);

  return (
    <Card
      padding="sm"
      className={accentClass}
      data-testid={`confirmation-card-${row.toolCallId}`}
    >
      <div className="flex items-start gap-2">
        <WarningTriangleIcon
          className={`${iconColor} mt-0.5 h-5 w-5 flex-shrink-0`}
        />
        <div className="min-w-0 flex-1">
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
            data-testid={`confirmation-zone-${zone}`}
          >
            {zoneLabel}
          </span>
          <p className="mt-1 text-body">{reasonText}</p>
          <pre className="mt-1 rounded-sm bg-surface-muted p-1.5 font-mono text-caption break-all whitespace-pre-wrap">
            $ {row.command}
            {argsText && ` ${argsText}`}
          </pre>
          <div className="mt-2 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!canDecide}
              onClick={() => {
                if (canDecide) onConfirm("allow");
              }}
              data-testid="confirmation-allow"
            >
              {t("confirmation.allowOnce", { defaultValue: "Allow once" })}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!canDecide}
              onClick={() => {
                if (canDecide) onConfirm("deny");
              }}
              data-testid="confirmation-deny"
            >
              {t("confirmation.deny", { defaultValue: "Deny" })}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ConfirmationCard;
