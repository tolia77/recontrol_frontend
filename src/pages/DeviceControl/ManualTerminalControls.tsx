import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const ManualTerminalControls: React.FC<{
    disabled: boolean;
    addAction?: (action: any) => void;
}> = ({ disabled, addAction }) => {
    const { t } = useTranslation('deviceControl');
    // Command execution state
    const [cmdInput, setCmdInput] = useState<string>('');
    const [cmdTimeout, setCmdTimeout] = useState<number>(5000);
    const [psInput, setPsInput] = useState<string>('');
    const [psTimeout, setPsTimeout] = useState<number>(5000);

    // Process management state
    const [pidToKill, setPidToKill] = useState<string>('');
    const [processPath, setProcessPath] = useState<string>('');
    const [processArgs, setProcessArgs] = useState<string>('');

    // Directory state
    const [newCwd, setNewCwd] = useState<string>('');

    const send = useCallback((type: string, payload: Record<string, any>) => {
        if (!addAction || disabled) return;
        addAction({
            id: crypto.randomUUID(),
            type,
            payload,
        });
    }, [addAction, disabled]);

    // Command execution
    const executeCmd = useCallback(() => {
        if (!cmdInput.trim()) return;
        send('terminal.execute', {
            command: cmdInput,
            timeout: cmdTimeout,
        });
    }, [cmdInput, cmdTimeout, send]);

    const executePowerShell = useCallback(() => {
        if (!psInput.trim()) return;
        send('terminal.powershell', {
            command: psInput,
            timeout: psTimeout,
        });
    }, [psInput, psTimeout, send]);

    // Process management
    const listProcesses = useCallback(() => {
        send('terminal.listProcesses', {});
    }, [send]);

    const killProcess = useCallback(() => {
        const pid = parseInt(pidToKill, 10);
        if (isNaN(pid)) return;
        send('terminal.killProcess', { pid });
    }, [pidToKill, send]);

    const startProcess = useCallback(() => {
        if (!processPath.trim()) return;
        send('terminal.startProcess', {
            path: processPath,
            arguments: processArgs || undefined,
        });
    }, [processPath, processArgs, send]);

    // Directory management
    const getCwd = useCallback(() => {
        send('terminal.getCwd', {});
    }, [send]);

    const setCwd = useCallback(() => {
        if (!newCwd.trim()) return;
        send('terminal.setCwd', { path: newCwd });
    }, [newCwd, send]);

    // System info
    const whoAmI = useCallback(() => {
        send('terminal.whoAmI', {});
    }, [send]);

    const getUptime = useCallback(() => {
        send('terminal.getUptime', {});
    }, [send]);

    // Abort
    const abortCommand = useCallback(() => {
        send('terminal.abort', {});
    }, [send]);

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('manual.terminal.title')}</h3>

            {/* Command Execution Section */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-3">{t('manual.terminal.commandExec')}</h4>

                {/* CMD Execute */}
                <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                    <label className="flex flex-col text-sm">
                        <span className="text-gray-600 mb-1">{t('manual.terminal.cmdCommand')}</span>
                        <input
                            type="text"
                            className="small-input"
                            value={cmdInput}
                            onChange={(e) => setCmdInput(e.target.value)}
                            disabled={disabled}
                            placeholder="dir C:\\\\"
                            onKeyDown={(e) => e.key === 'Enter' && executeCmd()}
                        />
                    </label>
                    <div className="flex items-end gap-3">
                        <label className="flex flex-col text-sm flex-1">
                            <span className="text-gray-600 mb-1">{t('manual.terminal.timeoutMs')}</span>
                            <input
                                type="number"
                                className="small-input"
                                value={cmdTimeout}
                                onChange={(e) => setCmdTimeout(Number(e.target.value))}
                                disabled={disabled}
                                min={0}
                            />
                        </label>
                        <button
                            className="btn-primary"
                            disabled={disabled || !cmdInput.trim()}
                            onClick={executeCmd}
                        >
                            {t('manual.terminal.execCmd')}
                        </button>
                    </div>
                </div>

                {/* PowerShell Execute */}
                <div className="space-y-3">
                    <label className="flex flex-col text-sm">
                        <span className="text-gray-600 mb-1">{t('manual.terminal.psCommand')}</span>
                        <input
                            type="text"
                            className="small-input"
                            value={psInput}
                            onChange={(e) => setPsInput(e.target.value)}
                            disabled={disabled}
                            placeholder="Get-Process | Select -First 5"
                            onKeyDown={(e) => e.key === 'Enter' && executePowerShell()}
                        />
                    </label>
                    <div className="flex items-end gap-3">
                        <label className="flex flex-col text-sm flex-1">
                            <span className="text-gray-600 mb-1">{t('manual.terminal.timeoutMs')}</span>
                            <input
                                type="number"
                                className="small-input"
                                value={psTimeout}
                                onChange={(e) => setPsTimeout(Number(e.target.value))}
                                disabled={disabled}
                                min={0}
                            />
                        </label>
                        <button
                            className="btn-primary"
                            disabled={disabled || !psInput.trim()}
                            onClick={executePowerShell}
                        >
                            {t('manual.terminal.execPs')}
                        </button>
                    </div>
                </div>

                <div className="mt-3">
                    <button
                        className="btn-secondary"
                        disabled={disabled}
                        onClick={abortCommand}
                    >
                        {t('manual.terminal.abort')}
                    </button>
                </div>
            </div>

            {/* Process Management Section */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-3">{t('manual.terminal.processMgmt')}</h4>

                <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                    <button
                        className="btn-primary w-full"
                        disabled={disabled}
                        onClick={listProcesses}
                    >
                        {t('manual.terminal.listProcesses')}
                    </button>
                </div>

                <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                    <label className="flex flex-col text-sm">
                        <span className="text-gray-600 mb-1">{t('manual.terminal.killPid')}</span>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="small-input flex-1"
                                value={pidToKill}
                                onChange={(e) => setPidToKill(e.target.value)}
                                disabled={disabled}
                                placeholder="1234"
                            />
                            <button
                                className="btn-secondary"
                                disabled={disabled || !pidToKill.trim()}
                                onClick={killProcess}
                            >
                                {t('manual.terminal.kill')}
                            </button>
                        </div>
                    </label>
                </div>

                <div className="space-y-3">
                    <label className="flex flex-col text-sm">
                        <span className="text-gray-600 mb-1">{t('manual.terminal.startProcess')}</span>
                        <input
                            type="text"
                            className="small-input"
                            value={processPath}
                            onChange={(e) => setProcessPath(e.target.value)}
                            disabled={disabled}
                            placeholder={t('manual.terminal.startProcessPlaceholder')}
                        />
                    </label>
                    <label className="flex flex-col text-sm">
                        <span className="text-gray-600 mb-1">{t('manual.terminal.argsOptional')}</span>
                        <input
                            type="text"
                            className="small-input"
                            value={processArgs}
                            onChange={(e) => setProcessArgs(e.target.value)}
                            disabled={disabled}
                            placeholder={t('manual.terminal.filePlaceholder')}
                        />
                    </label>
                    <button
                        className="btn-primary w-full"
                        disabled={disabled || !processPath.trim()}
                        onClick={startProcess}
                    >
                        {t('manual.terminal.startProcess')}
                    </button>
                </div>
            </div>

            {/* Directory & System Info Section */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-3">{t('manual.terminal.directoryInfo')}</h4>

                <div className="space-y-3 mb-4 pb-4 border-gray-200">
                    <div className="flex gap-2">
                        <button
                            className="btn-secondary flex-1"
                            disabled={disabled}
                            onClick={getCwd}
                        >
                            {t('manual.terminal.getCwd')}
                        </button>
                    </div>
                    <label className="flex flex-col text-sm">
                        <span className="text-gray-600 mb-1">{t('manual.terminal.setCwdLabel')}</span>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="small-input flex-1"
                                value={newCwd}
                                onChange={(e) => setNewCwd(e.target.value)}
                                disabled={disabled}
                                placeholder="C:\\Users\\Public"
                            />
                            <button
                                className="btn-secondary"
                                disabled={disabled || !newCwd.trim()}
                                onClick={setCwd}
                            >
                                {t('manual.terminal.setBtn')}
                            </button>
                        </div>
                    </label>
                </div>

                <div className="flex gap-2">
                    <button
                        className="btn-secondary flex-1"
                        disabled={disabled}
                        onClick={whoAmI}
                    >
                        {t('manual.terminal.whoAmI')}
                    </button>
                    <button
                        className="btn-secondary flex-1"
                        disabled={disabled}
                        onClick={getUptime}
                    >
                        {t('manual.terminal.getUptime')}
                    </button>
                </div>
            </div>
        </div>
    );
};
