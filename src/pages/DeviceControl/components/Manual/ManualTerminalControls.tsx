import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import ProcessesModal from "src/pages/DeviceControl/components/Terminal/ProcessesModal";
import { Button, Input } from "src/components/ui";

type Shell = "cmd" | "powershell";

const ManualTerminalControls: React.FC<{
  disabled: boolean;
  addAction?: (action: {
    id: string;
    type: string;
    payload?: Record<string, unknown>;
  }) => void;
  results?: { id: string; status: string; result: string }[];
  processes?: {
    Pid: number;
    Name: string;
    MemoryMB?: number;
    CpuTime?: string;
    StartTime?: string;
  }[];
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
  killProcess,
}) => {
  const { t } = useTranslation("deviceControl");
  // Command execution state — one input/timeout shared across shells; a toggle
  // picks which backend command (terminal.execute vs terminal.powershell) runs.
  const [shell, setShell] = useState<Shell>("cmd");
  const [cmdInput, setCmdInput] = useState<string>("");
  const [cmdTimeout, setCmdTimeout] = useState<number>(5000);

  // Process management state
  const [pidToKill, setPidToKill] = useState<string>("");
  const [processPath, setProcessPath] = useState<string>("");
  const [processArgs, setProcessArgs] = useState<string>("");

  // Directory state
  const [newCwd, setNewCwd] = useState<string>("");

  // Modal state
  const [showProcModal, setShowProcModal] = useState<boolean>(false);

  const send = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      if (!addAction || disabled) return;
      addAction({
        id: crypto.randomUUID(),
        type,
        payload,
      });
    },
    [addAction, disabled],
  );

  // Command execution — dispatches to the selected shell.
  const executeCommand = useCallback(() => {
    if (!cmdInput.trim()) return;
    send(shell === "cmd" ? "terminal.execute" : "terminal.powershell", {
      command: cmdInput,
      timeout: cmdTimeout,
    });
  }, [shell, cmdInput, cmdTimeout, send]);

  // Process management (inline PID kill)
  const killProcessInline = useCallback(() => {
    const pid = parseInt(pidToKill, 10);
    if (isNaN(pid)) return;
    if (killProcess) {
      killProcess(pid);
    } else {
      send("terminal.killProcess", { pid });
    }
  }, [pidToKill, send, killProcess]);

  const startProcess = useCallback(() => {
    if (!processPath.trim()) return;
    send("terminal.startProcess", {
      path: processPath,
      arguments: processArgs || undefined,
    });
  }, [processPath, processArgs, send]);

  // Directory management
  const getCwd = useCallback(() => {
    send("terminal.getCwd", {});
  }, [send]);

  const setCwd = useCallback(() => {
    if (!newCwd.trim()) return;
    send("terminal.setCwd", { path: newCwd });
  }, [newCwd, send]);

  // System info
  const whoAmI = useCallback(() => {
    send("terminal.whoAmI", {});
  }, [send]);

  const getUptime = useCallback(() => {
    send("terminal.getUptime", {});
  }, [send]);

  // Abort
  const abortCommand = useCallback(() => {
    send("terminal.abort", {});
  }, [send]);

  // Latest result (show last item)
  const latest = results.length ? results[results.length - 1] : undefined;

  const openProcModal = useCallback(() => {
    setShowProcModal(true);
    if (requestListProcesses) {
      requestListProcesses();
    } else {
      send("terminal.listProcesses", {});
    }
  }, [requestListProcesses, send]);

  const closeProcModal = useCallback(() => setShowProcModal(false), []);

  const refreshProcesses = useCallback(() => {
    if (requestListProcesses) requestListProcesses();
  }, [requestListProcesses]);

  const killAndRemove = useCallback(
    (pid: number) => {
      if (killProcess) killProcess(pid);
      // UI will auto-update when backend confirms; optimistic removal handled by parent too
    },
    [killProcess],
  );

  return (
    <div className="space-y-4">
      <h3 className="text-foreground text-heading font-semibold">
        {t("manual.terminal.title")}
      </h3>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Left: controls — scrolls independently; output stays pinned right */}
        <div className="space-y-6 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-2">
          {/* Command Execution Section */}
          <section className="space-y-3">
            <h4 className="text-foreground text-body font-medium">
              {t("manual.terminal.commandExec")}
            </h4>

            {/* Shell selector */}
            <div className="bg-surface-muted inline-flex rounded-md p-0.5">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setShell("cmd")}
                className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-50 ${
                  shell === "cmd"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("manual.terminal.shellCmd")}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setShell("powershell")}
                className={`rounded-sm px-3 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-50 ${
                  shell === "powershell"
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("manual.terminal.shellPowershell")}
              </button>
            </div>

            <label className="flex flex-col text-body">
              <span className="text-muted-foreground mb-1">
                {t("manual.terminal.commandLabel")}
              </span>
              <Input
                type="text"
                className="px-2 py-1 text-xs"
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                disabled={disabled}
                placeholder={
                  shell === "cmd" ? "dir C:\\" : "Get-Process | Select -First 5"
                }
                onKeyDown={(e) => e.key === "Enter" && executeCommand()}
              />
            </label>

            <div className="flex items-end gap-3">
              <label className="flex flex-1 flex-col text-body">
                <span className="text-muted-foreground mb-1">
                  {t("manual.terminal.timeoutMs")}
                </span>
                <Input
                  type="number"
                  className="px-2 py-1 text-xs"
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
                onClick={executeCommand}
              >
                {t("manual.terminal.execute")}
              </Button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={abortCommand}
            >
              {t("manual.terminal.abort")}
            </Button>
          </section>

          {/* Process Management Section */}
          <section className="space-y-4">
            <h4 className="text-foreground text-body font-medium">
              {t("manual.terminal.processMgmt")}
            </h4>

            <Button
              variant="primary"
              size="sm"
              className="w-full"
              disabled={disabled}
              onClick={openProcModal}
            >
              {t("manual.terminal.listProcesses")}
            </Button>

            <label className="flex flex-col text-body">
              <span className="text-muted-foreground mb-1">
                {t("manual.terminal.killPid")}
              </span>
              <div className="flex gap-2">
                <Input
                  type="text"
                  className="flex-1 px-2 py-1 text-xs"
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
                  {t("manual.terminal.kill")}
                </Button>
              </div>
            </label>

            <label className="flex flex-col text-body">
              <span className="text-muted-foreground mb-1">
                {t("manual.terminal.startProcess")}
              </span>
              <Input
                type="text"
                className="px-2 py-1 text-xs"
                value={processPath}
                onChange={(e) => setProcessPath(e.target.value)}
                disabled={disabled}
                placeholder={t("manual.terminal.startProcessPlaceholder")}
              />
            </label>
            <label className="flex flex-col text-body">
              <span className="text-muted-foreground mb-1">
                {t("manual.terminal.argsOptional")}
              </span>
              <Input
                type="text"
                className="px-2 py-1 text-xs"
                value={processArgs}
                onChange={(e) => setProcessArgs(e.target.value)}
                disabled={disabled}
                placeholder={t("manual.terminal.filePlaceholder")}
              />
            </label>
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              disabled={disabled || !processPath.trim()}
              onClick={startProcess}
            >
              {t("manual.terminal.startProcess")}
            </Button>
          </section>

          {/* Directory & System Info Section */}
          <section className="space-y-4">
            <h4 className="text-foreground text-body font-medium">
              {t("manual.terminal.directoryInfo")}
            </h4>

            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              disabled={disabled}
              onClick={getCwd}
            >
              {t("manual.terminal.getCwd")}
            </Button>

            <label className="flex flex-col text-body">
              <span className="text-muted-foreground mb-1">
                {t("manual.terminal.setCwdLabel")}
              </span>
              <div className="flex gap-2">
                <Input
                  type="text"
                  className="flex-1 px-2 py-1 text-xs"
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
                  {t("manual.terminal.setBtn")}
                </Button>
              </div>
            </label>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={disabled}
                onClick={whoAmI}
              >
                {t("manual.terminal.whoAmI")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={disabled}
                onClick={getUptime}
              >
                {t("manual.terminal.getUptime")}
              </Button>
            </div>
          </section>
        </div>

        {/* Right: output panel — sticky so it stays put while controls scroll */}
        <div className="border-border bg-surface rounded-md border p-3 lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-body">
              {t("manual.terminal.output")}
            </span>
            {latest && (
              <span
                className={`rounded-sm px-2 py-0.5 text-caption ${latest.status === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
              >
                {latest.status}
              </span>
            )}
          </div>
          <pre className="bg-surface-muted h-[70vh] max-h-[560px] min-h-[320px] overflow-auto rounded-sm p-2 text-caption leading-5 break-words whitespace-pre-wrap">
            {latest ? latest.result : t("manual.terminal.outputEmpty")}
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

export default ManualTerminalControls;
