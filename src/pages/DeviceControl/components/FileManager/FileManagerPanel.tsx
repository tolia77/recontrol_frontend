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
import { ConfirmDialog } from './ConfirmDialog';
import { FolderPickerModal } from './FolderPickerModal';
import { TransferQueuePanel } from './TransferQueuePanel';
import { TransferQueue } from '../../services/transfer';
import {
  detectSeparator,
  isAncestor,
  joinPath,
  parentPath,
} from './utils/pathUtils';
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

  // ----- Plan 11-03: transfer queue (stub runners) -----
  // Constructed once per panel mount via useRef so the queue's listeners and
  // in-flight state survive re-renders. A panel close + reopen creates a new
  // queue -- "queue survives panel close" is CONTEXT-deferred to phase 12.
  // Stub runners land items in 'failed' immediately so the panel surface is
  // exercisable end-to-end before plan 11-04 / 11-05 wire real runners.
  const queueRef = useRef<TransferQueue | null>(null);
  if (queueRef.current === null) {
    queueRef.current = new TransferQueue(
      async (item, queue) => {
        queue.updateItem(item.id, {
          state: 'failed',
          error: {
            code: 'CLIENT_ERROR',
            message: 'Upload runner not yet wired (Plan 11-04).',
          },
          completedAt: Date.now(),
        });
      },
      async (item, queue) => {
        queue.updateItem(item.id, {
          state: 'failed',
          error: {
            code: 'CLIENT_ERROR',
            message: 'Download runner not yet wired (Plan 11-05).',
          },
          completedAt: Date.now(),
        });
      },
    );
  }
  const queue = queueRef.current;

  const [refreshKey, setRefreshKey] = useState(0);
  const [visibleEntries, setVisibleEntries] = useState<FileEntry[]>([]);
  const [newFolderPending, setNewFolderPending] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // ----- Plan 10-05: delete flow state -----
  // Session-scoped flag (CONTEXT-locked): when true, single-file deletes skip
  // the confirm dialog. Lives in component state ONLY -- NOT persisted to
  // localStorage / sessionStorage / any storage. Resets on full page reload.
  const [suppressSingleDeleteConfirm, setSuppressSingleDeleteConfirm] =
    useState(false);
  // In-flight gate for delete: passed as `isBusy` to ConfirmDialog so the
  // Confirm button stays disabled while files.delete is sequentially issued
  // for each selected path. Wrapped in try/finally to always reset.
  const [isDeleting, setIsDeleting] = useState(false);
  // Pending delete confirm: paths + display names captured at the moment the
  // user invoked Delete (so the dialog body stays stable even if entries
  // change underneath us mid-confirmation).
  const [confirm, setConfirm] = useState<
    | { kind: 'delete'; paths: string[]; names: string[] }
    | null
  >(null);
  // ----- Plan 10-05: move / copy flow state -----
  // FolderPickerModal mode -- non-null while the picker is open.
  const [picker, setPicker] = useState<null | { kind: 'move' | 'copy' }>(null);
  // In-flight gate for the sequential move/copy loop. Mirrors `isDeleting`
  // semantics. Passed to FolderPickerModal as `isBusy` so its Confirm /
  // Cancel buttons stay disabled and Esc / overlay-click cancellation are
  // suppressed while wire calls are still resolving.
  const [isOperating, setIsOperating] = useState(false);
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

  // ----- Delete: open the destructive confirm dialog (or skip for suppressed single-file deletes) -----
  // performDelete fires files.delete sequentially over the captured paths.
  // Sequential (NOT Promise.all) so error reporting stays clean and so the
  // remote desktop is never hammered in parallel. Wraps the loop in
  // try/finally so isDeleting is always reset, even on uncaught rejection.
  // No optimistic UI (Pitfall 3): the listing is only refreshed via
  // setRefreshKey AFTER the wire calls resolve. On error, surfaces a toast
  // and STILL refreshes -- the source of truth is what the desktop reports.
  const performDelete = useCallback(
    async (paths: string[]) => {
      const request = channel.request;
      if (!request) {
        toast.error('Files channel disconnected');
        return;
      }
      setIsDeleting(true);
      try {
        for (const p of paths) {
          try {
            await request<{ path: string }, Record<string, never>>(
              'files.delete',
              { path: p },
            );
          } catch (err: unknown) {
            toast.error(mapFilesErrorToMessage(err));
          }
        }
        // Pitfall 5: clear selection on success (and on partial-failure: the
        // entries-array-identity bump from setRefreshKey would clear it
        // anyway; we clear explicitly so the cleared state is observable in
        // the same render).
        selection.clear();
        setRefreshKey((k) => k + 1);
        setConfirm(null);
        rootRef.current?.focus();
      } finally {
        setIsDeleting(false);
      }
    },
    [channel.request, selection, toast],
  );

  const handleRequestDelete = useCallback(async () => {
    const paths = Array.from(selection.state.selected);
    if (paths.length === 0) return;
    const namesByPath = new Map(visibleEntries.map((e) => [e.path, e.name]));
    const names = paths.map((p) => namesByPath.get(p) ?? p);
    if (paths.length === 1 && suppressSingleDeleteConfirm) {
      // Skip the dialog for session-suppressed single-file deletes.
      await performDelete(paths);
    } else {
      setConfirm({ kind: 'delete', paths, names });
    }
  }, [
    selection.state.selected,
    visibleEntries,
    suppressSingleDeleteConfirm,
    performDelete,
  ]);

  // ----- Move to… / Copy to… : open the FolderPickerModal -----
  const handleMoveTo = useCallback(() => {
    if (selection.state.selected.size === 0) return;
    setPicker({ kind: 'move' });
  }, [selection.state.selected.size]);

  const handleCopyTo = useCallback(() => {
    if (selection.state.selected.size === 0) return;
    setPicker({ kind: 'copy' });
  }, [selection.state.selected.size]);

  // Disallowed destinations for the picker:
  //   - The current parent folder (no-op move/copy into the same place).
  //   - For Move: the source paths themselves (move-into-self for folders).
  // Deeper move-into-self (a descendant of any source folder) is caught at
  // the wire level by the desktop's ALLOWLIST_VIOLATION / IO_ERROR
  // responses; a complete in-UI ancestor check is Phase 12 hardening.
  const pickerDisallowedPaths = useMemo<string[]>(() => {
    const out = new Set<string>();
    if (state.currentPath) out.add(state.currentPath);
    if (picker?.kind === 'move') {
      for (const p of selection.state.selected) out.add(p);
    }
    return Array.from(out);
  }, [state.currentPath, picker, selection.state.selected]);

  // performMoveOrCopy fires files.move / files.copy sequentially over the
  // selected source paths. Sequential (NOT Promise.all) so error reporting
  // stays clean and the desktop is never hammered. Wraps the loop in
  // try/finally so isOperating is always reset.
  const performMoveOrCopy = useCallback(
    async (kind: 'move' | 'copy', dstParent: string) => {
      const request = channel.request;
      if (!request) {
        toast.error('Files channel disconnected');
        return;
      }
      const srcs = Array.from(selection.state.selected);
      const namesByPath = new Map(visibleEntries.map((e) => [e.path, e.name]));
      const sep = detectSeparator(dstParent);
      setIsOperating(true);
      try {
        for (const src of srcs) {
          const name =
            namesByPath.get(src) ?? src.split(/[\\/]/).pop() ?? src;
          const dst = joinPath([dstParent, name], sep);
          try {
            await request<
              { src: string; dst: string },
              { src: string; dst: string }
            >(kind === 'move' ? 'files.move' : 'files.copy', { src, dst });
          } catch (err: unknown) {
            toast.error(mapFilesErrorToMessage(err));
          }
        }
        selection.clear();
        setRefreshKey((k) => k + 1);
        setPicker(null);
        rootRef.current?.focus();
      } finally {
        setIsOperating(false);
      }
    },
    [channel.request, selection, visibleEntries, toast],
  );

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
            danger: true,
            onSelect: () => {
              void handleRequestDelete();
            },
          },
          {
            label: 'Move to…',
            onSelect: handleMoveTo,
          },
          {
            label: 'Copy to…',
            onSelect: handleCopyTo,
          },
        ],
      });
    },
    [
      selection,
      visibleEntries,
      handleRequestDelete,
      handleMoveTo,
      handleCopyTo,
    ],
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
          onDelete={() => {
            void handleRequestDelete();
          }}
          onMoveTo={handleMoveTo}
          onCopyTo={handleCopyTo}
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
        <TransferQueuePanel queue={queue} />
      </div>
      <ContextMenu state={contextMenu} onClose={handleContextMenuClose} />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title="Delete"
        body={
          confirm && confirm.paths.length === 1 ? (
            <p>Delete &quot;{confirm.names[0]}&quot;? This cannot be undone.</p>
          ) : confirm ? (
            <>
              <p>
                Delete these {confirm.names.length} items? This cannot be
                undone.
              </p>
              <ul className="mt-2 text-sm list-disc pl-5">
                {confirm.names.slice(0, 5).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              {confirm.names.length > 5 && (
                <p className="mt-1 text-sm text-darkgray">
                  and {confirm.names.length - 5} more…
                </p>
              )}
            </>
          ) : null
        }
        confirmLabel="Delete"
        dangerous
        isBusy={isDeleting}
        checkbox={
          confirm &&
          confirm.paths.length === 1 &&
          !suppressSingleDeleteConfirm
            ? {
                label:
                  "Don't ask again for single-file deletes in this session",
                checked: suppressSingleDeleteConfirm,
                onChange: setSuppressSingleDeleteConfirm,
              }
            : undefined
        }
        onConfirm={async () => {
          if (confirm) {
            await performDelete(confirm.paths);
          }
        }}
        onCancel={() => {
          if (!isDeleting) setConfirm(null);
        }}
      />
      <FolderPickerModal
        open={picker !== null}
        title={picker?.kind === 'move' ? 'Move to…' : 'Copy to…'}
        confirmLabel={picker?.kind === 'move' ? 'Move' : 'Copy'}
        channel={channel}
        disallowedPaths={pickerDisallowedPaths}
        isBusy={isOperating}
        onConfirm={(destinationPath) => {
          if (picker) {
            void performMoveOrCopy(picker.kind, destinationPath);
          }
        }}
        onCancel={() => {
          if (!isOperating) setPicker(null);
        }}
      />
    </div>
  );
}
