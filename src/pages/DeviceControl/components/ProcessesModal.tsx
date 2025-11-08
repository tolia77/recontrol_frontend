import React, {useState, useMemo, useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import type {ProcessInfo} from '../types.ts';

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
  direction: 'asc' | 'desc';
}

const headerCols: { key: keyof ProcessInfo; i18n: string; numeric?: boolean }[] = [
  { key: 'Pid', i18n: 'pid', numeric: true },
  { key: 'Name', i18n: 'name' },
  { key: 'MemoryMB', i18n: 'memory', numeric: true },
  { key: 'CpuTime', i18n: 'cpuTime' },
  { key: 'StartTime', i18n: 'startTime' },
];

function parseCpuTime(cpu?: string): number {
  if (!cpu) return 0;
  // format HH:MM:SS(.fraction)
  const m = cpu.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!m) return 0;
  const [, hh, mm, ss, frac] = m;
  const ms = (parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseInt(ss, 10)) * 1000;
  if (frac) {
    // trim or pad fraction to milliseconds
    const fracMs = parseInt(frac.slice(0, 3).padEnd(3, '0'), 10);
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
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function formatStartDisplay(st?: string): string {
  if (!st) return '-';
  const d = new Date(st);
  if (isNaN(d.getTime())) return st; // fallback
  return d.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const ProcessesModal: React.FC<ProcessesModalProps> = ({
  open,
  onClose,
  processes,
  loading,
  onRefresh,
  onKill,
}) => {
  const { t } = useTranslation('deviceControl');
  const [sort, setSort] = useState<SortState>({ column: 'Pid', direction: 'asc' });

  const toggleSort = useCallback((col: keyof ProcessInfo) => {
    setSort(prev => prev.column === col
      ? { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { column: col, direction: 'asc' });
  }, []);

  const sorted = useMemo(() => {
    const arr = [...processes];
    arr.sort((a, b) => {
      const dir = sort.direction === 'asc' ? 1 : -1;
      const col = sort.column;
      let av: unknown;
      let bv: unknown;
      if (col === 'CpuTime') {
        av = parseCpuTime(a.CpuTime);
        bv = parseCpuTime(b.CpuTime);
      } else if (col === 'StartTime') {
        av = parseStartTime(a.StartTime);
        bv = parseStartTime(b.StartTime);
      } else {
        av = a[col];
        bv = b[col];
      }
      if (av == null) av = -Infinity;
      if (bv == null) bv = -Infinity;
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      const aNum = typeof av === 'number' ? av : Number(av);
      const bNum = typeof bv === 'number' ? bv : Number(bv);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return (aNum < bNum ? -1 : aNum > bNum ? 1 : 0) * dir;
      }
      return 0;
    });
    return arr;
  }, [processes, sort]);

  const handleKill = useCallback((pid: number) => {
    // optimistic removal
    onKill(pid);
  }, [onKill]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
            <h5 className="text-base font-semibold">{t('manual.terminal.processesModal.title')}</h5>
            <div className="flex gap-2 items-center">
              <button className="btn-primary" onClick={onRefresh} disabled={loading}>{t('manual.terminal.processesModal.refresh')}</button>
              <button className="btn-secondary" onClick={onClose}>{t('manual.terminal.processesModal.close')}</button>
            </div>
          </div>
          <div className="p-0">
            <div className="h-[480px] overflow-hidden">
              {loading ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-600">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-t-transparent border-primary rounded-full animate-spin" style={{borderColor: 'var(--color-lightgray)', borderTopColor: 'var(--color-primary)'}} />
                    {t('manual.terminal.processesModal.loading')}
                  </div>
                </div>
              ) : processes.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-600">{t('manual.terminal.processesModal.empty')}</div>
              ) : (
                <div className="h-full overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="sticky top-0 bg-white shadow-sm">
                      <tr className="text-left text-gray-700 border-b">
                        {headerCols.map(h => (
                          <th key={h.key} className="px-2 py-2 select-none cursor-pointer" onClick={() => toggleSort(h.key)}>
                            <span className="inline-flex items-center gap-1">
                              {t(`manual.terminal.processesModal.${h.i18n}`)}
                              {sort.column === h.key && (
                                <span className="text-xs">{sort.direction === 'asc' ? '▲' : '▼'}</span>
                              )}
                            </span>
                          </th>
                        ))}
                        <th className="px-2 py-2">{t('manual.terminal.processesModal.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(p => (
                        <tr key={p.Pid} className="border-b last:border-b-0 hover:bg-gray-50">
                          <td className="px-2 py-2 font-mono">{p.Pid}</td>
                          <td className="px-2 py-2">{p.Name}</td>
                          <td className="px-2 py-2">{typeof p.MemoryMB === 'number' ? `${p.MemoryMB} MB` : '-'}</td>
                          <td className="px-2 py-2">{formatCpuDisplay(p.CpuTime)}</td>
                          <td className="px-2 py-2">{formatStartDisplay(p.StartTime)}</td>
                          <td className="px-2 py-2">
                            <button className="btn-danger" onClick={() => handleKill(p.Pid)}>
                              {t('manual.terminal.kill')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
