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
  /** When true, mobile adaptations are applied (DCTL-04) */
  isMobile?: boolean;
  /**
   * Called when the full-height state changes — the parent threads this signal
   * to DeviceControlBottomSheet's forceFullHeight prop (DCTL-04 D-10).
   * 37-04 will wire this callback at the DeviceControl.tsx call site.
   */
  onFullHeightChange?: (full: boolean) => void;
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
 *
 * Conversation state lives in DeviceControl's `useReducer` (lifted so it
 * survives pane switches) — nothing in localStorage, nothing persisted in the
 * backend (CHAT-11). Leaving the page / closing the tab clears the panel. The
 * 80% quota Toast also lives in DeviceControl (a panel-local mount ref would
 * re-fire it on every remount).
 */
function AssistantPanel({
  deviceId,
  state,
  dispatchTranscript,
  dispatch,
  deviceName,
  isMobile,
  onFullHeightChange,
}: AssistantPanelProps): JSX.Element {
  const { t } = useTranslation("assistant");
  const toast = useToast();

  // Mobile: track keyboard height to pin InputBox above soft keyboard (DCTL-04 D-10).
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
      className="bg-surface text-foreground flex h-full w-full flex-col outline-none"
    >
      <AssistantHeader
        status={state.status}
        stepCount={state.stepCount}
        onStop={handleStop}
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
        <Transcript rows={state.rows} onConfirm={handleConfirm} />
      )}

      <InputBox
        status={state.status}
        onSubmit={handleSubmit}
        isMobile={isMobile}
        keyboardHeightPx={isMobile ? keyboardHeight : 0}
      />
    </div>
  );
}

export default AssistantPanel;
