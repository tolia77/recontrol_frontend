import React, { useState } from 'react';
import { ManualMouseControls } from './ManualMouseControls.tsx';
import { ManualKeyboardControls } from './ManualKeyboardControls.tsx';
import { ManualPowerControls } from './ManualPowerControls.tsx';
import { ManualTerminalControls } from './ManualTerminalControls.tsx';
import { useTranslation } from 'react-i18next';
import type { PermissionsSubset, CommandAction } from './types.ts';

type ManualSection = 'mouse' | 'keyboard' | 'power' | 'terminal';

export const ManualControls: React.FC<{
    disabled: boolean;
    addAction?: (action: CommandAction) => void;
    results?: { id: string; status: string; result: string }[];
    processes?: { Pid: number; Name: string; MemoryMB?: number; CpuTime?: string; StartTime?: string }[];
    processesLoading?: boolean;
    requestListProcesses?: () => void;
    killProcess?: (pid: number) => void;
    permissions?: PermissionsSubset;
}> = ({ disabled, addAction, results, processes, processesLoading, requestListProcesses, killProcess, permissions }) => {
    const { t } = useTranslation('deviceControl');
    const [activeSection, setActiveSection] = useState<ManualSection>('mouse');

    const canMouse = !!permissions?.access_mouse;
    const canKeyboard = !!permissions?.access_keyboard;
    const canPower = !!permissions?.manage_power;
    const canTerminal = !!permissions?.access_terminal;

    const SectionNotice: React.FC<{ allowed: boolean }> = ({ allowed }) => (
        !allowed ? (
            <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                {t('manual.noPermission')}
            </div>
        ) : null
    );

    return (
        <div className="flex-1 bg-[#F3F4F6] p-8 flex flex-col items-center">
            <div className="w-4xl bg-white rounded-lg border border-gray-200 shadow-sm">
                {/* Section Tabs */}
                <div className="border-b border-gray-200">
                    <div className="flex">
                        <button
                            onClick={() => setActiveSection('mouse')}
                            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors duration-200 ${
                                activeSection === 'mouse'
                                    ? 'text-[#1E3A8A] border-b-2 border-[#1E3A8A] bg-[#D7E6FF]/30'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            {t('manual.tabs.mouse')}
                        </button>
                        <button
                            onClick={() => setActiveSection('keyboard')}
                            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors duration-200 ${
                                activeSection === 'keyboard'
                                    ? 'text-[#1E3A8A] border-b-2 border-[#1E3A8A] bg-[#D7E6FF]/30'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            {t('manual.tabs.keyboard')}
                        </button>
                        <button
                            onClick={() => setActiveSection('power')}
                            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors duration-200 ${
                                activeSection === 'power'
                                    ? 'text-[#1E3A8A] border-b-2 border-[#1E3A8A] bg-[#D7E6FF]/30'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            {t('manual.tabs.power')}
                        </button>
                        <button
                            onClick={() => setActiveSection('terminal')}
                            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors duration-200 ${
                                activeSection === 'terminal'
                                    ? 'text-[#1E3A8A] border-b-2 border-[#1E3A8A] bg-[#D7E6FF]/30'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                            }`}
                        >
                            {t('manual.tabs.terminal')}
                        </button>
                    </div>
                </div>

                {/* Section Content */}
                <div className="p-6">
                    {activeSection === 'mouse' && (
                        <>
                            <SectionNotice allowed={canMouse} />
                            <ManualMouseControls disabled={disabled || !canMouse} addAction={addAction} />
                        </>
                    )}
                    {activeSection === 'keyboard' && (
                        <>
                            <SectionNotice allowed={canKeyboard} />
                            <ManualKeyboardControls disabled={disabled || !canKeyboard} addAction={addAction} />
                        </>
                    )}
                    {activeSection === 'power' && (
                        <>
                            <SectionNotice allowed={canPower} />
                            <ManualPowerControls disabled={disabled || !canPower} addAction={addAction} />
                        </>
                    )}
                    {activeSection === 'terminal' && (
                        <>
                            <SectionNotice allowed={canTerminal} />
                            <ManualTerminalControls disabled={disabled || !canTerminal} addAction={addAction} results={results} processes={processes} processesLoading={processesLoading} requestListProcesses={requestListProcesses} killProcess={killProcess} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
