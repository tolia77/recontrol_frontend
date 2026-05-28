import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { MouseEvent, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useToast, ConfirmModal } from "src/components/ui";
import type { UseFilesChannel } from "src/pages/DeviceControl/hooks/realtime/useFilesChannel";
import { useFilesRoots } from "src/pages/DeviceControl/hooks/state/useFilesRoots";
import { useFileManagerSelection } from "src/pages/DeviceControl/hooks/state/useFileManagerSelection";
import { useKeyboardShortcuts } from "src/pages/DeviceControl/hooks/useKeyboardShortcuts";
import { useFileUpload } from "src/pages/DeviceControl/hooks/files/useFileUpload";
import { useFileDownload } from "src/pages/DeviceControl/hooks/files/useFileDownload";
import { useFileDragDrop } from "src/pages/DeviceControl/hooks/files/useFileDragDrop";
import { useFileOperations } from "src/pages/DeviceControl/hooks/files/useFileOperations";
import type { FileEntry, NameConflictMode } from "src/pages/DeviceControl/services/files";
import type {
  ContextMenuItem,
  FileManagerState,
  SortColumn,
} from "./types";
import {
  fileManagerUiReducer,
  initialFileManagerUiState,
} from "./fileManagerUiReducer";
import FileManagerEmptyAllowlist from "./FileManagerEmptyAllowlist";
import ContextMenu from "./ContextMenu";
import FolderPickerModal from "./FolderPickerModal";
import LargeFileWarningDialog from "./LargeFileWarningDialog";
import DownloadBlockedDialog from "./DownloadBlockedDialog";
import NameConflictDialog from "./NameConflictDialog";
import type {
  DownloadTransfer,
  TransferQueue,
} from "src/pages/DeviceControl/services/transfer";
import { detectSeparator, isAncestor, parentPath } from "./utils/pathUtils";
import FileManagerView from "./FileManagerView";

interface FileManagerPanelProps {
  /** Used for storage keying in parent hooks; included for completeness. */
  deviceId: string;
  channel: UseFilesChannel;
  state: FileManagerState;
  setCurrentPath: (p: string | null) => void;
  setSort: (s: import("./types").SortState) => void;
  setShowHidden: (v: boolean) => void;
  queue: TransferQueue;
  filesByItemIdRef: RefObject<Map<string, File>>;
  activeDownloadRef: RefObject<DownloadTransfer | null>;
}

/**
 * Smart container for the file-manager UI (Plan 27-03 / D-01 / D-02).
 *
 * Owns:
 *   - `useReducer(fileManagerUiReducer)` — all dialog/prompt/editing/menu/flow
 *     state (D-03). `refreshKey` and `visibleEntries` stay as plain `useState`
 *     (D-04).
 *   - `pendingResolversRef` — Promise resolver stash for the upload/conflict
 *     prompt gates (D-05). Resolvers live here, NOT in reducer state.
 *   - Four `hooks/files/` hooks: `useFileUpload`, `useFileDownload`,
 *     `useFileDragDrop`, `useFileOperations` (D-06).
 *   - Context-menu item assembly (D-07).
 *   - 6 dialogs + `ContextMenu` rendered directly alongside `<FileManagerView/>`
 *     (D-02) — the view renders no dialogs.
 *
 * The `FileManagerPanelProps` interface and the `DeviceControl.tsx` mount are
 * UNTOUCHED (D-01).
 */
function FileManagerPanel({
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
  const { t } = useTranslation("fileManager");
  const rootsResult = useFilesRoots(channel);
  const toast = useToast();

  // ----- UI-flow reducer (D-03) -----
  const [uiState, dispatch] = useReducer(
    fileManagerUiReducer,
    initialFileManagerUiState,
  );

  // ----- Browse / listing state (D-04: stays as plain useState) -----
  const [refreshKey, setRefreshKey] = useState(0);
  const [visibleEntries, setVisibleEntries] = useState<FileEntry[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);

  // ----- D-05: Promise resolver stash (functions MUST NOT live in reducer) -----
  const pendingResolversRef = useRef<{
    largeUpload?: (approved: boolean) => void;
    conflict?: (choice: { mode: NameConflictMode; applyToAll: boolean }) => void;
  }>({});

  const requestLargeUploadApproval = useCallback(
    (file: File): Promise<boolean> =>
      new Promise((resolve) => {
        dispatch({
          type: "OPEN_LARGE_UPLOAD_WARN",
          payload: { fileName: file.name, sizeBytes: file.size },
        });
        pendingResolversRef.current.largeUpload = resolve;
      }),
    [],
  );

  const requestConflictDecision = useCallback(
    (
      operation: "upload" | "move" | "copy",
      fileName: string,
      destinationPath: string,
    ): Promise<{ mode: NameConflictMode; applyToAll: boolean }> =>
      new Promise((resolve) => {
        dispatch({
          type: "OPEN_CONFLICT_PROMPT",
          payload: { operation, fileName, destinationPath },
        });
        pendingResolversRef.current.conflict = resolve;
      }),
    [],
  );

  // ----- Refresh helper -----
  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // ----- Root / path helpers -----
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
          direction: state.sort.direction === "asc" ? "desc" : "asc",
        });
      } else {
        setSort({ column: col, direction: "asc" });
      }
    },
    [state.sort, setSort],
  );

  const handleSelectRoot = useCallback(
    (path: string) => {
      setCurrentPath(path);
    },
    [setCurrentPath],
  );

  // ----- Selection -----
  const selection = useFileManagerSelection(visibleEntries);

  // ----- Four hooks/files/ hooks (D-06) -----
  const { handleUploadFiles } = useFileUpload({
    queue,
    filesByItemIdRef,
    currentPath: state.currentPath,
    requestLargeUploadApproval,
    requestConflictDecision,
    toast,
    t,
  });

  const { triggerDownload } = useFileDownload({
    queue,
    activeDownloadRef,
    currentPath: state.currentPath,
    onDownloadBlocked: (entry) =>
      dispatch({
        type: "OPEN_DOWNLOAD_BLOCKED",
        payload: { name: entry.name, size: entry.sizeBytes },
      }),
    onPendingDownloadWarn: (entry) =>
      dispatch({ type: "OPEN_DOWNLOAD_WARN", payload: entry }),
  });

  const { dragActive } = useFileDragDrop({
    rightColumnRef,
    currentPath: state.currentPath,
    onFiles: handleUploadFiles,
    toast,
    t,
  });

  const {
    createFolder,
    cancelNewFolder,
    commitRename,
    cancelRename,
    armRename,
    requestDelete,
    performDelete,
    openMovePicker,
    openCopyPicker,
    performMoveOrCopy,
    copyPathToClipboard,
  } = useFileOperations({
    channel,
    currentPath: state.currentPath,
    selection,
    visibleEntries,
    suppressSingleDeleteConfirm: uiState.suppressSingleDeleteConfirm,
    dispatch,
    requestConflictDecision,
    onRefresh: handleRefresh,
    rootRef,
    toast,
    t,
  });

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
    if (state.currentPath === activeRootPath) return;
    const sep = detectSeparator(activeRootPath);
    const parent = parentPath(state.currentPath, sep);
    if (parent === null) return;
    if (parent === activeRootPath || isAncestor(activeRootPath, parent)) {
      setCurrentPath(parent);
    } else {
      setCurrentPath(activeRootPath);
    }
  }, [state.currentPath, activeRootPath, setCurrentPath]);

  // ----- New folder -----
  const handleNewFolder = useCallback(() => {
    if (!state.currentPath) return;
    dispatch({ type: "CLOSE_RENAME" });
    dispatch({ type: "OPEN_NEW_FOLDER" });
  }, [state.currentPath]);

  // ----- Rename -----
  const handleRequestRename = useCallback(() => {
    if (selection.state.selected.size !== 1) return;
    const target = [...selection.state.selected][0];
    dispatch({ type: "CLOSE_NEW_FOLDER" });
    dispatch({ type: "OPEN_RENAME", payload: target });
  }, [selection.state.selected]);

  // ----- Context-menu: row right-click (D-07) -----
  const handleRowContextMenu = useCallback(
    (e: MouseEvent, entry: FileEntry) => {
      if (!selection.state.selected.has(entry.path)) {
        const idx = visibleEntries.findIndex((v) => v.path === entry.path);
        if (idx >= 0) selection.selectOnly(idx);
      }
      const baseItems: ContextMenuItem[] = [
        {
          label: t("panel.contextMenu.copyPath"),
          onSelect: () => {
            void copyPathToClipboard(entry.path);
          },
        },
        { separator: true, label: "", onSelect: () => {} },
        {
          label: t("panel.contextMenu.rename"),
          onSelect: () => {
            dispatch({ type: "CLOSE_NEW_FOLDER" });
            dispatch({ type: "OPEN_RENAME", payload: entry.path });
          },
        },
        { separator: true, label: "", onSelect: () => {} },
        {
          label: t("panel.contextMenu.delete"),
          danger: true,
          onSelect: () => {
            void requestDelete();
          },
        },
        {
          label: t("panel.contextMenu.moveTo"),
          onSelect: openMovePicker,
        },
        {
          label: t("panel.contextMenu.copyTo"),
          onSelect: openCopyPicker,
        },
      ];
      const items: ContextMenuItem[] = entry.isDirectory
        ? baseItems
        : [
            {
              label: t("panel.contextMenu.download"),
              onSelect: () => triggerDownload(entry),
            },
            { separator: true, label: "", onSelect: () => {} },
            ...baseItems,
          ];
      dispatch({
        type: "OPEN_CONTEXT_MENU",
        payload: { x: e.clientX, y: e.clientY, items },
      });
    },
    [
      selection,
      visibleEntries,
      requestDelete,
      openMovePicker,
      openCopyPicker,
      triggerDownload,
      copyPathToClipboard,
      t,
    ],
  );

  // ----- Context-menu: empty-area right-click -----
  const handleEmptyContextMenu = useCallback(
    (e: MouseEvent) => {
      const canMkdir = !!state.currentPath;
      dispatch({
        type: "OPEN_CONTEXT_MENU",
        payload: {
          x: e.clientX,
          y: e.clientY,
          items: [
            {
              label: t("panel.contextMenu.newFolder"),
              disabled: !canMkdir,
              onSelect: handleNewFolder,
            },
          ],
        },
      });
    },
    [state.currentPath, handleNewFolder, t],
  );

  const handleContextMenuClose = useCallback(() => {
    dispatch({ type: "CLOSE_CONTEXT_MENU" });
  }, []);

  // ----- Keyboard handler -----
  const keyboard = useKeyboardShortcuts({
    rootRef,
    enabled:
      channel.status === "open" &&
      uiState.renamingPath === null &&
      !uiState.newFolderPending,
    entries: visibleEntries,
    selection,
    onRefresh: handleRefresh,
    onNavigateUp: handleNavigateUp,
    onActivate: handleActivate,
    onRequestRename: handleRequestRename,
    onRequestDelete: requestDelete,
  });

  // Auto-focus the panel root on mount so F5 / arrows / Esc work immediately.
  const initialFocusedRef = useRef(false);
  useEffect(() => {
    if (initialFocusedRef.current) return;
    if (channel.status !== "open") return;
    if (!rootRef.current) return;
    rootRef.current.focus();
    initialFocusedRef.current = true;
  }, [channel.status]);

  // ----- Disconnect listener -----
  const prevStatusRef = useRef(channel.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    const curr = channel.status;
    prevStatusRef.current = curr;
    if (prev === "open" && curr !== "open") {
      const snap = queue.getSnapshot();
      const active = snap.items.find((i) => i.id === snap.activeId);
      if (active) {
        queue.cancelById(active.id);
        queue.updateItem(active.id, {
          state: "disconnected",
          error: {
            code: "CHANNEL_NOT_OPEN",
            message: t("panel.disconnectedDuringTransferShort"),
          },
          completedAt: Date.now(),
        });
      }
      dispatch({
        type: "SET_DISCONNECT_BANNER",
        payload: t("panel.disconnectedDuringTransfer"),
      });
    }
  }, [channel.status, queue, t]);

  // Auto-clear disconnect banner when a new transfer starts.
  useEffect(() => {
    return queue.subscribe((snap) => {
      if (snap.activeId !== null) {
        dispatch({ type: "SET_DISCONNECT_BANNER", payload: null });
      }
    });
  }, [queue]);

  // Refresh listing when an upload to the current folder completes.
  const seenCompletedUploadsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    return queue.subscribe((snap) => {
      const seen = seenCompletedUploadsRef.current;
      let shouldRefresh = false;
      for (const item of snap.items) {
        if (item.direction !== "upload") continue;
        if (item.state !== "completed") continue;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        if (item.parentPath === state.currentPath) {
          shouldRefresh = true;
        }
      }
      if (shouldRefresh) {
        setRefreshKey((k) => k + 1);
      }
    });
  }, [queue, state.currentPath]);

  // ----- 1s stall interval (download + upload recovery) -----
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

      if (active.direction === "download") {
        const dl = activeDownloadRef.current;
        if (!dl) return;
        const ageMs = Date.now() - dl.lastChunkAtMs;
        if (ageMs > 10_000 && active.state === "active") {
          queue.updateItem(active.id, { state: "stalled" });
        } else if (ageMs <= 10_000 && active.state === "stalled") {
          queue.updateItem(active.id, { state: "active" });
        }
        return;
      }

      if (active.direction === "upload") {
        const prev = prevBytesRef.current;
        if (prev.id !== active.id) {
          prevBytesRef.current = { id: active.id, bytes: active.bytesSoFar };
          return;
        }
        if (active.bytesSoFar > prev.bytes && active.state === "stalled") {
          queue.updateItem(active.id, { state: "active" });
        }
        prevBytesRef.current = { id: active.id, bytes: active.bytesSoFar };
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [queue, activeDownloadRef]);

  // ----- Upload-side STALLED event subscription -----
  useEffect(() => {
    const client = channel.filesClient;
    if (!client) return;
    const off = client.onEvent("files.transfer.error", (payload) => {
      const p = payload as {
        transferId: number;
        error: { code: string };
      };
      if (!p || p.error?.code !== "STALLED") return;
      const snap = queue.getSnapshot();
      const item = snap.items.find((i) => i.transferId === p.transferId);
      if (!item || item.direction !== "upload") return;
      if (item.state !== "active") return;
      queue.updateItem(item.id, { state: "stalled" });
    });
    return off;
  }, [channel.filesClient, queue]);

  // ----- Disallowed paths for the folder picker -----
  const pickerDisallowedPaths = useMemo<string[]>(() => {
    const out = new Set<string>();
    if (uiState.picker?.kind === "move") {
      if (state.currentPath) out.add(state.currentPath);
      for (const p of selection.state.selected) out.add(p);
    } else if (uiState.picker?.kind === "copy") {
      for (const p of selection.state.selected) out.add(p);
    }
    return Array.from(out);
  }, [state.currentPath, uiState.picker, selection.state.selected]);

  // ----- Download warning decision handlers (D-05) -----
  const handleWarningConfirm = useCallback(() => {
    dispatch({ type: "CLOSE_LARGE_UPLOAD_WARN" });
    pendingResolversRef.current.largeUpload?.(true);
    delete pendingResolversRef.current.largeUpload;
  }, []);

  const handleWarningCancel = useCallback(() => {
    dispatch({ type: "CLOSE_LARGE_UPLOAD_WARN" });
    pendingResolversRef.current.largeUpload?.(false);
    delete pendingResolversRef.current.largeUpload;
  }, []);

  // ----- Handle channel-closed placeholder -----
  if (channel.status === "closed" || channel.status === "failed") {
    return (
      <div
        ref={rootRef}
        tabIndex={0}
        className="bg-background text-text text-darkgray flex h-full w-full items-center justify-center p-8 text-center text-sm outline-none"
      >
        {t("channelDisconnected")}
      </div>
    );
  }

  // ----- Handle empty-allowlist state -----
  if (rootsResult.isEmpty) {
    return (
      <div
        ref={rootRef}
        tabIndex={0}
        className="bg-background text-text flex h-full w-full outline-none"
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
      className="bg-background text-text flex h-full w-full outline-none"
    >
      {/* Browsing chrome — presentational view (D-01 / D-08) */}
      <FileManagerView
        channel={channel}
        roots={rootsResult}
        selection={selection}
        rightColumnRef={rightColumnRef}
        dragActive={dragActive}
        activeRootPath={activeRootPath}
        visibleEntries={visibleEntries}
        onRefresh={handleRefresh}
        onNewFolder={handleNewFolder}
        onRequestRename={handleRequestRename}
        onRequestDelete={() => { void requestDelete(); }}
        onMoveTo={openMovePicker}
        onCopyTo={openCopyPicker}
        onUploadFiles={handleUploadFiles}
        onActivate={handleActivate}
        onSelectRoot={handleSelectRoot}
        onNavigate={setCurrentPath}
        onVisibleEntriesChange={setVisibleEntries}
        browse={{
          currentPath: state.currentPath,
          sort: state.sort,
          onToggleSort: handleToggleSort,
          refreshKey,
          showHidden: state.showHidden,
          onToggleShowHidden: setShowHidden,
        }}
        editing={{
          newFolderPending: uiState.newFolderPending,
          renamingPath: uiState.renamingPath,
          onNewFolderCommit: createFolder,
          onNewFolderCancel: cancelNewFolder,
          onRenameCommit: commitRename,
          onRenameCancel: cancelRename,
          onRenameArm: armRename,
        }}
        menu={{
          onRowContextMenu: handleRowContextMenu,
          onEmptyContextMenu: handleEmptyContextMenu,
        }}
        transfer={{
          queue,
          disconnectMessage: uiState.disconnectBanner,
          onDismissDisconnect: () =>
            dispatch({ type: "SET_DISCONNECT_BANNER", payload: null }),
        }}
      />

      {/* 6 dialogs + ContextMenu rendered directly in the container (D-02) */}
      <ContextMenu state={uiState.contextMenu} onClose={handleContextMenuClose} />
      <ConfirmModal
        open={uiState.confirm?.kind === "delete"}
        title={t("dialogs.delete.title")}
        body={
          uiState.confirm && uiState.confirm.paths.length === 1 ? (
            <p>
              {t("dialogs.delete.singleBody", {
                name: uiState.confirm.names[0],
              })}
            </p>
          ) : uiState.confirm ? (
            <>
              <p>
                {t("dialogs.delete.multipleBody", {
                  count: uiState.confirm.names.length,
                })}
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {uiState.confirm.names.slice(0, 5).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              {uiState.confirm.names.length > 5 && (
                <p className="text-darkgray mt-1 text-sm">
                  {t("dialogs.delete.andMore", {
                    count: uiState.confirm.names.length - 5,
                  })}
                </p>
              )}
            </>
          ) : null
        }
        confirmLabel={t("dialogs.delete.confirm")}
        cancelLabel={t("dialogs.cancel")}
        dangerous
        isBusy={uiState.isDeleting}
        checkbox={
          uiState.confirm &&
          uiState.confirm.paths.length === 1 &&
          !uiState.suppressSingleDeleteConfirm
            ? {
                label: t("dialogs.delete.suppressSingleDeleteConfirm"),
                checked: uiState.confirm.suppressOnConfirm,
                onChange: (next) =>
                  dispatch({
                    type: "SET_SUPPRESS_ON_CONFIRM",
                    payload: next,
                  }),
              }
            : undefined
        }
        onConfirm={async () => {
          if (uiState.confirm) {
            if (
              uiState.confirm.paths.length === 1 &&
              uiState.confirm.suppressOnConfirm
            ) {
              dispatch({ type: "COMMIT_SUPPRESS_SINGLE_DELETE" });
            }
            await performDelete(uiState.confirm.paths);
          }
        }}
        onCancel={() => {
          if (!uiState.isDeleting)
            dispatch({ type: "CLOSE_DELETE_CONFIRM" });
        }}
      />
      <FolderPickerModal
        open={uiState.picker !== null}
        title={
          uiState.picker?.kind === "move"
            ? t("dialogs.folderPicker.moveTitle")
            : t("dialogs.folderPicker.copyTitle")
        }
        confirmLabel={
          uiState.picker?.kind === "move"
            ? t("dialogs.folderPicker.moveConfirm")
            : t("dialogs.folderPicker.copyConfirm")
        }
        channel={channel}
        disallowedPaths={pickerDisallowedPaths}
        currentPath={state.currentPath}
        isBusy={uiState.isOperating}
        onConfirm={(destinationPath) => {
          if (uiState.picker) {
            void performMoveOrCopy(uiState.picker.kind, destinationPath);
          }
        }}
        onCancel={() => {
          if (!uiState.isOperating) dispatch({ type: "CLOSE_PICKER" });
        }}
      />
      <LargeFileWarningDialog
        open={uiState.warningPrompt !== null}
        fileName={uiState.warningPrompt?.fileName ?? ""}
        sizeBytes={uiState.warningPrompt?.sizeBytes ?? 0}
        direction="upload"
        onConfirm={handleWarningConfirm}
        onCancel={handleWarningCancel}
      />
      <NameConflictDialog
        open={uiState.conflictPrompt !== null}
        operation={uiState.conflictPrompt?.operation ?? "upload"}
        fileName={uiState.conflictPrompt?.fileName ?? ""}
        destinationPath={uiState.conflictPrompt?.destinationPath ?? ""}
        onDecide={(mode, applyToAll) => {
          dispatch({ type: "CLOSE_CONFLICT_PROMPT" });
          pendingResolversRef.current.conflict?.({ mode, applyToAll });
          delete pendingResolversRef.current.conflict;
        }}
      />
      <DownloadBlockedDialog
        open={uiState.downloadBlocked !== null}
        fileName={uiState.downloadBlocked?.name ?? ""}
        sizeBytes={uiState.downloadBlocked?.size ?? 0}
        onClose={() => dispatch({ type: "CLOSE_DOWNLOAD_BLOCKED" })}
      />
      <LargeFileWarningDialog
        open={uiState.pendingDownloadWarn !== null}
        fileName={uiState.pendingDownloadWarn?.name ?? ""}
        sizeBytes={uiState.pendingDownloadWarn?.sizeBytes ?? 0}
        direction="download"
        onConfirm={() => {
          if (uiState.pendingDownloadWarn) {
            // Enqueue the download directly (no gate for confirms — the user
            // approved). We access the download hook's enqueue path by
            // re-dispatching a re-trigger below the large-file threshold.
            // Instead we pass a tiny helper: just call triggerDownload on a
            // synthetic entry with sizeBytes forced below threshold. Actually,
            // the safest approach is to keep enqueueDownload logic accessible.
            // Since useFileDownload doesn't export enqueueDownload, we mimic
            // the queue.enqueue call here (same pattern as pre-refactor).
            const entry = uiState.pendingDownloadWarn;
            if (entry.path && entry.name) {
              const id =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
              const currentPath = state.currentPath;
              if (currentPath) {
                queue.enqueue({
                  id,
                  transferId: null,
                  direction: "download",
                  name: entry.name,
                  parentPath: currentPath,
                  size: entry.sizeBytes,
                  bytesSoFar: 0,
                  state: "queued",
                  enqueuedAt: Date.now(),
                });
              }
            }
          }
          dispatch({ type: "CLOSE_DOWNLOAD_WARN" });
        }}
        onCancel={() => dispatch({ type: "CLOSE_DOWNLOAD_WARN" })}
      />
    </div>
  );
}

export default FileManagerPanel;
