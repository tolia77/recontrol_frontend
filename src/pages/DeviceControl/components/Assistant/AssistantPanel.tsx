import { useCallback, useReducer } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssistantChannel } from '../../hooks/useAssistantChannel';
import type { AssistantBroadcast } from '../../hooks/useAssistantChannel';
import {
  initialTranscriptState,
  transcriptReducer,
} from './transcriptReducer';
import { Transcript } from './Transcript';

export interface AssistantPanelProps {
  deviceId: string;
  ws: WebSocket | null;
  deviceName: string;
}

/**
 * Top-level assistant panel.
 *
 * Plan 20-07 wires the transcript reducer + Transcript / OperatorBubble /
 * AssistantMessage. Plan 20-08 wires ToolCallCard / ConfirmationCard via
 * Transcript's RowRenderer and threads the `confirm_tool_call` dispatch
 * pathway from `useAssistantChannel` through Transcript → ConfirmationCard.
 * The header (Stop / step counter / Copy-as-Markdown) and InputBox land in
 * Plan 20-09.
 *
 * Conversation state is local React state (`useReducer`); nothing in
 * localStorage; nothing in the backend (CHAT-11).
 *
 * Confirmation dispatch (20-08):
 *   - `dispatch` is sourced from `useAssistantChannel` at render time
 *     (RESEARCH §Pitfall 8 — never cache callable in reducer state).
 *   - `handleConfirm` sends `confirm_tool_call` with `{confirmation_id,
 *     decision}` over the AssistantChannel; backend expects `confirmation_id`
 *     (verified in `recontrol_backend/app/channels/assistant_channel.rb:63-72`).
 */
export function AssistantPanel({ deviceId, ws, deviceName }: AssistantPanelProps): JSX.Element {
  const { t } = useTranslation('assistant');
  const [state, dispatchTranscript] = useReducer(transcriptReducer, initialTranscriptState);

  const onBroadcast = useCallback((msg: AssistantBroadcast): void => {
    dispatchTranscript({ type: 'broadcast', broadcast: msg });
  }, []);

  const { dispatch } = useAssistantChannel(ws, onBroadcast);

  const handleConfirm = useCallback(
    (confirmationId: string, decision: 'allow' | 'deny') => {
      dispatch('confirm_tool_call', {
        confirmation_id: confirmationId,
        decision,
      });
    },
    [dispatch],
  );

  const isEmpty = state.rows.length === 0;

  return (
    <div
      data-testid="assistant-panel"
      className="outline-none flex h-full w-full bg-background text-text flex-col"
    >
      {/* Plan 20-09 inserts <AssistantHeader> above the transcript. */}
      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center text-darkgray text-sm px-4 text-center">
          {t('idle.greeting', {
            deviceName,
            defaultValue: `What can I help with on ${deviceName}?`,
          })}
        </div>
      ) : (
        <Transcript rows={state.rows} onConfirm={handleConfirm} />
      )}

      {/* Debug strip — replaced by the real InputBox in Plan 20-09. Exposes
          status / stepCount so mid-build smoke testing does not require
          opening React DevTools. */}
      <div className="border-t border-gray-200 p-3 text-xs text-darkgray">
        deviceId: <span className="font-mono">{deviceId}</span>
        {' · '}
        status: <span className="font-mono">{state.status}</span>
        {state.stepCount > 0 && (
          <>
            {' · '}
            step: <span className="font-mono">{state.stepCount} / 25</span>
          </>
        )}
      </div>
    </div>
  );
}
