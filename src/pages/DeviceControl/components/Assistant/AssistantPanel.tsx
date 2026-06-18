import { useCallback, useEffect } from "react";
// S-02c: streamdown CSS pulled into this lazy chunk so it only loads when the AI
// panel is first opened, removing mermaid-adjacent CSS from the main bundle.
import "streamdown/styles.css";
import { useVisualViewport } from "src/pages/DeviceControl/hooks/useVisualViewport";
import type { Dispatch, JSX } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "src/components/ui";
import type { AssistantDispatchAction } from "src/pages/DeviceControl/hooks/realtime/useAssistantChannel";
import type { TranscriptAction, TranscriptState } from "./transcriptReducer";
import Transcript from "./Transcript";
import AssistantHeader from "./AssistantHeader";
import InputBox from "./InputBox";
import { copyAsMarkdown } from "./copyAsMarkdown";

export interface AssistantPanelProps {
  deviceId: string;
  /**
   * Lifted transcript state + dispatchers. The reducer and the
   * AssistantChannel subscription live in DeviceControl (page lifetime) so
   * the conversation — UI rows AND the backend channel-instance history —
   * survives right-pane switches that unmount this panel.
   */
  state: TranscriptState;
  dispatchTranscript: Dispatch<TranscriptAction>;
  dispatch: (action: AssistantDispatchAction, data?: object) => void;
  deviceName: string;
  /**
   * When true, the current user is a confirmed non-owner. AssistantChannel is
   * owner-only (backend `valid_subscription?`), so the panel renders a clear
   * owner-only notice instead of the chat UI and the misleading
   * `subscription_rejected` connection error. Computed by the parent once
   * ownership has resolved, so it never flashes for a real owner mid-load.
   */
  accessDenied?: boolean;
  /** When true, mobile adaptations are applied */
  isMobile?: boolean;
  /**
   * Called when the full-height state changes — the parent threads this signal
   * to DeviceControlBottomSheet's forceFullHeight prop.
   */
  onFullHeightChange?: (full: boolean) => void;
}

/**
 * Mint a session_token UUID for the new prompt.
 *
 * The reducer uses this value as the broadcast session_token filter. The
 * backend (`AssistantChannel#run_prompt`) mints its own session_token and
 * broadcasts with that value — the client-minted value here is the local
 * discriminator the reducer keeps until the panel learns the backend's via a
 * future `accepted` envelope (currently unused). In practice both values
 * coexist on the wire: the backend's session_token shows up in every broadcast
 * and passes the reducer's filter only if the reducer has been seeded with the
 * matching value. Today the reducer trusts whatever submit_prompt provides;
 * future hardening should reconcile with the backend's accepted-envelope token.
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
 * Top-level assistant panel.
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
 *
 * Conversation state lives in DeviceControl's `useReducer` (lifted so it
 * survives pane switches) — nothing in localStorage, nothing persisted in the
 * backend. Leaving the page / closing the tab clears the panel. The
 * 80% quota Toast also lives in DeviceControl (a panel-local mount ref would
 * re-fire it on every remount).
 */
function AssistantPanel({
  deviceId,
  state,
  dispatchTranscript,
  dispatch,
  deviceName,
  accessDenied,
  isMobile,
  onFullHeightChange,
}: AssistantPanelProps): JSX.Element {
  const { t } = useTranslation("assistant");
  const toast = useToast();

  // Mobile: track keyboard height to pin InputBox above soft keyboard.
  // The hook is always called (Rules of Hooks), but only has effect on mobile where
  // the VisualViewport API is available. On desktop, keyboardHeight stays 0.
  const { keyboardHeight } = useVisualViewport();

  // Signal forceFullHeight to the sheet when the keyboard raises/lowers.
  const inputFocusedFull = isMobile === true && keyboardHeight > 0;
  useEffect(() => {
    onFullHeightChange?.(inputFocusedFull);
    return () => onFullHeightChange?.(false);
  }, [inputFocusedFull, onFullHeightChange]);

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
    [dispatch, dispatchTranscript],
  );

  const handleStop = useCallback(() => {
    dispatch("stop_loop", {});
  }, [dispatch]);

  const handleNewChat = useCallback(() => {
    dispatch("reset_conversation", {});
    dispatchTranscript({ type: "reset" });
  }, [dispatch, dispatchTranscript]);

  const handleDismissError = useCallback(() => {
    dispatchTranscript({ type: "clear_error" });
  }, [dispatchTranscript]);

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

  // Owner-only gate (mirrors backend AssistantChannel#valid_subscription?).
  // Rendered after all hooks so the Rules of Hooks hold. Replaces the whole
  // panel body — no header/input/transcript — and suppresses the
  // subscription_rejected error banner a non-owner's rejected subscribe latches.
  if (accessDenied) {
    return (
      <div
        data-testid="assistant-panel"
        data-device-id={deviceId}
        data-access-denied="true"
        className="bg-surface text-foreground flex h-full w-full flex-col items-center justify-center px-6 text-center outline-none"
      >
        <p className="text-foreground text-body font-medium">
          {t("ownerOnly.title")}
        </p>
        <p className="text-muted-foreground mt-2 text-body">
          {t("ownerOnly.body")}
        </p>
      </div>
    );
  }

  const isEmpty = state.rows.length === 0;

  // "Thinking" indicator: the agent is working but nothing is actively
  // rendering progress yet — i.e. waiting for the first token, or in the gap
  // between a tool result and the next token. Suppressed once an assistant row
  // is streaming its own caret, or a tool row is showing its running badge.
  const lastRow = state.rows[state.rows.length - 1];
  const showThinking =
    state.status === "streaming" &&
    !(lastRow?.kind === "assistant" && lastRow.isStreaming) &&
    !(lastRow?.kind === "tool" && lastRow.state === "running");

  // Map the wire error `source` to localized copy; fall back to the backend
  // message, then a generic string. Known synthetic sources come from
  // useAssistantChannel (connection_lost / stream_out_of_order /
  // subscription_rejected).
  let errorMessage: string | null = null;
  if (state.error) {
    const knownKey: Record<string, string> = {
      connection_lost: "errors.connectionLost",
      stream_out_of_order: "errors.streamOutOfOrder",
      subscription_rejected: "errors.subscriptionRejected",
    };
    const key = knownKey[state.error.source];
    errorMessage = key
      ? t(key)
      : (state.error.message ??
        t("errors.generic", {
          defaultValue: "Something went wrong. Please try again.",
        }));
  }

  return (
    <div
      data-testid="assistant-panel"
      data-device-id={deviceId}
      className="bg-surface text-foreground flex h-full w-full flex-col outline-none"
    >
      <AssistantHeader
        status={state.status}
        stepCount={state.stepCount}
        onCopy={handleCopy}
        onNewChat={handleNewChat}
        isMobile={isMobile}
      />

      {isEmpty ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center px-4 text-center text-body">
          {t("idle.greeting", {
            deviceName,
            defaultValue: `What can I help with on ${deviceName}?`,
          })}
        </div>
      ) : (
        <Transcript
          rows={state.rows}
          onConfirm={handleConfirm}
          showThinking={showThinking}
        />
      )}

      <InputBox
        status={state.status}
        onSubmit={handleSubmit}
        onStop={handleStop}
        isMobile={isMobile}
        keyboardHeightPx={isMobile ? keyboardHeight : 0}
        errorMessage={errorMessage}
        onDismissError={handleDismissError}
      />
    </div>
  );
}

export default AssistantPanel;
