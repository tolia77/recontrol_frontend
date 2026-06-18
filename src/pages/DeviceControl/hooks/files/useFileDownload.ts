import { useCallback } from "react";
import type { RefObject } from "react";
import type { FileEntry } from "src/pages/DeviceControl/services/files/filesProtocol.generated";
import type { DownloadTransfer } from "src/pages/DeviceControl/services/transfer/DownloadTransfer";
import type { TransferItem } from "src/pages/DeviceControl/services/transfer/types";
import type { TransferQueue } from "src/pages/DeviceControl/services/transfer/TransferQueue";

/**
 * 100 MiB download-warning threshold (mirrors the upload threshold in
 * useFileUpload.ts — both gates use the same LARGE_FILE_THRESHOLD value).
 */
const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024;

export interface UseFileDownloadOptions {
  queue: TransferQueue;
  activeDownloadRef: RefObject<DownloadTransfer | null>;
  currentPath: string | null;
  /** Container-provided: opens DownloadBlockedDialog. */
  onDownloadBlocked: (entry: FileEntry) => void;
  /** Container-provided: opens LargeFileWarningDialog for download direction. */
  onPendingDownloadWarn: (entry: FileEntry) => void;
}

export interface UseFileDownloadReturn {
  triggerDownload: (entry: FileEntry) => void;
}

/**
 * Manages the download capability gate and enqueue path.
 *
 * Owns: `enqueueDownload` (internal helper) + `triggerDownload` (public).
 *
 * Design invariants:
 *   - For files > 100 MiB:
 *     - If `showSaveFilePicker` is absent: calls `onDownloadBlocked` and returns.
 *     - If `showSaveFilePicker` is present: calls `onPendingDownloadWarn` and returns.
 *   - Directories are skipped immediately.
 *   - Files ≤ 100 MiB are enqueued directly.
 */
export function useFileDownload({
  queue,
  currentPath,
  onDownloadBlocked,
  onPendingDownloadWarn,
}: UseFileDownloadOptions): UseFileDownloadReturn {
  const enqueueDownload = useCallback(
    (entry: FileEntry) => {
      if (!currentPath) return; // file rows imply we're inside a folder
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const item: TransferItem = {
        id,
        transferId: null,
        direction: "download",
        name: entry.name,
        parentPath: currentPath,
        size: entry.sizeBytes,
        bytesSoFar: 0,
        state: "queued",
        enqueuedAt: Date.now(),
      };
      queue.enqueue(item);
    },
    [currentPath, queue],
  );

  // triggerDownload is the SINGLE chokepoint for download invocation.
  // Capability detection (NOT user-agent sniffing) lives here:
  //   - showSaveFilePicker present + size > 100 MiB -> onPendingDownloadWarn
  //   - showSaveFilePicker absent  + size > 100 MiB -> onDownloadBlocked
  //   - Otherwise: enqueue immediately.
  const triggerDownload = useCallback(
    (entry: FileEntry) => {
      if (entry.isDirectory) return; // directories are not downloadable
      if (entry.sizeBytes > LARGE_FILE_THRESHOLD) {
        const hasFsa =
          typeof (window as { showSaveFilePicker?: unknown })
            .showSaveFilePicker === "function";
        if (!hasFsa) {
          onDownloadBlocked(entry);
          return;
        }
        onPendingDownloadWarn(entry);
        return;
      }
      enqueueDownload(entry);
    },
    [enqueueDownload, onDownloadBlocked, onPendingDownloadWarn],
  );

  return { triggerDownload };
}
