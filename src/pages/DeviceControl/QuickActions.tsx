import React from 'react';
import { useTranslation } from 'react-i18next';

interface QuickActionsProps {
  disabled: boolean;
  addAction: (action: { id: string; type: string; payload: Record<string, unknown> }) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ disabled, addAction }) => {
  const { t } = useTranslation('deviceControl');
  return (
    <div className="quick-actions mt-6">
      <div className="action-buttons flex gap-4">
        <button
          className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium shadow hover:bg-[#1E3A8A] disabled:bg-[#D1D5DB] disabled:text-[#8F8F8F] disabled:cursor-not-allowed transition-colors"
          onClick={() =>
            addAction({
              id: crypto.randomUUID(),
              type: 'screen.start',
              payload: {},
            })
          }
          disabled={disabled}
        >
          {t('manual.quick.startStream')}
        </button>
        <button
          className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg font-medium shadow hover:bg-[#1E3A8A] disabled:bg-[#D1D5DB] disabled:text-[#8F8F8F] disabled:cursor-not-allowed transition-colors"
          onClick={() =>
            addAction({
              id: crypto.randomUUID(),
              type: 'screen.stop',
              payload: {},
            })
          }
          disabled={disabled}
        >
          {t('manual.quick.stopStream')}
        </button>
      </div>
    </div>
  );
};
