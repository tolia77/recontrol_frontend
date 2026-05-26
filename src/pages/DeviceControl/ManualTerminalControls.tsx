import React, {useCallback, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ProcessesModal} from './components/ProcessesModal.tsx';
import { Button, Input } from 'src/components/ui';

export const ManualTerminalControls: React.FC<{
    disabled: boolean;
    addAction?: (action: { id: string; type: string; payload?: Record<string, unknown> }) => void;
    results?: { id: string; status: string; result: string }[];
    processes?: { Pid: number; Name: string; MemoryMB?: number; CpuTime?: string; StartTime?: string }[];
    processesLoading?: boolean;
    requestListProcesses?: () => void;
    killProcess?: (pid: number) => void;
}> = ({
          disabled,
          addAction,
          results = [],
          processes = [],
          processesLoading = false,
          requestListProcesses,
          killProcess
      }) => {
    const {t} = useTranslation('deviceControl');
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

    // Modal state
    const [showProcModal, setShowProcModal] = useState<boolean>(false);

    const send = useCallback((type: string, payload: Record<string, unknown>) => {
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

    // Process management (inline PID kill)
    const killProcessInline = useCallback(() => {
        const pid = parseInt(pidToKill, 10);
        if (isNaN(pid)) return;
        if (killProcess) {
            killProcess(pid);
        } else {
            send('terminal.killProcess', {pid});
        }
    }, [pidToKill, send, killProcess]);

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
        send('terminal.setCwd', {path: newCwd});
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

    // Latest result (show last item)
    const latest = results.length ? results[results.length - 1] : undefined;

    const openProcModal = useCallback(() => {
        setShowProcModal(true);
        if (requestListProcesses) {
            requestListProcesses();
        } else {
            send('terminal.listProcesses', {});
        }
    }, [requestListProcesses, send]);

    const closeProcModal = useCallback(() => setShowProcModal(false), []);

    const refreshProcesses = useCallback(() => {
        if (requestListProcesses) requestListProcesses();
    }, [requestListProcesses]);

    const killAndRemove = useCallback((pid: number) => {
        if (killProcess) killProcess(pid);
        // UI will auto-update when backend confirms; optimistic removal handled by parent too
    }, [killProcess]);

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-text mb-2">{t('manual.terminal.title')}</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {/* Left: All controls */}
                <div className="space-y-6">
                    {/* Command Execution Section */}
                    <div className="border border-lightgray rounded-lg p-4 bg-tertiary">
                        <h4 className="text-sm font-medium text-text mb-3">{t('manual.terminal.commandExec')}</h4>

                        {/* CMD Execute */}
                        <div className="space-y-3 mb-4 pb-4 border-b border-lightgray">
                            <label className="flex flex-col text-sm">
                                <span className="text-darkgray mb-1">{t('manual.terminal.cmdCommand')}</span>
                                <Input
                                    type="text"
                                    className="text-xs px-2 py-1"
                                    value={cmdInput}
                                    onChange={(e) => setCmdInput(e.target.value)}
                                    disabled={disabled}
                                    placeholder="dir C:\\"
                                    onKeyDown={(e) => e.key === 'Enter' && executeCmd()}
                                />
                            </label>
                            <div className="flex items-end gap-3">
                                <label className="flex flex-col text-sm flex-1">
                                    <span className="text-darkgray mb-1">{t('manual.terminal.timeoutMs')}</span>
                                    <Input
                                        type="number"
                                        className="text-xs px-2 py-1"
                                        value={cmdTimeout}
                                        onChange={(e) => setCmdTimeout(Number(e.target.value))}
                                        disabled={disabled}
                                        min={0}
                                    />
                                </label>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    disabled={disabled || !cmdInput.trim()}
                                    onClick={executeCmd}
                                >
                                    {t('manual.terminal.execCmd')}
                                </Button>
                            </div>
                        </div>

                        {/* PowerShell Execute */}
                        <div className="space-y-3">
                            <label className="flex flex-col text-sm">
                                <span className="text-darkgray mb-1">{t('manual.terminal.psCommand')}</span>
                                <Input
                                    type="text"
                                    className="text-xs px-2 py-1"
                                    value={psInput}
                                    onChange={(e) => setPsInput(e.target.value)}
                                    disabled={disabled}
                                    placeholder="Get-Process | Select -First 5"
                                    onKeyDown={(e) => e.key === 'Enter' && executePowerShell()}
                                />
                            </label>
                            <div className="flex items-end gap-3">
                                <label className="flex flex-col text-sm flex-1">
                                    <span className="text-darkgray mb-1">{t('manual.terminal.timeoutMs')}</span>
                                    <Input
                                        type="number"
                                        className="text-xs px-2 py-1"
                                        value={psTimeout}
                                        onChange={(e) => setPsTimeout(Number(e.target.value))}
                                        disabled={disabled}
                                        min={0}
                                    />
                                </label>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    disabled={disabled || !psInput.trim()}
                                    onClick={executePowerShell}
                                >
                                    {t('manual.terminal.execPs')}
                                </Button>
                            </div>
                        </div>

                        <div className="mt-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={disabled}
                                onClick={abortCommand}
                            >
                                {t('manual.terminal.abort')}
                            </Button>
                        </div>
                    </div>

                    {/* Process Management Section */}
                    <div className="border border-lightgray rounded-lg p-4 bg-tertiary">
                        <h4 className="text-sm font-medium text-text mb-3">{t('manual.terminal.processMgmt')}</h4>

                        <div className="space-y-3 mb-4 pb-4 border-b border-lightgray">
                            <Button
                                variant="primary"
                                size="sm"
                                className="w-full"
                                disabled={disabled}
                                onClick={openProcModal}
                            >
                                {t('manual.terminal.listProcesses')}
                            </Button>
                        </div>

                        <div className="space-y-3 mb-4 pb-4 border-b border-lightgray">
                            <label className="flex flex-col text-sm">
                                <span className="text-darkgray mb-1">{t('manual.terminal.killPid')}</span>
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        className="text-xs px-2 py-1 flex-1"
                                        value={pidToKill}
                                        onChange={(e) => setPidToKill(e.target.value)}
                                        disabled={disabled}
                                        placeholder="1234"
                                    />
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        disabled={disabled || !pidToKill.trim()}
                                        onClick={killProcessInline}
                                    >
                                        {t('manual.terminal.kill')}
                                    </Button>
                                </div>
                            </label>
                        </div>

                        <div className="space-y-3">
                            <label className="flex flex-col text-sm">
                                <span className="text-darkgray mb-1">{t('manual.terminal.startProcess')}</span>
                                <Input
                                    type="text"
                                    className="text-xs px-2 py-1"
                                    value={processPath}
                                    onChange={(e) => setProcessPath(e.target.value)}
                                    disabled={disabled}
                                    placeholder={t('manual.terminal.startProcessPlaceholder')}
                                />
                            </label>
                            <label className="flex flex-col text-sm">
                                <span className="text-darkgray mb-1">{t('manual.terminal.argsOptional')}</span>
                                <Input
                                    type="text"
                                    className="text-xs px-2 py-1"
                                    value={processArgs}
                                    onChange={(e) => setProcessArgs(e.target.value)}
                                    disabled={disabled}
                                    placeholder={t('manual.terminal.filePlaceholder')}
                                />
                            </label>
                            <Button
                                variant="primary"
                                size="sm"
                                className="w-full"
                                disabled={disabled || !processPath.trim()}
                                onClick={startProcess}
                            >
                                {t('manual.terminal.startProcess')}
                            </Button>
                        </div>
                    </div>

                    {/* Directory & System Info Section */}
                    <div className="border border-lightgray rounded-lg p-4 bg-tertiary">
                        <h4 className="text-sm font-medium text-text mb-3">{t('manual.terminal.directoryInfo')}</h4>

                        <div className="space-y-3 mb-4 pb-4 border-lightgray">
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="flex-1"
                                    disabled={disabled}
                                    onClick={getCwd}
                                >
                                    {t('manual.terminal.getCwd')}
                                </Button>
                            </div>
                            <label className="flex flex-col text-sm">
                                <span className="text-darkgray mb-1">{t('manual.terminal.setCwdLabel')}</span>
                                <div className="flex gap-2">
                                    <Input
                                        type="text"
                                        className="text-xs px-2 py-1 flex-1"
                                        value={newCwd}
                                        onChange={(e) => setNewCwd(e.target.value)}
                                        disabled={disabled}
                                        placeholder="C:\\Users\\Public"
                                    />
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={disabled || !newCwd.trim()}
                                        onClick={setCwd}
                                    >
                                        {t('manual.terminal.setBtn')}
                                    </Button>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="flex-1"
                                disabled={disabled}
                                onClick={whoAmI}
                            >
                                {t('manual.terminal.whoAmI')}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                className="flex-1"
                                disabled={disabled}
                                onClick={getUptime}
                            >
                                {t('manual.terminal.getUptime')}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right: Output panel */}
                <div className="border border-lightgray rounded-lg p-3 bg-background min-h-[320px]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-darkgray">{t('manual.terminal.output')}</span>
                        {latest && (
                            <span
                                className={`text-xs px-2 py-0.5 rounded ${latest.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {latest.status}
                            </span>
                        )}
                    </div>
                    <pre
                        className="text-xs leading-5 whitespace-pre-wrap break-words max-h-[520px] h-[520px] overflow-auto bg-tertiary p-2 rounded">
{latest ? latest.result : t('manual.terminal.outputEmpty')}
                    </pre>
                </div>
            </div>

            {/* Processes Modal */}
            <ProcessesModal
                open={showProcModal}
                onClose={closeProcModal}
                processes={processes || []}
                loading={!!processesLoading}
                onRefresh={refreshProcesses}
                onKill={killAndRemove}
            />
        </div>
    );
};
