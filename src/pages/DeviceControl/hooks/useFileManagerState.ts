import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  FileManagerState,
  SortState,
} from '../components/FileManager/types';

const STORAGE_VERSION = 'v1';

const DEFAULT_STATE: FileManagerState = {
  panelOpen: false,
  splitRatio: 0.5,
  rightPaneActive: null,
  currentPath: null,
  sort: { column: 'name', direction: 'asc' },
  showHidden: false,
};

function storageKey(deviceId: string, field: keyof FileManagerState): string {
  return `recontrol.fm.${STORAGE_VERSION}.${deviceId}.${field}`;
}

function readField<T>(
  deviceId: string,
  field: keyof FileManagerState,
  fallback: T,
  parser: (raw: string) => T,
): T {
  if (!deviceId) return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(deviceId, field));
    if (raw === null) return fallback;
    return parser(raw);
  } catch {
    return fallback;
  }
}

function writeField(
  deviceId: string,
  field: keyof FileManagerState,
  value: string,
): void {
  if (!deviceId) return;
  try {
    window.localStorage.setItem(storageKey(deviceId, field), value);
  } catch {
    // ignore quota / privacy-mode errors
  }
}

function loadInitialState(deviceId: string): FileManagerState {
  if (!deviceId) return DEFAULT_STATE;

  const storedActive = readField<'files' | 'assistant' | 'scenarios' | null>(
    deviceId,
    'rightPaneActive',
    DEFAULT_STATE.rightPaneActive,
    (s) => (s === 'files' || s === 'assistant' || s === 'scenarios' ? s : null),
  );

  // Back-compat: if the new key is unset but the legacy panelOpen=true is
  // present, seed rightPaneActive='files'.
  const legacyPanelOpen = readField<boolean>(
    deviceId,
    'panelOpen',
    DEFAULT_STATE.panelOpen,
    (s) => s === 'true',
  );
  const rightPaneActive: 'files' | 'assistant' | 'scenarios' | null =
    storedActive ?? (legacyPanelOpen ? 'files' : null);

  return {
    panelOpen: rightPaneActive === 'files',
    splitRatio: readField<number>(
      deviceId,
      'splitRatio',
      DEFAULT_STATE.splitRatio,
      (s) => {
        const n = Number.parseFloat(s);
        if (!Number.isFinite(n)) return DEFAULT_STATE.splitRatio;
        return Math.min(0.9, Math.max(0.1, n));
      },
    ),
    rightPaneActive,
    currentPath: readField<string | null>(
      deviceId,
      'currentPath',
      DEFAULT_STATE.currentPath,
      (s) => (s === '' ? null : s),
    ),
    sort: readField<SortState>(
      deviceId,
      'sort',
      DEFAULT_STATE.sort,
      (s) => {
        try {
          const parsed = JSON.parse(s) as SortState;
          if (
            parsed &&
            typeof parsed === 'object' &&
            typeof parsed.column === 'string' &&
            (parsed.direction === 'asc' || parsed.direction === 'desc')
          ) {
            return parsed;
          }
          return DEFAULT_STATE.sort;
        } catch {
          return DEFAULT_STATE.sort;
        }
      },
    ),
    showHidden: readField<boolean>(
      deviceId,
      'showHidden',
      DEFAULT_STATE.showHidden,
      (s) => s === 'true',
    ),
  };
}

export interface UseFileManagerStateReturn {
  state: FileManagerState;
  setPanelOpen: (v: boolean) => void;
  setSplitRatio: (v: number) => void;
  setRightPaneActive: (v: 'files' | 'assistant' | 'scenarios' | null) => void;
  setCurrentPath: (v: string | null) => void;
  setSort: (v: SortState) => void;
  setShowHidden: (v: boolean) => void;
}

/**
 * Per-device persistent File Manager state. Each field is stored under a
 * separate key so a schema bump for one field invalidates only that slice.
 * Setters write to localStorage synchronously before state updates.
 */
export function useFileManagerState(deviceId: string): UseFileManagerStateReturn {
  const [state, setState] = useState<FileManagerState>(() => loadInitialState(deviceId));

  // Re-hydrate whenever the deviceId changes (e.g., user navigates to a
  // different device within the same browser tab).
  useEffect(() => {
    setState(loadInitialState(deviceId));
  }, [deviceId]);

  const setPanelOpen = useCallback(
    (v: boolean) => {
      writeField(deviceId, 'panelOpen', v ? 'true' : 'false');
      const newActive: 'files' | 'assistant' | 'scenarios' | null = v ? 'files' : null;
      writeField(deviceId, 'rightPaneActive', newActive ?? '');
      setState((prev) => ({
        ...prev,
        panelOpen: v,
        rightPaneActive: newActive,
      }));
    },
    [deviceId],
  );

  const setRightPaneActive = useCallback(
    (v: 'files' | 'assistant' | 'scenarios' | null) => {
      writeField(deviceId, 'rightPaneActive', v ?? '');
      setState((prev) => ({
        ...prev,
        rightPaneActive: v,
        panelOpen: v === 'files',
      }));
    },
    [deviceId],
  );

  const setSplitRatio = useCallback(
    (v: number) => {
      const clamped = Math.min(0.9, Math.max(0.1, v));
      writeField(deviceId, 'splitRatio', String(clamped));
      setState((prev) => ({ ...prev, splitRatio: clamped }));
    },
    [deviceId],
  );

  const setCurrentPath = useCallback(
    (v: string | null) => {
      writeField(deviceId, 'currentPath', v ?? '');
      setState((prev) => ({ ...prev, currentPath: v }));
    },
    [deviceId],
  );

  const setSort = useCallback(
    (v: SortState) => {
      writeField(deviceId, 'sort', JSON.stringify(v));
      setState((prev) => ({ ...prev, sort: v }));
    },
    [deviceId],
  );

  const setShowHidden = useCallback(
    (v: boolean) => {
      writeField(deviceId, 'showHidden', v ? 'true' : 'false');
      setState((prev) => ({ ...prev, showHidden: v }));
    },
    [deviceId],
  );

  return useMemo(
    () => ({
      state,
      setPanelOpen,
      setSplitRatio,
      setRightPaneActive,
      setCurrentPath,
      setSort,
      setShowHidden,
    }),
    [
      state,
      setPanelOpen,
      setSplitRatio,
      setRightPaneActive,
      setCurrentPath,
      setSort,
      setShowHidden,
    ],
  );
}
