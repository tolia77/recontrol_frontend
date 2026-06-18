import { useCallback } from "react";
import type { RefObject, KeyboardEvent } from "react";
import type { FileEntry } from "src/pages/DeviceControl/services/files/filesProtocol.generated";
import type { useFileManagerSelection } from "./state/useFileManagerSelection";

/**
 * Scoped keyboard handler for the file manager panel. Returns an `onKeyDown`
 * suitable for `<div ref={rootRef} tabIndex={0} onKeyDown={...}>`.
 *
 * Critical guard: the handler short-circuits when focus is NOT inside
 * `rootRef.current`. The interactive video overlay also uses a
 * tabIndex+onKeyDown pattern, so unguarded shortcuts here would race for the
 * same keystrokes when both are mounted side-by-side.
 *
 * Keys handled:
 *   F5                   -> onRefresh
 *   F2                   -> onRequestRename (only when exactly 1 selected)
 *   Delete               -> onRequestDelete (only when selection > 0)
 *   Ctrl/Cmd + A         -> selection.selectAll
 *   Escape               -> selection.clear
 *   Backspace            -> onNavigateUp
 *   Alt + ArrowLeft      -> onNavigateUp
 *   Enter                -> onActivate(entries[focusedIndex])
 *   ArrowDown            -> setFocus(focusedIndex + 1) (no wrap)
 *   ArrowUp              -> setFocus(focusedIndex - 1) (no wrap)
 *   Shift + ArrowDown    -> setFocus + extendTo on the new index
 *   Shift + ArrowUp      -> setFocus + extendTo on the new index
 *
 * Browser-default keys NOT intercepted:
 *   Ctrl+F  (browser find)
 *   Ctrl+R  (browser reload)
 *   Tab     (browser focus traversal)
 */
export function useKeyboardShortcuts(params: {
  rootRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  entries: readonly FileEntry[];
  selection: ReturnType<typeof useFileManagerSelection>;
  onRefresh: () => void;
  onNavigateUp: () => void;
  onActivate: (entry: FileEntry) => void;
  onRequestRename: () => void;
  onRequestDelete: () => void;
}): { onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void } {
  const {
    rootRef,
    enabled,
    entries,
    selection,
    onRefresh,
    onNavigateUp,
    onActivate,
    onRequestRename,
    onRequestDelete,
  } = params;

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!enabled) return;
      // Focus-ownership guard: only handle keys when focus is inside the
      // panel's root subtree. Prevents the interactive video overlay from
      // having its keystrokes hijacked when both are mounted in a splitter.
      if (!rootRef.current?.contains(document.activeElement)) return;

      const focusedIndex = selection.state.focusedIndex;
      const max = entries.length - 1;
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // F5 -- Refresh
      if (e.key === "F5" && !ctrlOrMeta && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onRefresh();
        return;
      }

      // F2 -- Rename (single selection only)
      if (e.key === "F2" && !ctrlOrMeta && !e.shiftKey && !e.altKey) {
        if (selection.state.selected.size === 1) {
          e.preventDefault();
          onRequestRename();
        }
        return;
      }

      // Delete -- Delete (1+ selection)
      if (e.key === "Delete" && !ctrlOrMeta && !e.shiftKey && !e.altKey) {
        if (selection.state.selected.size > 0) {
          e.preventDefault();
          onRequestDelete();
        }
        return;
      }

      // Ctrl/Cmd+A -- Select all visible
      if (
        ctrlOrMeta &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "a"
      ) {
        e.preventDefault();
        selection.selectAll();
        return;
      }

      // Escape -- Clear selection
      if (e.key === "Escape" && !ctrlOrMeta && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        selection.clear();
        return;
      }

      // Backspace OR Alt+ArrowLeft -- Navigate up
      if (e.key === "Backspace" && !ctrlOrMeta && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onNavigateUp();
        return;
      }
      if (e.key === "ArrowLeft" && e.altKey && !ctrlOrMeta && !e.shiftKey) {
        e.preventDefault();
        onNavigateUp();
        return;
      }

      // Enter -- Activate focused row
      if (e.key === "Enter" && !ctrlOrMeta && !e.shiftKey && !e.altKey) {
        if (focusedIndex >= 0 && focusedIndex <= max) {
          e.preventDefault();
          onActivate(entries[focusedIndex]);
        }
        return;
      }

      // Arrow navigation (no wrap; top/bottom are hard edges)
      if (e.key === "ArrowDown" && !ctrlOrMeta && !e.altKey) {
        if (max < 0) return;
        e.preventDefault();
        const next = focusedIndex < 0 ? 0 : Math.min(focusedIndex + 1, max);
        if (e.shiftKey) {
          selection.setFocus(next);
          selection.extendTo(next);
        } else {
          selection.setFocus(next);
        }
        return;
      }
      if (e.key === "ArrowUp" && !ctrlOrMeta && !e.altKey) {
        if (max < 0) return;
        e.preventDefault();
        const next = focusedIndex < 0 ? 0 : Math.max(focusedIndex - 1, 0);
        if (e.shiftKey) {
          selection.setFocus(next);
          selection.extendTo(next);
        } else {
          selection.setFocus(next);
        }
        return;
      }

      // Fallthrough: do NOT preventDefault. Browser keeps native behavior.
    },
    [
      rootRef,
      enabled,
      entries,
      selection,
      onRefresh,
      onNavigateUp,
      onActivate,
      onRequestRename,
      onRequestDelete,
    ],
  );

  return { onKeyDown };
}
