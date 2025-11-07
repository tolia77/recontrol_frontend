import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type PowerCommand =
    | 'power.shutdown'
    | 'power.restart'
    | 'power.sleep'
    | 'power.hibernate'
    | 'power.logOff'
    | 'power.lock';

export const ManualPowerControls: React.FC<{
    disabled: boolean;
    addAction?: (action: any) => void;
}> = ({ disabled, addAction }) => {
    const { t } = useTranslation('deviceControl');

    const POWER_COMMANDS: { command: PowerCommand; label: string; description: string; variant: 'danger' | 'warning' | 'info' }[] = [
        { command: 'power.shutdown', label: t('manual.power.shutdown'), description: t('manual.power.shutdownDesc'), variant: 'danger' },
        { command: 'power.restart', label: t('manual.power.restart'), description: t('manual.power.restartDesc'), variant: 'warning' },
        { command: 'power.sleep', label: t('manual.power.sleep'), description: t('manual.power.sleepDesc'), variant: 'info' },
        { command: 'power.hibernate', label: t('manual.power.hibernate'), description: t('manual.power.hibernateDesc'), variant: 'info' },
        { command: 'power.logOff', label: t('manual.power.logOff'), description: t('manual.power.logOffDesc'), variant: 'warning' },
        { command: 'power.lock', label: t('manual.power.lock'), description: t('manual.power.lockDesc'), variant: 'info' },
    ];

    const sendPowerCommand = useCallback((command: PowerCommand) => {
        if (!addAction || disabled) return;
        addAction({
            id: crypto.randomUUID(),
            type: command,
            payload: {},
        });
    }, [addAction, disabled]);

    const getButtonClass = (variant: 'danger' | 'warning' | 'info') => {
        const base = 'w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
        switch (variant) {
            case 'danger':
                return `${base} bg-red-500 hover:bg-red-600 text-white shadow-sm hover:shadow-md`;
            case 'warning':
                return `${base} bg-amber-500 hover:bg-amber-600 text-white shadow-sm hover:shadow-md`;
            case 'info':
                return `${base} bg-blue-500 hover:bg-blue-600 text-white shadow-sm hover:shadow-md`;
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('manual.power.title')}</h3>

            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <p className="text-sm text-gray-600 mb-4">
                    ⚠️ {t('manual.power.warning')}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {POWER_COMMANDS.map(({ command, label, description, variant }) => (
                        <div key={command} className="flex flex-col">
                            <button
                                className={getButtonClass(variant)}
                                disabled={disabled}
                                onClick={() => sendPowerCommand(command)}
                            >
                                {label}
                            </button>
                            <span className="text-xs text-gray-500 mt-1 text-center">{description}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
