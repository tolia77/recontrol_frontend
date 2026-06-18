import { useCallback, useMemo, useState } from "react";

export interface TerminalEntry {
  id: string;
  status: string;
  result: string;
}

export interface ProcessInfo {
  Pid: number;
  Name: string;
  MemoryMB?: number;
  CpuTime?: string;
  StartTime?: string;
}

export interface UseTerminalSessionReturn {
  terminalResults: TerminalEntry[];
  processes: ProcessInfo[];
  processesLoading: boolean;
  /** Append one entry to terminalResults; preserves the last-100 cap (slice(-100)). */
  appendTerminalResult: (entry: TerminalEntry) => void;
  /**
   * Append a streamed terminal-output chunk. Consecutive chunks from the same
   * session merge into a single growing entry so the output panel shows the full
   * transcript instead of only the last fragment (the shell stream arrives as
   * many small reads, e.g. PowerShell's prompt redraws).
   */
  appendStreamChunk: (sessionId: string, stream: string, chunk: string) => void;
  setProcesses: React.Dispatch<React.SetStateAction<ProcessInfo[]>>;
  setProcessesLoading: (v: boolean) => void;
}

/**
 * Owns the terminal output and process list state slices for DeviceControl.
 *
 * State-only: the action functions (requestListProcesses, killProcess) live in
 * DeviceControl where they compose canSend + sendSingleAction. This hook just
 * exposes the setters for the dispatcher callback wiring.
 */
export function useTerminalSession(): UseTerminalSessionReturn {
  const [terminalResults, setTerminalResults] = useState<TerminalEntry[]>([]);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [processesLoading, setProcessesLoading] = useState(false);

  const appendTerminalResult = useCallback((entry: TerminalEntry) => {
    setTerminalResults((prev) => {
      const next = [...prev, entry];
      return next.slice(-100); // keep last 100 entries
    });
  }, []);

  const appendStreamChunk = useCallback(
    (sessionId: string, stream: string, chunk: string) => {
      setTerminalResults((prev) => {
        const last = prev[prev.length - 1];
        // Merge into the running transcript when the last entry is the same
        // streaming session; otherwise start a fresh entry (e.g. a new command,
        // or a command-result entry was pushed in between).
        if (last && last.id === sessionId) {
          const merged: TerminalEntry = {
            id: sessionId,
            status: stream,
            result: last.result + chunk,
          };
          return [...prev.slice(0, -1), merged];
        }
        const next = [...prev, { id: sessionId, status: stream, result: chunk }];
        return next.slice(-100); // keep last 100 entries
      });
    },
    [],
  );

  return useMemo(
    () => ({
      terminalResults,
      processes,
      processesLoading,
      appendTerminalResult,
      appendStreamChunk,
      setProcesses,
      setProcessesLoading,
    }),
    [
      terminalResults,
      processes,
      processesLoading,
      appendTerminalResult,
      appendStreamChunk,
    ],
  );
}
