import { useTranslation } from 'react-i18next';
import { generateUUID } from 'src/utils/uuid';
import { Button } from 'src/components/ui/Button';

interface QuickActionsProps {
  disabled: boolean;
  addAction: (action: { id: string; type: string; payload: Record<string, unknown> }) => void;
}

export function QuickActions({ disabled, addAction }: QuickActionsProps) {
  const { t } = useTranslation('deviceControl');

  return (
    <div className="quick-actions mt-6">
      <div className="action-buttons flex gap-4">
        <Button
          onClick={() =>
            addAction({
              id: generateUUID(),
              type: 'screen.start',
              payload: {},
            })
          }
          disabled={disabled}
        >
          {t('manual.quick.startStream')}
        </Button>
        <Button
          onClick={() =>
            addAction({
              id: generateUUID(),
              type: 'screen.stop',
              payload: {},
            })
          }
          disabled={disabled}
        >
          {t('manual.quick.stopStream')}
        </Button>
      </div>
    </div>
  );
}
