import { useCallback, useEffect, useReducer, useRef } from "react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "src/components/ui";
import { useAssistantChannel } from "../../hooks/realtime/useAssistantChannel";
import type { AssistantBroadcast } from "../../hooks/realtime/useAssistantChannel";
import { initialTranscriptState, transcriptReducer } from "./transcriptReducer";
import { Transcript } from "./Transcript";
import { AssistantHeader } from "./AssistantHeader";
import { InputBox } from "./InputBox";
import { copyAsMarkdown } from "./copyAsMarkdown";

export interface AssistantPanelProps {
  deviceId: string;
  ws: WebSocket | null;
  deviceName: string;
}

/**
 * Mint a session_token UUID for the new prompt.
 *
 * The reducer uses this value as the STREAM-04 broadcast filter. The backend
 * (`AssistantChannel#run_prompt`) mints its own session_token and broadcasts
 * with that value — the client-minted value here is the local discriminator
 * the reducer keeps until the panel learns the backend's via a future
 * `accepted` envelope (currently unused). In practice both values coexist on
 * the wire: the backend's session_token shows up in every broadcast and
 * passes the reducer's filter only if the reducer has been seeded with the
 * matching value. Today the reducer trusts whatever submit_prompt provides;
 * future hardening should reconcile with the backend's accepted-envelope
 * token (deferred — see threat model T-20-09-04).
 */
function generateSessionToken(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

/**
 * Top-level assistant panel — Plan 20-09 final wiring.
 *
 * Layout: AssistantHeader (step counter + Stop + Copy) on top, Transcript (or
 * idle placeholder) in the middle, InputBox on the bottom. The InputBox owns
 * the halted_quota inline reset-time message.
 *
 * Side-effects orchestrated here:
 *   - Submit prompt: mint session_token, dispatch `submit_prompt` to reducer,
 *     dispatch `run_prompt` over AssistantChannel.
 *   - Stop: dispatch `stop_loop` over AssistantChannel; the reducer transitions
 *     to idle on the eventual `done(:user_stopped)` broadcast.
 *   - Copy as Markdown: serialize state.rows and write to navigator.clipboard.
 *   - 80% quota_warning: fire a single Toast per run via useEffect watching
 *     the reducer's `quotaWarningShown` flag; the flag resets on submit_prompt
 *     so the next run can warn again (the backend also dedupes once-per-run).
 *
 * Conversation state lives in `useReducer` state — nothing in localStorage,
 * nothing in the backend (CHAT-11). Closing the tab clears the panel.
 */
export function AssistantPanel({
  deviceId,
  ws,
  deviceName,
}: AssistantPanelProps): JSX.Element {
  const { t } = useTranslation("assistant");
  const toast = useToast();
  const [state, dispatchTranscript] = useReducer(
    transcriptReducer,
    initialTranscriptState,
  );
  const quotaWarningShownRef = useRef(false);

  const onBroadcast = useCallback((msg: AssistantBroadcast): void => {
    dispatchTranscript({ type: "broadcast", broadcast: msg });
  }, []);

  const { dispatch } = useAssistantChannel({ socket: ws, onBroadcast });

  // 80% quota Toast — fires once when the reducer flips the flag (which
  // happens at most once per run; the reducer resets the flag on
  // submit_prompt). The local ref guards against the unlikely case where
  // React replays the effect with the flag still true (StrictMode double
  // invoke); we only fire when the flag transitions false→true.
  useEffect(() => {
    if (state.quotaWarningShown && !quotaWarningShownRef.current) {
      quotaWarningShownRef.current = true;
      toast.warning(
        t("quota.warningToast", {
          defaultValue: "You've used 80% of today's AI quota.",
        }),
      );
    } else if (!state.quotaWarningShown && quotaWarningShownRef.current) {
      quotaWarningShownRef.current = false;
    }
  }, [state.quotaWarningShown, toast, t]);

  const handleConfirm = useCallback(
    (confirmationId: string, decision: "allow" | "deny") => {
      dispatch("confirm_tool_call", {
        confirmation_id: confirmationId,
        decision,
      });
    },
    [dispatch],
  );

  const handleSubmit = useCallback(
    (text: string) => {
      const sessionToken = generateSessionToken();
      dispatchTranscript({ type: "submit_prompt", text, sessionToken });
      dispatch("run_prompt", { prompt: text, session_token: sessionToken });
    },
    [dispatch],
  );

  const handleStop = useCallback(() => {
    dispatch("stop_loop", {});
  }, [dispatch]);

  const handleCopy = useCallback(() => {
    const md = copyAsMarkdown(state.rows);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(md)
        .then(() =>
          toast.success(
            t("header.copySuccess", {
              defaultValue: "Transcript copied to clipboard",
            }),
          ),
        )
        .catch(() =>
          toast.error(
            t("header.copyError", {
              defaultValue: "Could not copy to clipboard",
            }),
          ),
        );
    } else {
      toast.error(
        t("header.copyError", { defaultValue: "Could not copy to clipboard" }),
      );
    }
  }, [state.rows, toast, t]);

  const isEmpty = state.rows.length === 0;

  return (
    <div
      data-testid="assistant-panel"
      data-device-id={deviceId}
      className="bg-background text-text flex h-full w-full flex-col outline-none"
    >
      <AssistantHeader
        status={state.status}
        stepCount={state.stepCount}
        onStop={handleStop}
        onCopy={handleCopy}
      />

      {isEmpty ? (
        <div className="text-darkgray flex flex-1 items-center justify-center px-4 text-center text-sm">
          {t("idle.greeting", {
            deviceName,
            defaultValue: `What can I help with on ${deviceName}?`,
          })}
        </div>
      ) : (
        <Transcript rows={state.rows} onConfirm={handleConfirm} />
      )}

      <InputBox status={state.status} onSubmit={handleSubmit} />
    </div>
  );
}
