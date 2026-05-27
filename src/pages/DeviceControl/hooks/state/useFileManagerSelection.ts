import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileEntry } from "../../services/files";
import type { SelectionState } from "../../components/FileManager/types";

/**
 * Windows-Explorer-style multi-selection state machine, keyed by entry.path.
 *
 * Selection is fully derived from indices into the supplied `entries` array,
 * but the `selected` set itself stores PATHS so that downstream consumers
 * (status bar, future delete/move/copy) can address entries directly without
 * caring about the array order.
 *
 * Semantics (match Windows Explorer):
 *  - selectOnly(i): selected = { entries[i].path }; anchor = i; focus = i.
 *  - toggle(i): if path in selected -> remove, else add. anchor = i; focus = i.
 *  - extendTo(i): selected = entries[min(anchor,i) .. max(anchor,i)] (inclusive)
 *    by path. focus = i. anchor unchanged. If anchor == -1, behaves like
 *    selectOnly(i).
 *  - selectAll(): selected = all paths. anchor = 0. focus = 0.
 *  - clear(): selected = empty. anchor = -1. focus is preserved
 *    (Explorer keeps the focus rectangle after Esc).
 *  - setFocus(i): only focusedIndex changes (selection / anchor untouched).
 *
 * Selection-invalidation rule (Research Pitfall 5): when the `entries` array
 * IDENTITY changes (navigation, sort, hidden-filter toggle), reset selected to
 * empty and anchor to -1, but clamp focusedIndex into the new valid range.
 * Length-only changes from in-place rewrites would not be detected here, but
 * the panel's data flow always replaces the array on refetch / sort / filter,
 * so this guard is sufficient.
 */
export function useFileManagerSelection(entries: readonly FileEntry[]): {
  state: SelectionState;
  clear: () => void;
  selectOnly: (index: number) => void;
  toggle: (index: number) => void;
  extendTo: (index: number) => void;
  selectAll: () => void;
  setFocus: (index: number) => void;
  selectedEntries: FileEntry[];
  selectedSize: number;
} {
  const [state, setState] = useState<SelectionState>({
    selected: new Set<string>(),
    focusedIndex: -1,
    anchorIndex: -1,
  });

  // Identity-tracking ref: when `entries` array identity changes, reset
  // selection + anchor and clamp focus into the new range.
  const prevEntriesRef = useRef<readonly FileEntry[]>(entries);
  useEffect(() => {
    if (prevEntriesRef.current === entries) return;
    prevEntriesRef.current = entries;
    setState((prev) => {
      const max = entries.length - 1;
      const clampedFocus =
        prev.focusedIndex < 0
          ? -1
          : max < 0
            ? -1
            : Math.min(prev.focusedIndex, max);
      // Only allocate a new Set when needed.
      if (prev.selected.size === 0 && prev.anchorIndex === -1) {
        if (clampedFocus === prev.focusedIndex) return prev;
        return { ...prev, focusedIndex: clampedFocus };
      }
      return {
        selected: new Set<string>(),
        anchorIndex: -1,
        focusedIndex: clampedFocus,
      };
    });
  }, [entries]);

  const selectOnly = useCallback(
    (index: number) => {
      if (index < 0 || index >= entries.length) return;
      const path = entries[index].path;
      setState({
        selected: new Set([path]),
        anchorIndex: index,
        focusedIndex: index,
      });
    },
    [entries],
  );

  const toggle = useCallback(
    (index: number) => {
      if (index < 0 || index >= entries.length) return;
      const path = entries[index].path;
      setState((prev) => {
        const next = new Set(prev.selected);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return {
          selected: next,
          anchorIndex: index,
          focusedIndex: index,
        };
      });
    },
    [entries],
  );

  const extendTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= entries.length) return;
      setState((prev) => {
        if (prev.anchorIndex < 0) {
          // No anchor -> behave like selectOnly.
          return {
            selected: new Set([entries[index].path]),
            anchorIndex: index,
            focusedIndex: index,
          };
        }
        const lo = Math.min(prev.anchorIndex, index);
        const hi = Math.max(prev.anchorIndex, index);
        const next = new Set<string>();
        for (let i = lo; i <= hi; i++) {
          next.add(entries[i].path);
        }
        return {
          selected: next,
          anchorIndex: prev.anchorIndex,
          focusedIndex: index,
        };
      });
    },
    [entries],
  );

  const selectAll = useCallback(() => {
    if (entries.length === 0) {
      setState({
        selected: new Set<string>(),
        anchorIndex: -1,
        focusedIndex: -1,
      });
      return;
    }
    const next = new Set<string>();
    for (const e of entries) next.add(e.path);
    setState({
      selected: next,
      anchorIndex: 0,
      focusedIndex: 0,
    });
  }, [entries]);

  const clear = useCallback(() => {
    setState((prev) => ({
      selected: new Set<string>(),
      anchorIndex: -1,
      focusedIndex: prev.focusedIndex,
    }));
  }, []);

  const setFocus = useCallback(
    (index: number) => {
      if (index < 0 || index >= entries.length) return;
      setState((prev) => {
        if (prev.focusedIndex === index) return prev;
        return { ...prev, focusedIndex: index };
      });
    },
    [entries],
  );

  const selectedEntries = useMemo<FileEntry[]>(() => {
    if (state.selected.size === 0) return [];
    return entries.filter((e) => state.selected.has(e.path));
  }, [entries, state.selected]);

  // Size of selection, EXCLUDING directories (Explorer status bar convention).
  const selectedSize = useMemo<number>(() => {
    let total = 0;
    for (const e of selectedEntries) {
      if (!e.isDirectory) total += e.sizeBytes;
    }
    return total;
  }, [selectedEntries]);

  return {
    state,
    clear,
    selectOnly,
    toggle,
    extendTo,
    selectAll,
    setFocus,
    selectedEntries,
    selectedSize,
  };
}
