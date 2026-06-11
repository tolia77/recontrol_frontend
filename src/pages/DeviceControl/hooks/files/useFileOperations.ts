import React, { useCallback } from "react";
import type { RefObject } from "react";
import type { TFunction } from "i18next";
import { FilesChannelError } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import type { FileEntry, NameConflictMode } from "src/pages/DeviceControl/services/files/filesProtocol.generated";
import type { UseFilesChannel } from "src/pages/DeviceControl/hooks/realtime/useFilesChannel";
import type { FileManagerUiAction } from "src/pages/DeviceControl/components/FileManager/fileManagerUiReducer";
import { mapFilesErrorToMessage } from "src/pages/DeviceControl/components/FileManager/utils/errors";
import { detectSeparator, isAncestor, joinPath } from "src/pages/DeviceControl/components/FileManager/utils/pathUtils";
import type { useFileManagerSelection } from "src/pages/DeviceControl/hooks/state/useFileManagerSelection";

interface MkdirResponse {
  path: string;
}
interface RenameResponse {
  path: string;
}

export interface UseFileOperationsOptions {
  channel: UseFilesChannel;
  currentPath: string | null;
  /** The whole useFileManagerSelection result, passed from the container. */
  selection: ReturnType<typeof useFileManagerSelection>;
  visibleEntries: FileEntry[];
  /**
   * Session-scoped flag: when true, single-file deletes skip the confirm dialog.
   * Read from the container's reducer state (fileManagerUiState.suppressSingleDeleteConfirm).
   */
  suppressSingleDeleteConfirm: boolean;
  /** Dispatches reducer actions to open/close dialogs + set busy flags. */
  dispatch: React.Dispatch<FileManagerUiAction>;
  /** Container-provided: opens NameConflictDialog, resolves choice. */
  requestConflictDecision: (
    operation: "upload" | "move" | "copy",
    fileName: string,
    destinationPath: string,
  ) => Promise<{ mode: NameConflictMode; applyToAll: boolean }>;
  onRefresh: () => void;
  rootRef: RefObject<HTMLDivElement | null>;
  toast: {
    info: (message: string) => void;
    error: (message: string) => void;
    success: (message: string) => void;
    warning: (message: string) => void;
  };
  t: TFunction<"fileManager">;
}

export interface UseFileOperationsReturn {
  createFolder: (name: string) => void;
  cancelNewFolder: () => void;
  commitRename: (path: string, newName: string) => void;
  cancelRename: () => void;
  armRename: (path: string) => void;
  requestDelete: () => Promise<void>;
  /** Called by the container's confirm dialog onConfirm handler. */
  performDelete: (paths: string[]) => Promise<void>;
  openMovePicker: () => void;
  openCopyPicker: () => void;
  performMoveOrCopy: (kind: "move" | "copy", dstParent: string) => Promise<void>;
  copyPathToClipboard: (path: string) => Promise<void>;
}

/**
 * Manages all FileManager CRUD operations over the files-ctl channel.
 *
 * Owns: mkdir/rename/delete/move/copy + their sequential loops + commit/cancel/arm
 * handlers. All operations null-guard `channel.request`, surface errors via
 * `toast.error(mapFilesErrorToMessage(err, t))`, and never swallow silently.
 *
 * Design invariants:
 *   - Dispatches against the Plan 27-01 reducer (FileManagerUiAction) instead of
 *     owning local state (D-03). Replaces setIsDeleting/setIsOperating/setNewFolderPending/
 *     setRenamingPath etc. with dispatch actions.
 *   - The `isAncestor` self-nest/path-traversal guard from pathUtils is preserved
 *     verbatim in performMoveOrCopy (T-27-04).
 *   - delete/move/copy loops are sequential (NOT Promise.all) for clean error
 *     reporting and to avoid hammering the desktop in parallel.
 *   - try/finally ensures isDeleting/isOperating are always reset.
 *   - requestDelete skips the confirm dialog for single-file deletes when
 *     suppressSingleDeleteConfirm is true (D-05 commit-on-confirm semantics).
 */
export function useFileOperations({
  channel,
  currentPath,
  selection,
  visibleEntries,
  suppressSingleDeleteConfirm,
  dispatch,
  requestConflictDecision,
  onRefresh,
  rootRef,
  toast,
  t,
}: UseFileOperationsOptions): UseFileOperationsReturn {

  // Delete flow
  // performDelete fires files.delete sequentially over the captured paths.
  // Sequential (NOT Promise.all) so error reporting stays clean and so the
  // remote desktop is never hammered in parallel. Wraps the loop in
  // try/finally so isDeleting is always reset, even on uncaught rejection.
  // No optimistic UI (Pitfall 3): the listing is only refreshed AFTER wire
  // calls resolve. On error, surfaces a toast and STILL refreshes.
  const performDelete = useCallback(
    async (paths: string[]) => {
      const request = channel.request;
      if (!request) {
        toast.error(t("panel.filesChannelDisconnected"));
        return;
      }
      dispatch({ type: "SET_DELETING", payload: true });
      try {
        for (const p of paths) {
          try {
            await request<{ path: string }, Record<string, never>>(
              "files.delete",
              { path: p },
            );
          } catch (err: unknown) {
            toast.error(mapFilesErrorToMessage(err, t));
          }
        }
        // Clear selection on success (and on partial-failure: the
        // entries-array-identity bump from onRefresh would clear it
        // anyway; we clear explicitly so the cleared state is observable
        // in the same render).
        selection.clear();
        onRefresh();
        dispatch({ type: "CLOSE_DELETE_CONFIRM" });
        rootRef.current?.focus();
      } finally {
        dispatch({ type: "SET_DELETING", payload: false });
      }
    },
    [channel.request, selection, onRefresh, rootRef, dispatch, toast, t],
  );

  const requestDelete = useCallback(async () => {
    const paths = Array.from(selection.state.selected);
    if (paths.length === 0) return;
    const namesByPath = new Map(visibleEntries.map((e) => [e.path, e.name]));
    const names = paths.map((p) => namesByPath.get(p) ?? p);
    if (paths.length === 1 && suppressSingleDeleteConfirm) {
      // Skip the dialog for session-suppressed single-file deletes.
      await performDelete(paths);
    } else {
      dispatch({
        type: "OPEN_DELETE_CONFIRM",
        payload: { paths, names },
      });
    }
  }, [
    selection.state.selected,
    visibleEntries,
    suppressSingleDeleteConfirm,
    performDelete,
    dispatch,
  ]);

  // Move / Copy flow
  // performMoveOrCopy fires files.move / files.copy sequentially over the
  // selected source paths. Wraps the loop in try/finally so isOperating is
  // always reset. Preserves the isAncestor guard (T-27-04).
  const performMoveOrCopy = useCallback(
    async (kind: "move" | "copy", dstParent: string) => {
      const request = channel.request;
      if (!request) {
        toast.error(t("panel.filesChannelDisconnected"));
        return;
      }
      const srcs = Array.from(selection.state.selected);
      const namesByPath = new Map(visibleEntries.map((e) => [e.path, e.name]));
      const sep = detectSeparator(dstParent);
      dispatch({ type: "SET_OPERATING", payload: true });
      try {
        let rememberedMode: NameConflictMode | null = null;
        for (const src of srcs) {
          const name = namesByPath.get(src) ?? src.split(/[\\/]/).pop() ?? src;
          const dst = joinPath([dstParent, name], sep);
          // isAncestor guard: prevent move/copy into a descendant of the source
          // (path-traversal / self-nest guard — T-27-04).
          if (isAncestor(src, dstParent)) {
            toast.error(t("panel.cannotMoveIntoSelf"));
            continue;
          }
          let mode: NameConflictMode = rememberedMode ?? "fail";
          while (true) {
            try {
              await request<
                { src: string; dst: string; mode: NameConflictMode },
                { src: string; dst: string }
              >(kind === "move" ? "files.move" : "files.copy", {
                src,
                dst,
                mode,
              });
              break;
            } catch (err: unknown) {
              if (
                err instanceof FilesChannelError &&
                err.info.code === "NAME_CONFLICT"
              ) {
                const choice = await requestConflictDecision(kind, name, dst);
                console.debug("[files] conflict choice", {
                  operation: kind,
                  mode: choice.mode,
                  destinationPath: dst,
                });
                if (choice.applyToAll) rememberedMode = choice.mode;
                if (choice.mode === "skip") break;
                mode = choice.mode;
                continue;
              }
              toast.error(mapFilesErrorToMessage(err, t));
              break;
            }
          }
        }
        selection.clear();
        onRefresh();
        dispatch({ type: "CLOSE_PICKER" });
        rootRef.current?.focus();
      } finally {
        dispatch({ type: "SET_OPERATING", payload: false });
      }
    },
    [
      channel.request,
      selection,
      visibleEntries,
      dispatch,
      requestConflictDecision,
      onRefresh,
      rootRef,
      toast,
      t,
    ],
  );

  // mkdir commit / cancel
  const createFolder = useCallback(
    (name: string) => {
      const request = channel.request;
      if (!request || !currentPath) {
        dispatch({ type: "CLOSE_NEW_FOLDER" });
        return;
      }
      // Empty input: treat as cancel rather than firing an INVALID_NAME EMPTY
      // round-trip just to surface a toast.
      if (name.trim().length === 0) {
        dispatch({ type: "CLOSE_NEW_FOLDER" });
        return;
      }
      request<{ parentPath: string; name: string }, MkdirResponse>(
        "files.mkdir",
        { parentPath: currentPath, name },
      )
        .then(() => {
          dispatch({ type: "CLOSE_NEW_FOLDER" });
          selection.clear();
          onRefresh();
          // Return focus to the panel so F5 / arrows work without a click.
          rootRef.current?.focus();
        })
        .catch((err: unknown) => {
          // Keep the editor open so the user can correct + retry (Pitfall 3).
          toast.error(mapFilesErrorToMessage(err, t));
        });
    },
    [channel.request, currentPath, dispatch, selection, onRefresh, rootRef, toast, t],
  );

  const cancelNewFolder = useCallback(
    () => dispatch({ type: "CLOSE_NEW_FOLDER" }),
    [dispatch],
  );

  // rename commit / cancel
  const commitRename = useCallback(
    (path: string, newName: string) => {
      const request = channel.request;
      if (!request) {
        dispatch({ type: "CLOSE_RENAME" });
        return;
      }
      const trimmed = newName.trim();
      // No-op: if user pressed Enter without changing the name, just cancel.
      const currentName =
        visibleEntries.find((e) => e.path === path)?.name ?? "";
      if (trimmed.length === 0 || trimmed === currentName) {
        dispatch({ type: "CLOSE_RENAME" });
        return;
      }
      request<{ path: string; newName: string }, RenameResponse>(
        "files.rename",
        { path, newName },
      )
        .then(() => {
          dispatch({ type: "CLOSE_RENAME" });
          selection.clear();
          onRefresh();
          rootRef.current?.focus();
        })
        .catch((err: unknown) => {
          toast.error(mapFilesErrorToMessage(err, t));
        });
    },
    [channel.request, visibleEntries, dispatch, selection, onRefresh, rootRef, toast, t],
  );

  const cancelRename = useCallback(
    () => dispatch({ type: "CLOSE_RENAME" }),
    [dispatch],
  );

  // Second-click-to-rename arming (from listing's row-click handler)
  const armRename = useCallback(
    (path: string) => {
      dispatch({ type: "CLOSE_NEW_FOLDER" });
      dispatch({ type: "OPEN_RENAME", payload: path });
    },
    [dispatch],
  );

  // Move to… / Copy to… : open the FolderPickerModal
  const openMovePicker = useCallback(() => {
    if (selection.state.selected.size === 0) return;
    dispatch({ type: "OPEN_MOVE_PICKER" });
  }, [dispatch, selection.state.selected.size]);

  const openCopyPicker = useCallback(() => {
    if (selection.state.selected.size === 0) return;
    dispatch({ type: "OPEN_COPY_PICKER" });
  }, [dispatch, selection.state.selected.size]);

  // Copy path to clipboard
  const copyPathToClipboard = useCallback(
    async (path: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(path);
          toast.success(t("panel.pathCopied"));
          return;
        }
      } catch {
        // Fall back to execCommand below.
      }

      const textarea = document.createElement("textarea");
      textarea.value = path;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      try {
        const copied = document.execCommand("copy");
        if (copied) {
          toast.success(t("panel.pathCopied"));
          return;
        }
      } finally {
        document.body.removeChild(textarea);
      }

      toast.error(t("panel.couldNotCopyPath"));
    },
    [toast, t],
  );

  return {
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
  };
}
