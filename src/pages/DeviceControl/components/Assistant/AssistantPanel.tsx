import { useCallback } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssistantChannel } from '../../hooks/useAssistantChannel';
import type { AssistantBroadcast } from '../../hooks/useAssistantChannel';

export interface AssistantPanelProps {
  deviceId: string;
  ws: WebSocket | null;
  deviceName: string;
}

/**
 * Top-level assistant panel.
 *
 * This is the SCAFFOLD shipped in Plan 20-06. Subsequent plans fill the body:
 *   - 20-07: transcript reducer + Transcript + AssistantMessage (streamdown).
 *   - 20-08: ToolCallCard + ConfirmationCard.
 *   - 20-09: AssistantHeader (step counter / Stop / Copy) + InputBox + quota UX.
 *
 * The scaffold mounts useAssistantChannel so the WebSocket subscription
 * lifecycle is in place; broadcasts are currently logged to the console only.
 * The transcript reducer in 20-07 replaces the placeholder onBroadcast handler.
 */
export function AssistantPanel({ deviceId, ws, deviceName }: AssistantPanelProps): JSX.Element {
  const { t } = useTranslation('assistant');

  const onBroadcast = useCallback((msg: AssistantBroadcast): void => {
    // Scaffold-only handler — replaced by transcript reducer in 20-07.
    console.debug('[AssistantPanel scaffold] broadcast', msg);
  }, []);

  useAssistantChannel(ws, onBroadcast);

  return (
    <div
      data-testid="assistant-panel"
      className="outline-none flex h-full w-full bg-background text-text flex-col"
    >
      <div className="flex-1 flex items-center justify-center text-darkgray text-sm px-4 text-center">
        {/* Plan 20-09 replaces this with the real idle / streaming / halted body. */}
        {t('idle.greeting', {
          deviceName,
          defaultValue: `What can I help with on ${deviceName}?`,
        })}
      </div>
      <div className="border-t border-gray-200 p-3 text-xs text-darkgray">
        {/* Scaffold marker — Plan 20-09 replaces with the real InputBox. */}
        deviceId: <span className="font-mono">{deviceId}</span>
      </div>
    </div>
  );
}
