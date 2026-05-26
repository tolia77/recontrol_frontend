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
  setProcesses: React.Dispatch<React.SetStateAction<ProcessInfo[]>>;
  setProcessesLoading: (v: boolean) => void;
}

/**
 * Owns the terminal output and process list state slices for DeviceControl.
 *
 * Per D-01: feature sub-hook extracted from DeviceControl's inline state.
 * Per D-02: plain useState (transitions are independent, no interrelation).
 * Per OQ-2 Option A: action functions (requestListProcesses, killProcess) stay
 * in DeviceControl where they compose canSend + sendSingleAction. This hook
 * owns state only and exposes setters for the dispatcher callback wiring (D-06).
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

  return useMemo(
    () => ({
      terminalResults,
      processes,
      processesLoading,
      appendTerminalResult,
      setProcesses,
      setProcessesLoading,
    }),
    [terminalResults, processes, processesLoading, appendTerminalResult],
  );
}
