import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useToast } from 'src/components/ui';
import type { UseFilesChannel } from '../../hooks/useFilesChannel';
import { useFilesRoots } from '../../hooks/useFilesRoots';
import { useFileManagerSelection } from '../../hooks/useFileManagerSelection';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { FileEntry } from '../../services/files';
import type {
  ContextMenuState,
  FileManagerState,
  SortColumn,
  SortState,
} from './types';
import { FileManagerToolbar } from './FileManagerToolbar';
import { FileManagerBreadcrumb } from './FileManagerBreadcrumb';
import { FileManagerSidebar } from './FileManagerSidebar';
import { FileManagerListing } from './FileManagerListing';
import { FileManagerStatusBar } from './FileManagerStatusBar';
import { FileManagerEmptyAllowlist } from './FileManagerEmptyAllowlist';
import { ContextMenu } from './ContextMenu';
import { detectSeparator, isAncestor, parentPath } from './utils/pathUtils';
import { mapFilesErrorToMessage } from './utils/errors';

interface FileManagerPanelProps {
  /** Used for storage keying in parent hooks; included for completeness. */
  deviceId: string;
  channel: UseFilesChannel;
  state: FileManagerState;
  setCurrentPath: (p: string | null) => void;
  setSort: (s: SortState) => void;
  setShowHidden: (v: boolean) => void;
}

interface MkdirResponse {
  path: string;
}
interface RenameResponse {
  path: string;
}

/**
 * Top-level orchestrator for the file-manager UI. Composes the toolbar,
 * breadcrumb, sidebar, listing, and status bar; owns the selection +
 * keyboard-shortcut hooks so all sub-components share the same state.
 *
 * Plan 10-04 adds:
 *   - `newFolderPending` state -> listing renders a pseudo-row input.
 *   - `renamingPath` state -> the matching row renders an inline input.
 *   - `contextMenu` state -> renders <ContextMenu /> for row + empty-area
 *     right-click flows.
 *   - Wiring of files.mkdir + files.rename via the files-ctl channel; success
 *     clears selection and bumps the refresh key, errors keep the editor
 *     open and surface a specific toast via mapFilesErrorToMessage().
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
  const [newFolderPending, setNewFolderPending] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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

  // ----- New folder: open the pseudo-row in the listing -----
  const handleNewFolder = useCallback(() => {
    if (!state.currentPath) return;
    setRenamingPath(null); // cancel any in-progress rename
    setNewFolderPending(true);
  }, [state.currentPath]);

  // ----- Rename: turn the single selected row into an inline input -----
  const handleRequestRename = useCallback(() => {
    if (selection.state.selected.size !== 1) return;
    const target = [...selection.state.selected][0];
    setNewFolderPending(false); // cancel any in-progress new folder
    setRenamingPath(target);
  }, [selection.state.selected]);

  const handleRequestDelete = useCallback(() => {
    console.log('[file-manager] delete: wired in plan 10-05');
  }, []);

  // ----- mkdir commit / cancel -----
  const handleNewFolderCommit = useCallback(
    (name: string) => {
      const request = channel.request;
      if (!request || !state.currentPath) {
        setNewFolderPending(false);
        return;
      }
      // Empty input: treat as cancel rather than firing an INVALID_NAME EMPTY
      // round-trip just to surface a toast.
      if (name.trim().length === 0) {
        setNewFolderPending(false);
        return;
      }
      request<{ parentPath: string; name: string }, MkdirResponse>(
        'files.mkdir',
        { parentPath: state.currentPath, name },
      )
        .then(() => {
          setNewFolderPending(false);
          selection.clear();
          setRefreshKey((k) => k + 1);
          // Return focus to the panel so F5 / arrows work without a click.
          rootRef.current?.focus();
        })
        .catch((err: unknown) => {
          // Keep the editor open so the user can correct + retry (Pitfall 3).
          toast.error(mapFilesErrorToMessage(err));
        });
    },
    [channel.request, state.currentPath, selection, toast],
  );

  const handleNewFolderCancel = useCallback(() => {
    setNewFolderPending(false);
  }, []);

  // ----- rename commit / cancel -----
  const handleRenameCommit = useCallback(
    (path: string, newName: string) => {
      const request = channel.request;
      if (!request) {
        setRenamingPath(null);
        return;
      }
      const trimmed = newName.trim();
      // No-op: if user pressed Enter without changing the name, just cancel.
      const currentName =
        visibleEntries.find((e) => e.path === path)?.name ?? '';
      if (trimmed.length === 0 || trimmed === currentName) {
        setRenamingPath(null);
        return;
      }
      request<{ path: string; newName: string }, RenameResponse>(
        'files.rename',
        { path, newName },
      )
        .then(() => {
          setRenamingPath(null);
          selection.clear();
          setRefreshKey((k) => k + 1);
          rootRef.current?.focus();
        })
        .catch((err: unknown) => {
          toast.error(mapFilesErrorToMessage(err));
        });
    },
    [channel.request, visibleEntries, selection, toast],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null);
  }, []);

  // ----- Second-click-to-rename arming (from listing's row-click handler) -----
  const handleRenameArm = useCallback((path: string) => {
    setNewFolderPending(false);
    setRenamingPath(path);
  }, []);

  // ----- Context-menu: row right-click -----
  const handleRowContextMenu = useCallback(
    (e: MouseEvent, entry: FileEntry) => {
      // Solo-select the right-clicked row if it isn't already in the
      // selection, so Rename has an unambiguous target.
      if (!selection.state.selected.has(entry.path)) {
        const idx = visibleEntries.findIndex((v) => v.path === entry.path);
        if (idx >= 0) selection.selectOnly(idx);
      }
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            label: 'Rename',
            onSelect: () => {
              // Rename targets the single selected row; selectOnly above
              // ensured the right-clicked row is the selection.
              const target = entry.path;
              setNewFolderPending(false);
              setRenamingPath(target);
            },
          },
          { separator: true, label: '', onSelect: () => {} },
          {
            label: 'Delete',
            disabled: true,
            danger: true,
            onSelect: () => toast.info('Delete arrives in plan 10-05'),
          },
          {
            label: 'Move to…',
            disabled: true,
            onSelect: () => toast.info('Move to arrives in plan 10-05'),
          },
          {
            label: 'Copy to…',
            disabled: true,
            onSelect: () => toast.info('Copy to arrives in plan 10-05'),
          },
        ],
      });
    },
    [selection, visibleEntries, toast],
  );

  // ----- Context-menu: empty-area right-click -----
  const handleEmptyContextMenu = useCallback(
    (e: MouseEvent) => {
      const canMkdir = !!state.currentPath;
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          {
            label: 'New folder',
            disabled: !canMkdir,
            onSelect: handleNewFolder,
          },
        ],
      });
    },
    [state.currentPath, handleNewFolder],
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ----- Keyboard handler (focus-guarded) -----
  const keyboard = useKeyboardShortcuts({
    rootRef,
    enabled: channel.status === 'open' && renamingPath === null && !newFolderPending,
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
          onNewFolder={handleNewFolder}
          onRename={handleRequestRename}
          selectionCount={selection.state.selected.size}
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
          newFolderPending={newFolderPending}
          onNewFolderCommit={handleNewFolderCommit}
          onNewFolderCancel={handleNewFolderCancel}
          renamingPath={renamingPath}
          onRenameCommit={handleRenameCommit}
          onRenameCancel={handleRenameCancel}
          onRowContextMenu={handleRowContextMenu}
          onEmptyContextMenu={handleEmptyContextMenu}
          onRenameArm={handleRenameArm}
        />
        <FileManagerStatusBar
          totalCount={visibleEntries.length}
          selectionCount={selection.state.selected.size}
          selectionSize={selection.selectedSize}
        />
      </div>
      <ContextMenu state={contextMenu} onClose={handleContextMenuClose} />
    </div>
  );
}
