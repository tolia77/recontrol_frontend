import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ProcessInfo } from "src/pages/DeviceControl/types";
import { RefreshIcon, CloseIcon } from "src/pages/DeviceControl/components/icons/icons";
import {
  Modal,
  Button,
  LoadingState,
  EmptyState,
} from "src/components/ui";

interface ProcessesModalProps {
  open: boolean;
  onClose: () => void;
  processes: ProcessInfo[];
  loading: boolean;
  onRefresh: () => void;
  onKill: (pid: number) => void;
}

interface SortState {
  column: keyof ProcessInfo;
  direction: "asc" | "desc";
}

const headerCols: {
  key: keyof ProcessInfo;
  i18n: string;
  numeric?: boolean;
}[] = [
  { key: "Pid", i18n: "pid", numeric: true },
  { key: "Name", i18n: "name" },
  { key: "MemoryMB", i18n: "memory", numeric: true },
  { key: "CpuTime", i18n: "cpuTime" },
  { key: "StartTime", i18n: "startTime" },
];

function parseCpuTime(cpu?: string): number {
  if (!cpu) return 0;
  // format HH:MM:SS(.fraction)
  const m = cpu.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!m) return 0;
  const [, hh, mm, ss, frac] = m;
  const ms =
    (parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseInt(ss, 10)) * 1000;
  if (frac) {
    // trim or pad fraction to milliseconds
    const fracMs = parseInt(frac.slice(0, 3).padEnd(3, "0"), 10);
    return ms + fracMs;
  }
  return ms;
}

function parseStartTime(st?: string): number {
  if (!st) return 0;
  const ts = Date.parse(st);
  return isNaN(ts) ? 0 : ts;
}

function formatCpuDisplay(cpu?: string): string {
  const ms = parseCpuTime(cpu);
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatStartDisplay(st?: string): string {
  if (!st) return "-";
  const d = new Date(st);
  if (isNaN(d.getTime())) return st; // fallback
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const ProcessesModal: React.FC<ProcessesModalProps> = ({
  open,
  onClose,
  processes,
  loading,
  onRefresh,
  onKill,
}) => {
  const { t } = useTranslation("deviceControl");
  const [sort, setSort] = useState<SortState>({
    column: "Pid",
    direction: "asc",
  });

  const toggleSort = useCallback((col: keyof ProcessInfo) => {
    setSort((prev) =>
      prev.column === col
        ? { column: col, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column: col, direction: "asc" },
    );
  }, []);

  const sorted = useMemo(() => {
    const arr = [...processes];
    arr.sort((a, b) => {
      const dir = sort.direction === "asc" ? 1 : -1;
      const col = sort.column;
      let av: unknown;
      let bv: unknown;
      if (col === "CpuTime") {
        av = parseCpuTime(a.CpuTime);
        bv = parseCpuTime(b.CpuTime);
      } else if (col === "StartTime") {
        av = parseStartTime(a.StartTime);
        bv = parseStartTime(b.StartTime);
      } else {
        av = a[col];
        bv = b[col];
      }
      if (av == null) av = -Infinity;
      if (bv == null) bv = -Infinity;
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      const aNum = typeof av === "number" ? av : Number(av);
      const bNum = typeof bv === "number" ? bv : Number(bv);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return (aNum < bNum ? -1 : aNum > bNum ? 1 : 0) * dir;
      }
      return 0;
    });
    return arr;
  }, [processes, sort]);

  const handleKill = useCallback(
    (pid: number) => {
      // optimistic removal
      onKill(pid);
    },
    [onKill],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      ariaLabel={t("manual.terminal.processesModal.title")}
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <h5 className="text-base font-semibold">
          {t("manual.terminal.processesModal.title")}
        </h5>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            title={t("manual.terminal.processesModal.refresh")}
            className="p-2"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            title={t("manual.terminal.processesModal.close")}
            className="p-2"
            onClick={onClose}
          >
            <CloseIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-0">
        <div className="h-[480px] overflow-hidden">
          {loading ? (
            <LoadingState
              message={t("manual.terminal.processesModal.loading")}
            />
          ) : processes.length === 0 ? (
            <EmptyState title={t("manual.terminal.processesModal.empty")} />
          ) : (
            <div className="h-full overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface sticky top-0 border-b border-border">
                  <tr className="text-foreground border-b text-left">
                    {headerCols.map((h) => (
                      <th
                        key={h.key}
                        className="cursor-pointer px-2 py-2 select-none"
                        onClick={() => toggleSort(h.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {t(`manual.terminal.processesModal.${h.i18n}`)}
                          {sort.column === h.key && (
                            <span className="text-xs">
                              {sort.direction === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="px-2 py-2">
                      {t("manual.terminal.processesModal.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr
                      key={p.Pid}
                      className="hover:bg-surface-muted border-b last:border-b-0"
                    >
                      <td className="px-2 py-2 font-mono">{p.Pid}</td>
                      <td className="px-2 py-2">{p.Name}</td>
                      <td className="px-2 py-2">
                        {typeof p.MemoryMB === "number"
                          ? `${p.MemoryMB} MB`
                          : "-"}
                      </td>
                      <td className="px-2 py-2">
                        {formatCpuDisplay(p.CpuTime)}
                      </td>
                      <td className="px-2 py-2">
                        {formatStartDisplay(p.StartTime)}
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleKill(p.Pid)}
                        >
                          {t("manual.terminal.kill")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ProcessesModal;
