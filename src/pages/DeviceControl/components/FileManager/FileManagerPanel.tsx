import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent, RefObject } from 'react';
import { useToast } from 'src/components/ui';
import type { UseFilesChannel } from '../../hooks/useFilesChannel';
import { useFilesRoots } from '../../hooks/useFilesRoots';
import { useFileManagerSelection } from '../../hooks/useFileManagerSelection';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { FileEntry } from '../../services/files';
import type {
  ContextMenuItem,
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
import { DropZoneOverlay } from './DropZoneOverlay';
import { LargeFileWarningDialog } from './LargeFileWarningDialog';
import { DownloadBlockedDialog } from './DownloadBlockedDialog';
import type {
  DownloadTransfer,
  TransferItem,
  TransferQueue,
} from '../../services/transfer';
import {
  detectSeparator,
  isAncestor,
  joinPath,
  parentPath,
} from './utils/pathUtils';
import { mapFilesErrorToMessage } from './utils/errors';

/**
 * 100 MiB upload-warning threshold (TRANSFER-06). The CONTEXT-locked check is
 * binary MiB; the dialog displays decimal MB for user-facing copy.
 */
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;

interface FileManagerPanelProps {
  /** Used for storage keying in parent hooks; included for completeness. */
  deviceId: string;
  channel: UseFilesChannel;
  state: FileManagerState;
  setCurrentPath: (p: string | null) => void;
  setSort: (s: SortState) => void;
  setShowHidden: (v: boolean) => void;
  queue: TransferQueue;
  filesByItemIdRef: RefObject<Map<string, File>>;
  activeDownloadRef: RefObject<DownloadTransfer | null>;
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
  queue,
  filesByItemIdRef,
  activeDownloadRef,
}: FileManagerPanelProps) {
  const rootsResult = useFilesRoots(channel);

  const toast = useToast();

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
  // ----- Plan 11-04: upload flow state -----
  // dragActive renders the DropZoneOverlay; dragDepthRef counts dragenter /
  // dragleave events so internal panel boundaries (toolbar / breadcrumb /
  // listing rows) do NOT flicker the overlay (Pitfall 6).
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const rightColumnRef = useRef<HTMLDivElement>(null);
  // Sequential 100 MiB warning queue for a drop / upload-pick batch. Each
  // dropped file walks through this state machine: small files enqueue
  // immediately and advance the index; large files render the dialog and
  // wait for Confirm / Cancel before advancing.
  const [pendingWarn, setPendingWarn] = useState<{
    files: File[];
    index: number;
  } | null>(null);
  // ----- Plan 11-05: download flow state -----
  // downloadBlocked renders the non-Chromium >100 MiB modal (no Try Anyway
  // escape hatch -- discoverability of the blocking reason beats silent
  // suppression; CONTEXT-locked).
  const [downloadBlocked, setDownloadBlocked] = useState<{
    name: string;
    size: number;
  } | null>(null);
  // pendingDownloadWarn renders the LargeFileWarningDialog (reused from Plan
  // 11-04) for Chromium browsers that DO have showSaveFilePicker but where
  // the file is still > 100 MiB.
  const [pendingDownloadWarn, setPendingDownloadWarn] =
    useState<FileEntry | null>(null);
  // ----- Plan 11-06: disconnect banner state -----
  // CONTEXT-locked verbatim copy: "Disconnected during transfer. Reconnect
  // and try again." Set when channel.status transitions OUT of 'open' while
  // a transfer is active; cleared when the user clicks the X dismiss button
  // OR when a new transfer starts (queue.activeId becomes non-null).
  const [disconnectBanner, setDisconnectBanner] = useState<string | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);

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

  // ----- Plan 11-04: enqueue + 100 MiB warning gate -----
  // enqueueFile mints a TransferItem and stores the source File in the panel-
  // owned Map. The runner reads the File via getFile at chunk-loop time.
  const enqueueFile = useCallback(
    (file: File) => {
      if (!state.currentPath) return;
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      filesByItemIdRef.current?.set(id, file);
      const item: TransferItem = {
        id,
        transferId: null,
        direction: 'upload',
        name: file.name,
        parentPath: state.currentPath,
        size: file.size,
        bytesSoFar: 0,
        state: 'queued',
        enqueuedAt: Date.now(),
      };
      queue.enqueue(item);
    },
    [state.currentPath, queue],
  );

  // handleUploadFiles is the single entry point for both drop + Upload-button
  // flows. It seeds the sequential warning state machine with the batch.
  const handleUploadFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    setPendingWarn({ files, index: 0 });
  }, []);

  // Sequential warning processor: walks the batch one file at a time. Small
  // files (<= 100 MiB) enqueue immediately and advance the index. Large files
  // park here and let the dialog drive the next state transition via Confirm
  // (enqueue + advance) or Cancel (skip + advance).
  useEffect(() => {
    if (!pendingWarn) return;
    const { files, index } = pendingWarn;
    if (index >= files.length) {
      setPendingWarn(null);
      return;
    }
    const f = files[index];
    if (f.size <= LARGE_FILE_THRESHOLD) {
      enqueueFile(f);
      setPendingWarn({ files, index: index + 1 });
    }
    // else: dialog renders below; user clicks Confirm or Cancel to advance.
  }, [pendingWarn, enqueueFile]);

  const handleWarningConfirm = useCallback(() => {
    setPendingWarn((prev) => {
      if (!prev) return prev;
      enqueueFile(prev.files[prev.index]);
      return { files: prev.files, index: prev.index + 1 };
    });
  }, [enqueueFile]);

  const handleWarningCancel = useCallback(() => {
    setPendingWarn((prev) => {
      if (!prev) return prev;
      // Skip this file (no enqueue) and advance.
      return { files: prev.files, index: prev.index + 1 };
    });
  }, []);

  // ----- Plan 11-04: drag-and-drop handlers attached to the right column -----
  // The handlers attach to rightColumnRef (NOT the panel root) so the sidebar
  // stays unobscured by the overlay. preventDefault on dragenter + dragover is
  // REQUIRED for the drop event to fire (W3C drag-drop anti-pattern). The
  // depth counter prevents the overlay from flickering as drag events bubble
  // through nested children inside the right column (Pitfall 6).
  useEffect(() => {
    const el = rightColumnRef.current;
    if (!el) return;

    const hasFiles = (e: DragEvent): boolean =>
      Array.from(e.dataTransfer?.types ?? []).includes('Files');

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      if (dragDepthRef.current === 1) setDragActive(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = () => {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setDragActive(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepthRef.current = 0;
      setDragActive(false);

      if (!state.currentPath) {
        toast.info('Navigate to a folder first.');
        return;
      }
      // Folder detection (Pitfall 5: webkitGetAsEntry returns null for non-
      // file items, so filter kind === 'file' BEFORE calling it).
      const items = Array.from(e.dataTransfer?.items ?? []);
      const entries = items
        .filter((i) => i.kind === 'file')
        .map((i) => {
          const item = i as DataTransferItem & {
            webkitGetAsEntry?: () => FileSystemEntry | null;
          };
          return item.webkitGetAsEntry?.() ?? null;
        })
        .filter((entry): entry is FileSystemEntry => entry !== null);

      if (entries.some((entry) => entry.isDirectory)) {
        toast.info("Folder upload isn't supported yet.");
        return;
      }

      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) handleUploadFiles(files);
    };

    el.addEventListener('dragenter', onEnter);
    el.addEventListener('dragover', onOver);
    el.addEventListener('dragleave', onLeave);
    el.addEventListener('drop', onDrop);
    return () => {
      el.removeEventListener('dragenter', onEnter);
      el.removeEventListener('dragover', onOver);
      el.removeEventListener('dragleave', onLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [state.currentPath, toast, handleUploadFiles]);

  // ----- Selection state (shared between listing + keyboard handler + status) -----
  const selection = useFileManagerSelection(visibleEntries);

  // ----- Plan 11-05: download trigger + capability gate + warning gate -----
  // enqueueDownload mints a download TransferItem and pushes it onto the queue.
  // The runner closes over channel deps via the live-ref bridges set up at the
  // top of this component.
  const enqueueDownload = useCallback(
    (entry: FileEntry) => {
      if (!state.currentPath) return; // file rows imply we're inside a folder
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item: TransferItem = {
        id,
        transferId: null,
        direction: 'download',
        name: entry.name,
        parentPath: state.currentPath,
        size: entry.sizeBytes,
        bytesSoFar: 0,
        state: 'queued',
        enqueuedAt: Date.now(),
      };
      queue.enqueue(item);
    },
    [state.currentPath, queue],
  );

  // triggerDownload is the SINGLE chokepoint for download invocation. Capability
  // detection (NOT user-agent sniffing -- CONTEXT-locked) lives here:
  //   - showSaveFilePicker function present + size > 100 MiB -> reuse the
  //     LargeFileWarningDialog from Plan 11-04 with direction='download'.
  //   - showSaveFilePicker function MISSING + size > 100 MiB -> open the
  //     DownloadBlockedDialog with verbatim CONTEXT-locked copy.
  //   - Otherwise enqueue immediately.
  // 100 MiB cutoff via `size > 100 * 1024 * 1024` matches Plan 11-04's upload
  // threshold; the dialog renders the figure as decimal MB (Math.round / 1e6).
  const triggerDownload = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) return; // DOWNLOAD-02
      if (entry.sizeBytes > LARGE_FILE_THRESHOLD) {
        const hasFsa =
          typeof (window as { showSaveFilePicker?: unknown })
            .showSaveFilePicker === 'function';
        if (!hasFsa) {
          setDownloadBlocked({ name: entry.name, size: entry.sizeBytes });
          return;
        }
        setPendingDownloadWarn(entry);
        return;
      }
      enqueueDownload(entry);
    },
    [enqueueDownload],
  );

  // ----- Activation: Enter on focused row OR double-click on a row -----
  const handleActivate = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) {
        setCurrentPath(entry.path);
      } else {
        triggerDownload(entry);
      }
    },
    [setCurrentPath, triggerDownload],
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
      // Plan 11-05: prepend a "Download" item ABOVE Rename for FILE rows only.
      // Folder rows hide the Download item entirely (DOWNLOAD-02). The menu
      // shape from Plan 10-04/10-05 (Rename / sep / Delete / Move / Copy) is
      // preserved for both branches.
      const baseItems: ContextMenuItem[] = [
        {
          label: 'Rename',
          onSelect: () => {
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
      ];
      const items: ContextMenuItem[] = entry.isDirectory
        ? baseItems
        : [
            {
              label: 'Download',
              onSelect: () => triggerDownload(entry),
            },
            { separator: true, label: '', onSelect: () => {} },
            ...baseItems,
          ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [
      selection,
      visibleEntries,
      handleRequestDelete,
      handleMoveTo,
      handleCopyTo,
      triggerDownload,
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

  // ----- Plan 11-06: disconnect listener -----
  // SINGLE SOURCE OF TRUTH = useFilesChannel().status. We do NOT spin up
  // a parallel pc-state listener; that would risk racing the existing
  // state machine. On every render, compare the previous status to the
  // current; on a transition OUT of 'open' while there is an active
  // transfer, cancel it (state -> 'disconnected') and surface the literal
  // banner. Queued items stay queued (CONTEXT-locked: the user must
  // manually re-trigger from the source folder).
  const prevStatusRef = useRef(channel.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = channel.status;
    prevStatusRef.current = curr;
    if (prev === 'open' && curr !== 'open') {
      const snap = queue.getSnapshot();
      const active = snap.items.find((i) => i.id === snap.activeId);
      if (active) {
        // queue.cancelById flips state to 'cancelling' (or removes a
        // 'queued' item); follow up with the 'disconnected' patch so the
        // row's terminal state is unambiguous and renders the red bar.
        queue.cancelById(active.id);
        queue.updateItem(active.id, {
          state: 'disconnected',
          error: {
            code: 'CHANNEL_NOT_OPEN',
            message: 'Disconnected during transfer.',
          },
          completedAt: Date.now(),
        });
      }
      setDisconnectBanner(
        'Disconnected during transfer. Reconnect and try again.',
      );
    }
  }, [channel.status, queue]);

  // ----- Plan 11-06: auto-clear banner when a new transfer starts -----
  // Subscribes to queue snapshots; whenever activeId becomes non-null the
  // banner clears implicitly. Manual dismiss (X button) is the other clear
  // path. Both are CONTEXT-locked.
  useEffect(() => {
    return queue.subscribe((snap) => {
      if (snap.activeId !== null) {
        setDisconnectBanner((prev) => (prev !== null ? null : prev));
      }
    });
  }, [queue]);

  // ----- Plan 11-06: 1 s stall interval (download + upload recovery) -----
  // Downloads: read activeDownloadRef.current.lastChunkAtMs against
  // Date.now(); flip to 'stalled' past 10 s, back to 'active' when bytes
  // resume. Uploads: the desktop pushes STALLED via the separate event
  // listener below. Recovery from 'stalled' for uploads is detected here
  // by tracking bytesSoFar deltas across ticks (a delta > 0 means bytes
  // are flowing again).
  const prevBytesRef = useRef<{ id: string | null; bytes: number }>({
    id: null,
    bytes: 0,
  });
  useEffect(() => {
    const id = window.setInterval(() => {
      const snap = queue.getSnapshot();
      const active = snap.items.find((i) => i.id === snap.activeId);
      if (!active) {
        prevBytesRef.current = { id: null, bytes: 0 };
        return;
      }

      if (active.direction === 'download') {
        const t = activeDownloadRef.current;
        if (!t) return;
        const ageMs = Date.now() - t.lastChunkAtMs;
        if (ageMs > 10_000 && active.state === 'active') {
          queue.updateItem(active.id, { state: 'stalled' });
        } else if (ageMs <= 10_000 && active.state === 'stalled') {
          queue.updateItem(active.id, { state: 'active' });
        }
        return;
      }

      // Upload: stall detection itself is push-driven (desktop's
      // StallMonitor). RECOVERY from 'stalled' is local: when bytesSoFar
      // moves between ticks AND the row is currently 'stalled', flip back
      // to 'active'. Track previous bytesSoFar in a ref keyed by item.id
      // so a fresh active-id resets the baseline cleanly.
      if (active.direction === 'upload') {
        const prev = prevBytesRef.current;
        if (prev.id !== active.id) {
          prevBytesRef.current = { id: active.id, bytes: active.bytesSoFar };
          return;
        }
        if (
          active.bytesSoFar > prev.bytes &&
          active.state === 'stalled'
        ) {
          queue.updateItem(active.id, { state: 'active' });
        }
        prevBytesRef.current = { id: active.id, bytes: active.bytesSoFar };
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [queue]);

  // ----- Plan 11-06: upload-side STALLED event subscription -----
  // The upload runner is busy in its chunk loop and does NOT subscribe to
  // files-ctl events. The panel takes over: any STALLED event whose
  // transferId matches the active UPLOAD item flips that row to 'stalled'.
  // Downloads handle their own STALLED inside runDownload (Task 2A).
  useEffect(() => {
    const client = channel.filesClient;
    if (!client) return;
    const off = client.onEvent('files.transfer.error', (payload) => {
      const p = payload as {
        transferId: number;
        error: { code: string };
      };
      if (!p || p.error?.code !== 'STALLED') return;
      const snap = queue.getSnapshot();
      const item = snap.items.find((i) => i.transferId === p.transferId);
      if (!item || item.direction !== 'upload') return;
      if (item.state !== 'active') return;
      queue.updateItem(item.id, { state: 'stalled' });
    });
    return off;
  }, [channel.filesClient, queue]);

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
      <div
        ref={rightColumnRef}
        className="flex-1 flex flex-col min-w-0 min-h-0 relative"
      >
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
          onUploadFiles={handleUploadFiles}
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
        <TransferQueuePanel
          queue={queue}
          disconnectMessage={disconnectBanner}
          onDismissDisconnect={() => setDisconnectBanner(null)}
        />
        {dragActive && <DropZoneOverlay />}
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
      <LargeFileWarningDialog
        open={
          !!pendingWarn &&
          pendingWarn.index < pendingWarn.files.length &&
          pendingWarn.files[pendingWarn.index].size > LARGE_FILE_THRESHOLD
        }
        fileName={
          pendingWarn && pendingWarn.index < pendingWarn.files.length
            ? pendingWarn.files[pendingWarn.index].name
            : ''
        }
        sizeBytes={
          pendingWarn && pendingWarn.index < pendingWarn.files.length
            ? pendingWarn.files[pendingWarn.index].size
            : 0
        }
        direction="upload"
        onConfirm={handleWarningConfirm}
        onCancel={handleWarningCancel}
      />
      <DownloadBlockedDialog
        open={downloadBlocked !== null}
        fileName={downloadBlocked?.name ?? ''}
        sizeBytes={downloadBlocked?.size ?? 0}
        onClose={() => setDownloadBlocked(null)}
      />
      <LargeFileWarningDialog
        open={pendingDownloadWarn !== null}
        fileName={pendingDownloadWarn?.name ?? ''}
        sizeBytes={pendingDownloadWarn?.sizeBytes ?? 0}
        direction="download"
        onConfirm={() => {
          if (pendingDownloadWarn) enqueueDownload(pendingDownloadWarn);
          setPendingDownloadWarn(null);
        }}
        onCancel={() => setPendingDownloadWarn(null)}
      />
    </div>
  );
}
