import React, { useState } from 'react';
import { ManualMouseControls } from './ManualMouseControls.tsx';
import { ManualKeyboardControls } from './ManualKeyboardControls.tsx';
import { ManualPowerControls } from './ManualPowerControls.tsx';
import { ManualTerminalControls } from './ManualTerminalControls.tsx';
import { useTranslation } from 'react-i18next';

type ManualSection = 'mouse' | 'keyboard' | 'power' | 'terminal';

export const ManualControls: React.FC<{
    disabled: boolean;
    addAction?: (action: any) => void;
    results?: { id: string; status: string; result: string }[];
    processes?: { Pid: number; Name: string; MemoryMB?: number; CpuTime?: string; StartTime?: string }[];
    processesLoading?: boolean;
    requestListProcesses?: () => void;
    killProcess?: (pid: number) => void;
}> = ({ disabled, addAction, results, processes, processesLoading, requestListProcesses, killProcess }) => {
    const { t } = useTranslation('deviceControl');
    const [activeSection, setActiveSection] = useState<ManualSection>('mouse');

    return (
        <div className="flex-1 bg-[#F3F4F6] p-8 flex flex-col items-center">
            <div className="w-full max-w-2xl bg-white rounded-lg border border-gray-200 shadow-sm">
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
                        <ManualMouseControls disabled={disabled} addAction={addAction} />
                    )}
                    {activeSection === 'keyboard' && (
                        <ManualKeyboardControls disabled={disabled} addAction={addAction} />
                    )}
                    {activeSection === 'power' && (
                        <ManualPowerControls disabled={disabled} addAction={addAction} />
                    )}
                    {activeSection === 'terminal' && (
                        <ManualTerminalControls disabled={disabled} addAction={addAction} results={results} processes={processes} processesLoading={processesLoading} requestListProcesses={requestListProcesses} killProcess={killProcess} />
                    )}
                </div>
            </div>
        </div>
    );
};
