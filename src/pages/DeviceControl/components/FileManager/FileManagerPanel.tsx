import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from 'src/components/ui';
import type { UseFilesChannel } from '../../hooks/useFilesChannel';
import { useFilesRoots } from '../../hooks/useFilesRoots';
import { useFileManagerSelection } from '../../hooks/useFileManagerSelection';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { FileEntry } from '../../services/files';
import type { FileManagerState, SortColumn, SortState } from './types';
import { FileManagerToolbar } from './FileManagerToolbar';
import { FileManagerBreadcrumb } from './FileManagerBreadcrumb';
import { FileManagerSidebar } from './FileManagerSidebar';
import { FileManagerListing } from './FileManagerListing';
import { FileManagerStatusBar } from './FileManagerStatusBar';
import { FileManagerEmptyAllowlist } from './FileManagerEmptyAllowlist';
import { detectSeparator, isAncestor, parentPath } from './utils/pathUtils';

interface FileManagerPanelProps {
  /** Used for storage keying in parent hooks; included for completeness. */
  deviceId: string;
  channel: UseFilesChannel;
  state: FileManagerState;
  setCurrentPath: (p: string | null) => void;
  setSort: (s: SortState) => void;
  setShowHidden: (v: boolean) => void;
}

/**
 * Top-level orchestrator for the file-manager UI. Composes the toolbar,
 * breadcrumb, sidebar, listing, and status bar; owns the selection +
 * keyboard-shortcut hooks so all sub-components share the same state.
 *
 * Focus contract: the panel root is `tabIndex={0}` and gets focused on mount
 * so F5 / arrow keys / Esc work without an extra click. The keyboard handler
 * inside `useKeyboardShortcuts` short-circuits when focus isn't inside the
 * panel root, so the interactive video overlay (which uses the same
 * tabIndex+onKeyDown pattern) never has its keystrokes hijacked.
 */
export function FileManagerPanel({
  deviceId: _deviceId,
  channel,
  state,
  setCurrentPath,
  setSort,
  setShowHidden,
}: FileManagerPanelProps) {
  const rootsResult = useFilesRoots(channel);
  const [refreshKey, setRefreshKey] = useState(0);
  const [visibleEntries, setVisibleEntries] = useState<FileEntry[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // When roots arrive for the first time and we don't have a currentPath yet,
  // leave currentPath null (empty-state prompt); the user must click a root.
  // But if our persisted currentPath no longer matches any known root, clear
  // it so we don't keep trying to list a folder that's no longer shared.
  useEffect(() => {
    if (!rootsResult.roots || rootsResult.roots.length === 0) return;
    if (state.currentPath === null) return;
    const stillReachable = rootsResult.roots.some(
      (r) =>
        r.path === state.currentPath ||
        isAncestor(r.path, state.currentPath as string),
    );
    if (!stillReachable) {
      setCurrentPath(null);
    }
  }, [rootsResult.roots, state.currentPath, setCurrentPath]);

  // Figure out which root the current path lives under so the breadcrumb knows
  // which separator to use.
  const activeRootPath = useMemo(() => {
    if (!state.currentPath || !rootsResult.roots) return null;
    const hit = rootsResult.roots.find(
      (r) =>
        r.path === state.currentPath ||
        isAncestor(r.path, state.currentPath as string),
    );
    return hit?.path ?? null;
  }, [state.currentPath, rootsResult.roots]);

  const handleToggleSort = useCallback(
    (col: SortColumn) => {
      if (state.sort.column === col) {
        setSort({
          column: col,
          direction: state.sort.direction === 'asc' ? 'desc' : 'asc',
        });
      } else {
        setSort({ column: col, direction: 'asc' });
      }
    },
    [state.sort, setSort],
  );

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSelectRoot = useCallback(
    (path: string) => {
      setCurrentPath(path);
    },
    [setCurrentPath],
  );

  // ----- Selection state (shared between listing + keyboard handler + status) -----
  const selection = useFileManagerSelection(visibleEntries);

  // ----- Activation: Enter on focused row OR double-click on a row -----
  const handleActivate = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) {
        setCurrentPath(entry.path);
      } else {
        toast.info('File downloads arrive in Phase 11.');
      }
    },
    [setCurrentPath, toast],
  );

  // ----- Navigate up: Backspace OR Alt+ArrowLeft -----
  const handleNavigateUp = useCallback(() => {
    if (!state.currentPath || !activeRootPath) return;
    if (state.currentPath === activeRootPath) return; // already at root of allowlisted root
    const sep = detectSeparator(activeRootPath);
    const parent = parentPath(state.currentPath, sep);
    if (parent === null) return;
    // Clamp at the active root: never navigate above an allowlisted root.
    if (
      parent === activeRootPath ||
      isAncestor(activeRootPath, parent)
    ) {
      setCurrentPath(parent);
    } else {
      // Parent would be outside the allowlisted root -- snap to the root.
      setCurrentPath(activeRootPath);
    }
  }, [state.currentPath, activeRootPath, setCurrentPath]);

  // ----- Rename / Delete stubs (plan 10-04 / 10-05 implement) -----
  const handleRequestRename = useCallback(() => {
    console.log('[file-manager] rename: wired in plan 10-04');
  }, []);
  const handleRequestDelete = useCallback(() => {
    console.log('[file-manager] delete: wired in plan 10-05');
  }, []);

  // ----- Keyboard handler (focus-guarded) -----
  const keyboard = useKeyboardShortcuts({
    rootRef,
    enabled: channel.status === 'open',
    entries: visibleEntries,
    selection,
    onRefresh: handleRefresh,
    onNavigateUp: handleNavigateUp,
    onActivate: handleActivate,
    onRequestRename: handleRequestRename,
    onRequestDelete: handleRequestDelete,
  });

  // Auto-focus the panel root on mount so F5 / arrows / Esc work without
  // requiring the user to click first. Only focus once -- subsequent focus
  // changes are user-driven.
  const initialFocusedRef = useRef(false);
  useEffect(() => {
    if (initialFocusedRef.current) return;
    if (channel.status !== 'open') return;
    if (!rootRef.current) return;
    rootRef.current.focus();
    initialFocusedRef.current = true;
  }, [channel.status]);

  // Handle channel-closed placeholder.
  if (channel.status === 'closed' || channel.status === 'failed') {
    return (
      <div
        ref={rootRef}
        tabIndex={0}
        className="outline-none flex h-full w-full bg-background text-text items-center justify-center p-8 text-center text-darkgray text-sm"
      >
        Files channel disconnected -- reconnect the stream.
      </div>
    );
  }

  // Handle empty-allowlist state.
  if (rootsResult.isEmpty) {
    return (
      <div
        ref={rootRef}
        tabIndex={0}
        className="outline-none flex h-full w-full bg-background text-text"
      >
        <FileManagerEmptyAllowlist />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={keyboard.onKeyDown}
      className="outline-none flex h-full w-full bg-background text-text"
    >
      <FileManagerSidebar
        roots={rootsResult.roots}
        isLoading={rootsResult.isLoading}
        error={rootsResult.error ? 'Could not load shared folders' : null}
        currentPath={state.currentPath}
        onSelectRoot={handleSelectRoot}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <FileManagerToolbar
          showHidden={state.showHidden}
          onToggleShowHidden={setShowHidden}
          onRefresh={handleRefresh}
          disabled={state.currentPath === null}
        />
        <FileManagerBreadcrumb
          currentPath={state.currentPath}
          rootPath={activeRootPath}
          onNavigate={setCurrentPath}
        />
        <FileManagerListing
          channel={channel}
          path={state.currentPath}
          sort={state.sort}
          onToggleSort={handleToggleSort}
          refreshKey={refreshKey}
          showHidden={state.showHidden}
          selection={selection}
          onVisibleEntriesChange={setVisibleEntries}
          onActivate={handleActivate}
        />
        <FileManagerStatusBar
          totalCount={visibleEntries.length}
          selectionCount={selection.state.selected.size}
          selectionSize={selection.selectedSize}
        />
      </div>
    </div>
  );
}
