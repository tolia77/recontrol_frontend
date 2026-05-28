import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { TFunction } from "i18next";

export interface UseFileDragDropOptions {
  rightColumnRef: RefObject<HTMLDivElement>;
  currentPath: string | null;
  /** Called with the dropped File array; typically useFileUpload's handleUploadFiles. */
  onFiles: (files: File[]) => void;
  toast: {
    info: (message: string) => void;
    error: (message: string) => void;
  };
  t: TFunction<"fileManager">;
}

/**
 * Manages native drag-and-drop over the file-manager right column.
 *
 * Owns: `dragActive` (useState) + `dragDepthRef` (useRef) + the native
 * addEventListener drag effect, attached to the injected `rightColumnRef`.
 * The hook does NOT create the ref — it attaches listeners to the element
 * the container already owns (analog: useFileManagerSelection).
 *
 * Design invariants (D-07):
 *   - The 63-line drag-depth block is owned here (FILES-02 named target).
 *   - `dragDepthRef` counts dragenter/dragleave so internal panel boundaries
 *     do NOT flicker the overlay (Pitfall 6).
 *   - Folder detection filters `kind === "file"` BEFORE `webkitGetAsEntry`,
 *     rejecting directories with t("panel.folderUploadUnsupported") (Pitfall 5).
 *   - `hasFiles()` gates on `dataTransfer.types` includes "Files".
 *   - On drop with no currentPath, toasts t("panel.navigateToFolderFirst").
 */
export function useFileDragDrop({
  rightColumnRef,
  currentPath,
  onFiles,
  toast,
  t,
}: UseFileDragDropOptions): { dragActive: boolean } {
  const [dragActive, setDragActive] = useState(false);
  const dragDepthRef = useRef(0);

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

      if (!currentPath) {
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
      if (files.length > 0) onFiles(files);
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
  }, [rightColumnRef, currentPath, onFiles, toast, t]);

  return { dragActive };
}
