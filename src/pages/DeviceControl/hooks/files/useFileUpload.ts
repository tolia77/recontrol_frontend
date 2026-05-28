import { useCallback, useRef } from "react";
import type { RefObject } from "react";
import type { TFunction } from "i18next";
import type { NameConflictMode } from "../../services/files";
import type { TransferItem, TransferQueue } from "../../services/transfer";
import { detectSeparator, joinPath } from "../../components/FileManager/utils/pathUtils";

/**
 * 100 MiB upload-warning threshold (TRANSFER-06). The CONTEXT-locked check is
 * binary MiB; the dialog displays decimal MB for user-facing copy.
 */
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;

export interface UseFileUploadOptions {
  queue: TransferQueue;
  filesByItemIdRef: RefObject<Map<string, File>>;
  currentPath: string | null;
  /** Container-provided callback: opens LargeFileWarningDialog, resolves true/false. */
  requestLargeUploadApproval: (file: File) => Promise<boolean>;
  /** Container-provided callback: opens NameConflictDialog, resolves choice. */
  requestConflictDecision: (
    operation: "upload" | "move" | "copy",
    fileName: string,
    destinationPath: string,
  ) => Promise<{ mode: NameConflictMode; applyToAll: boolean }>;
  toast: {
    info: (message: string) => void;
    error: (message: string) => void;
    success: (message: string) => void;
    warning: (message: string) => void;
  };
  t: TFunction<"fileManager">;
}

export interface UseFileUploadReturn {
  handleUploadFiles: (files: File[]) => void;
}

/**
 * Manages the file-upload batch state machine.
 *
 * Owns: `enqueueFile`, `waitForTerminalState`, `uploadBatchRunningRef`, and
 * the `handleUploadFiles` sequential batch loop. The hook's public surface is
 * only `handleUploadFiles`; the internal helpers are not returned.
 *
 * Design invariants (D-05):
 *   - The hook receives `requestLargeUploadApproval`/`requestConflictDecision`
 *     as injected callbacks; it does NOT own resolver refs.
 *   - The >100 MiB upload-warning guard (LARGE_FILE_THRESHOLD) is preserved
 *     verbatim (T-27-03).
 *   - The NAME_CONFLICT pause/resume with `applyToAll`/`rememberedMode`
 *     semantics are preserved exactly (T-27-03, D-05).
 */
export function useFileUpload({
  queue,
  filesByItemIdRef,
  currentPath,
  requestLargeUploadApproval,
  requestConflictDecision,
  toast,
  t,
}: UseFileUploadOptions): UseFileUploadReturn {
  const uploadBatchRunningRef = useRef(false);

  // enqueueFile and waitForTerminalState are internal helpers;
  // they are NOT returned (hook's public surface is only handleUploadFiles).
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

  // handleUploadFiles is the single entry point for both drop + Upload-button
  // flows. This runs the batch sequentially so NAME_CONFLICT can pause the
  // batch, prompt once, then resume with replace/skip/keepBoth.
  const handleUploadFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (!currentPath) {
        toast.info(t("panel.navigateToFolderFirst"));
        return;
      }
      if (uploadBatchRunningRef.current) {
        toast.info(t("panel.uploadBatchInProgress"));
        return;
      }

      uploadBatchRunningRef.current = true;
      const targetParent = currentPath;

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
      currentPath,
      toast,
      t,
      enqueueFile,
      waitForTerminalState,
      requestLargeUploadApproval,
      requestConflictDecision,
    ],
  );

  return { handleUploadFiles };
}
