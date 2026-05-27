import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useToast, ConfirmModal } from "src/components/ui";
import type { UseFilesChannel } from "../../hooks/realtime/useFilesChannel";
import { useFilesRoots } from "../../hooks/state/useFilesRoots";
import { useFileManagerSelection } from "../../hooks/state/useFileManagerSelection";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { FilesChannelError } from "../../services/files";
import type { FileEntry, NameConflictMode } from "../../services/files";
import type {
  ContextMenuItem,
  ContextMenuState,
  FileManagerState,
  SortColumn,
  SortState,
} from "./types";
import { FileManagerToolbar } from "./FileManagerToolbar";
import { FileManagerBreadcrumb } from "./FileManagerBreadcrumb";
import { FileManagerSidebar } from "./FileManagerSidebar";
import { FileManagerListing } from "./FileManagerListing";
import { FileManagerStatusBar } from "./FileManagerStatusBar";
import { FileManagerEmptyAllowlist } from "./FileManagerEmptyAllowlist";
import { ContextMenu } from "./ContextMenu";
import { FolderPickerModal } from "./FolderPickerModal";
import { TransferQueuePanel } from "./TransferQueuePanel";
import { DropZoneOverlay } from "./DropZoneOverlay";
import { LargeFileWarningDialog } from "./LargeFileWarningDialog";
import { DownloadBlockedDialog } from "./DownloadBlockedDialog";
import { NameConflictDialog } from "./NameConflictDialog";
import type {
  DownloadTransfer,
  TransferItem,
  TransferQueue,
} from "../../services/transfer";
import {
  detectSeparator,
  isAncestor,
  joinPath,
  parentPath,
} from "./utils/pathUtils";
import { mapFilesErrorToMessage } from "./utils/errors";

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

interface WarningPrompt {
  file: File;
  resolve: (approved: boolean) => void;
}

interface ConflictPrompt {
  operation: "upload" | "move" | "copy";
  fileName: string;
  destinationPath: string;
  resolve: (choice: { mode: NameConflictMode; applyToAll: boolean }) => void;
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
  const { t } = useTranslation("fileManager");
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
  const [confirm, setConfirm] = useState<{
    kind: "delete";
    paths: string[];
    names: string[];
    // Local pending value for the "Don't ask again" checkbox. Only
    // flushed to suppressSingleDeleteConfirm when the user actually
    // confirms the delete -- otherwise cancelling the dialog must NOT
    // persist the flag. (Prior bug: the checkbox wrote straight to
    // suppressSingleDeleteConfirm, so closing the modal without
    // deleting still suppressed every future single-file delete.)
    suppressOnConfirm: boolean;
  } | null>(null);
  // ----- Plan 10-05: move / copy flow state -----
  // FolderPickerModal mode -- non-null while the picker is open.
  const [picker, setPicker] = useState<null | { kind: "move" | "copy" }>(null);
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
  // Upload warning / conflict prompts are Promise-backed dialog gates used by
  // the batch state machines below.
  const [warningPrompt, setWarningPrompt] = useState<WarningPrompt | null>(
    null,
  );
  const [conflictPrompt, setConflictPrompt] = useState<ConflictPrompt | null>(
    null,
  );
  const uploadBatchRunningRef = useRef(false);
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
  const [disconnectBanner, setDisconnectBanner] = useState<string | null>(null);
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
          direction: state.sort.direction === "asc" ? "desc" : "asc",
        });
      } else {
        setSort({ column: col, direction: "asc" });
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

  // ----- Upload batch helpers: warnings + conflict prompts + queue waits -----
  const enqueueFile = useCallback(
    (
      file: File,
      parentPath: string,
      conflictMode: NameConflictMode = "fail",
    ): string => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      filesByItemIdRef.current?.set(id, file);
      const item: TransferItem = {
        id,
        transferId: null,
        direction: "upload",
        name: file.name,
        parentPath,
        size: file.size,
        bytesSoFar: 0,
        conflictMode,
        state: "queued",
        enqueuedAt: Date.now(),
      };
      queue.enqueue(item);
      return id;
    },
    [queue, filesByItemIdRef],
  );

  const waitForTerminalState = useCallback(
    (itemId: string): Promise<TransferItem> =>
      new Promise((resolve) => {
        const off = queue.subscribe((snap) => {
          const item = snap.items.find((it) => it.id === itemId);
          if (!item) return;
          if (
            item.state === "completed" ||
            item.state === "cancelled" ||
            item.state === "failed" ||
            item.state === "disconnected"
          ) {
            off();
            resolve(item);
          }
        });
      }),
    [queue],
  );

  const requestLargeUploadApproval = useCallback(
    (file: File): Promise<boolean> =>
      new Promise((resolve) => {
        setWarningPrompt({ file, resolve });
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
        setConflictPrompt({ operation, fileName, destinationPath, resolve });
      }),
    [],
  );

  // handleUploadFiles is the single entry point for both drop + Upload-button
  // flows. This runs the batch sequentially so NAME_CONFLICT can pause the
  // batch, prompt once, then resume with replace/skip/keepBoth.
  const handleUploadFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (!state.currentPath) {
        toast.info(t("panel.navigateToFolderFirst"));
        return;
      }
      if (uploadBatchRunningRef.current) {
        toast.info(t("panel.uploadBatchInProgress"));
        return;
      }

      uploadBatchRunningRef.current = true;
      const targetParent = state.currentPath;

      void (async () => {
        let rememberedMode: NameConflictMode | null = null;
        try {
          for (const file of files) {
            if (file.size > LARGE_FILE_THRESHOLD) {
              const approved = await requestLargeUploadApproval(file);
              if (!approved) continue;
            }

            let mode: NameConflictMode = rememberedMode ?? "fail";
            while (true) {
              const itemId = enqueueFile(file, targetParent, mode);
              const result = await waitForTerminalState(itemId);

              if (
                result.state === "failed" &&
                result.error?.code === "NAME_CONFLICT"
              ) {
                const sep = detectSeparator(targetParent);
                const destinationPath = joinPath(
                  [targetParent, file.name],
                  sep,
                );
                const choice = await requestConflictDecision(
                  "upload",
                  file.name,
                  destinationPath,
                );
                console.debug("[files] conflict choice", {
                  operation: "upload",
                  mode: choice.mode,
                  destinationPath,
                });
                if (choice.applyToAll) rememberedMode = choice.mode;
                if (choice.mode === "skip") break;
                mode = choice.mode;
                continue;
              }

              break;
            }
          }
        } finally {
          uploadBatchRunningRef.current = false;
        }
      })();
    },
    [
      state.currentPath,
      toast,
      t,
      enqueueFile,
      waitForTerminalState,
      requestLargeUploadApproval,
      requestConflictDecision,
    ],
  );

  const handleWarningConfirm = useCallback(() => {
    setWarningPrompt((prev) => {
      if (!prev) return prev;
      prev.resolve(true);
      return null;
    });
  }, []);

  const handleWarningCancel = useCallback(() => {
    setWarningPrompt((prev) => {
      if (!prev) return prev;
      prev.resolve(false);
      return null;
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
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      if (dragDepthRef.current === 1) setDragActive(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
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
        toast.info(t("panel.navigateToFolderFirst"));
        return;
      }
      // Folder detection (Pitfall 5: webkitGetAsEntry returns null for non-
      // file items, so filter kind === 'file' BEFORE calling it).
      const items = Array.from(e.dataTransfer?.items ?? []);
      const entries = items
        .filter((i) => i.kind === "file")
        .map((i) => {
          const item = i as DataTransferItem & {
            webkitGetAsEntry?: () => FileSystemEntry | null;
          };
          return item.webkitGetAsEntry?.() ?? null;
        })
        .filter((entry): entry is FileSystemEntry => entry !== null);

      if (entries.some((entry) => entry.isDirectory)) {
        toast.info(t("panel.folderUploadUnsupported"));
        return;
      }

      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) handleUploadFiles(files);
    };

    el.addEventListener("dragenter", onEnter);
    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragenter", onEnter);
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [state.currentPath, toast, t, handleUploadFiles]);

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
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item: TransferItem = {
        id,
        transferId: null,
        direction: "download",
        name: entry.name,
        parentPath: state.currentPath,
        size: entry.sizeBytes,
        bytesSoFar: 0,
        state: "queued",
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
            .showSaveFilePicker === "function";
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
    if (parent === activeRootPath || isAncestor(activeRootPath, parent)) {
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
        toast.error(t("panel.filesChannelDisconnected"));
        return;
      }
      setIsDeleting(true);
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
    [channel.request, selection, toast, t],
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
      setConfirm({
        kind: "delete",
        paths,
        names,
        suppressOnConfirm: false,
      });
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
    setPicker({ kind: "move" });
  }, [selection.state.selected.size]);

  const handleCopyTo = useCallback(() => {
    if (selection.state.selected.size === 0) return;
    setPicker({ kind: "copy" });
  }, [selection.state.selected.size]);

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

  // Disallowed destinations for the picker:
  //   - For Move: current parent (no-op) + source paths (move-into-self).
  //   - For Copy: source paths only. Copy into current parent IS allowed --
  //     the desktop replies NAME_CONFLICT and the rename ("Keep Both") flow
  //     handles it, letting the user duplicate-in-place.
  // Deeper move-into-self (a descendant of any source folder) is caught at
  // the wire level by the desktop's ALLOWLIST_VIOLATION / IO_ERROR
  // responses; a complete in-UI ancestor check is Phase 12 hardening.
  const pickerDisallowedPaths = useMemo<string[]>(() => {
    const out = new Set<string>();
    if (picker?.kind === "move") {
      if (state.currentPath) out.add(state.currentPath);
      for (const p of selection.state.selected) out.add(p);
    } else if (picker?.kind === "copy") {
      for (const p of selection.state.selected) out.add(p);
    }
    return Array.from(out);
  }, [state.currentPath, picker, selection.state.selected]);

  // performMoveOrCopy fires files.move / files.copy sequentially over the
  // selected source paths. Sequential (NOT Promise.all) so error reporting
  // stays clean and the desktop is never hammered. Wraps the loop in
  // try/finally so isOperating is always reset.
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
      setIsOperating(true);
      try {
        let rememberedMode: NameConflictMode | null = null;
        for (const src of srcs) {
          const name = namesByPath.get(src) ?? src.split(/[\\/]/).pop() ?? src;
          const dst = joinPath([dstParent, name], sep);
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
        setRefreshKey((k) => k + 1);
        setPicker(null);
        rootRef.current?.focus();
      } finally {
        setIsOperating(false);
      }
    },
    [
      channel.request,
      selection,
      visibleEntries,
      toast,
      t,
      requestConflictDecision,
    ],
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
        "files.mkdir",
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
          toast.error(mapFilesErrorToMessage(err, t));
        });
    },
    [channel.request, state.currentPath, selection, toast, t],
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
        visibleEntries.find((e) => e.path === path)?.name ?? "";
      if (trimmed.length === 0 || trimmed === currentName) {
        setRenamingPath(null);
        return;
      }
      request<{ path: string; newName: string }, RenameResponse>(
        "files.rename",
        { path, newName },
      )
        .then(() => {
          setRenamingPath(null);
          selection.clear();
          setRefreshKey((k) => k + 1);
          rootRef.current?.focus();
        })
        .catch((err: unknown) => {
          toast.error(mapFilesErrorToMessage(err, t));
        });
    },
    [channel.request, visibleEntries, selection, toast, t],
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
          label: t("panel.contextMenu.copyPath"),
          onSelect: () => {
            void copyPathToClipboard(entry.path);
          },
        },
        { separator: true, label: "", onSelect: () => {} },
        {
          label: t("panel.contextMenu.rename"),
          onSelect: () => {
            const target = entry.path;
            setNewFolderPending(false);
            setRenamingPath(target);
          },
        },
        { separator: true, label: "", onSelect: () => {} },
        {
          label: t("panel.contextMenu.delete"),
          danger: true,
          onSelect: () => {
            void handleRequestDelete();
          },
        },
        {
          label: t("panel.contextMenu.moveTo"),
          onSelect: handleMoveTo,
        },
        {
          label: t("panel.contextMenu.copyTo"),
          onSelect: handleCopyTo,
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
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [
      selection,
      visibleEntries,
      handleRequestDelete,
      handleMoveTo,
      handleCopyTo,
      triggerDownload,
      copyPathToClipboard,
      t,
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
            label: t("panel.contextMenu.newFolder"),
            disabled: !canMkdir,
            onSelect: handleNewFolder,
          },
        ],
      });
    },
    [state.currentPath, handleNewFolder, t],
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ----- Keyboard handler (focus-guarded) -----
  const keyboard = useKeyboardShortcuts({
    rootRef,
    enabled:
      channel.status === "open" && renamingPath === null && !newFolderPending,
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
    if (channel.status !== "open") return;
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
    if (prev === "open" && curr !== "open") {
      const snap = queue.getSnapshot();
      const active = snap.items.find((i) => i.id === snap.activeId);
      if (active) {
        // queue.cancelById flips state to 'cancelling' (or removes a
        // 'queued' item); follow up with the 'disconnected' patch so the
        // row's terminal state is unambiguous and renders the red bar.
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
      setDisconnectBanner(t("panel.disconnectedDuringTransfer"));
    }
  }, [channel.status, queue, t]);

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

  // Refresh the listing when an upload to the current folder finishes. The
  // upload runner enqueues bytes through the data channel and only flips the
  // queue item to 'completed' after the desktop confirms; without this, the
  // newly-uploaded file shows up only after a manual refresh / navigation.
  // Track which item ids we've already reacted to so the snapshot subscription
  // doesn't refire forever while the entry sits in completed-history.
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

      if (active.direction === "download") {
        const t = activeDownloadRef.current;
        if (!t) return;
        const ageMs = Date.now() - t.lastChunkAtMs;
        if (ageMs > 10_000 && active.state === "active") {
          queue.updateItem(active.id, { state: "stalled" });
        } else if (ageMs <= 10_000 && active.state === "stalled") {
          queue.updateItem(active.id, { state: "active" });
        }
        return;
      }

      // Upload: stall detection itself is push-driven (desktop's
      // StallMonitor). RECOVERY from 'stalled' is local: when bytesSoFar
      // moves between ticks AND the row is currently 'stalled', flip back
      // to 'active'. Track previous bytesSoFar in a ref keyed by item.id
      // so a fresh active-id resets the baseline cleanly.
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
  }, [queue]);

  // ----- Plan 11-06: upload-side STALLED event subscription -----
  // The upload runner is busy in its chunk loop and does NOT subscribe to
  // files-ctl events. The panel takes over: any STALLED event whose
  // transferId matches the active UPLOAD item flips that row to 'stalled'.
  // Downloads handle their own STALLED inside runDownload (Task 2A).
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

  // Handle channel-closed placeholder.
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

  // Handle empty-allowlist state.
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
      <FileManagerSidebar
        roots={rootsResult.roots}
        isLoading={rootsResult.isLoading}
        error={
          rootsResult.error ? t("sidebar.couldNotLoadSharedFolders") : null
        }
        currentPath={state.currentPath}
        onSelectRoot={handleSelectRoot}
      />
      <div
        ref={rightColumnRef}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
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
      <ConfirmModal
        open={confirm?.kind === "delete"}
        title={t("dialogs.delete.title")}
        body={
          confirm && confirm.paths.length === 1 ? (
            <p>{t("dialogs.delete.singleBody", { name: confirm.names[0] })}</p>
          ) : confirm ? (
            <>
              <p>
                {t("dialogs.delete.multipleBody", {
                  count: confirm.names.length,
                })}
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {confirm.names.slice(0, 5).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              {confirm.names.length > 5 && (
                <p className="text-darkgray mt-1 text-sm">
                  {t("dialogs.delete.andMore", {
                    count: confirm.names.length - 5,
                  })}
                </p>
              )}
            </>
          ) : null
        }
        confirmLabel={t("dialogs.delete.confirm")}
        cancelLabel={t("dialogs.cancel")}
        dangerous
        isBusy={isDeleting}
        checkbox={
          confirm && confirm.paths.length === 1 && !suppressSingleDeleteConfirm
            ? {
                label: t("dialogs.delete.suppressSingleDeleteConfirm"),
                checked: confirm.suppressOnConfirm,
                onChange: (next) =>
                  setConfirm((prev) =>
                    prev ? { ...prev, suppressOnConfirm: next } : prev,
                  ),
              }
            : undefined
        }
        onConfirm={async () => {
          if (confirm) {
            if (confirm.paths.length === 1 && confirm.suppressOnConfirm) {
              setSuppressSingleDeleteConfirm(true);
            }
            await performDelete(confirm.paths);
          }
        }}
        onCancel={() => {
          if (!isDeleting) setConfirm(null);
        }}
      />
      <FolderPickerModal
        open={picker !== null}
        title={
          picker?.kind === "move"
            ? t("dialogs.folderPicker.moveTitle")
            : t("dialogs.folderPicker.copyTitle")
        }
        confirmLabel={
          picker?.kind === "move"
            ? t("dialogs.folderPicker.moveConfirm")
            : t("dialogs.folderPicker.copyConfirm")
        }
        channel={channel}
        disallowedPaths={pickerDisallowedPaths}
        currentPath={state.currentPath}
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
        open={warningPrompt !== null}
        fileName={warningPrompt?.file.name ?? ""}
        sizeBytes={warningPrompt?.file.size ?? 0}
        direction="upload"
        onConfirm={handleWarningConfirm}
        onCancel={handleWarningCancel}
      />
      <NameConflictDialog
        open={conflictPrompt !== null}
        operation={conflictPrompt?.operation ?? "upload"}
        fileName={conflictPrompt?.fileName ?? ""}
        destinationPath={conflictPrompt?.destinationPath ?? ""}
        onDecide={(mode, applyToAll) => {
          setConflictPrompt((prev) => {
            if (!prev) return prev;
            prev.resolve({ mode, applyToAll });
            return null;
          });
        }}
      />
      <DownloadBlockedDialog
        open={downloadBlocked !== null}
        fileName={downloadBlocked?.name ?? ""}
        sizeBytes={downloadBlocked?.size ?? 0}
        onClose={() => setDownloadBlocked(null)}
      />
      <LargeFileWarningDialog
        open={pendingDownloadWarn !== null}
        fileName={pendingDownloadWarn?.name ?? ""}
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
