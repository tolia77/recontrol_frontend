import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { RefreshIcon } from "src/pages/DeviceControl/components/icons/icons";
import {
  FolderPlusIcon,
  PencilIcon,
  TrashIcon,
  MoveIcon,
  CopyIcon,
  UploadIcon,
} from "./icons";

interface FileManagerToolbarProps {
  showHidden: boolean;
  onToggleShowHidden: (v: boolean) => void;
  onRefresh: () => void;
  /** When no folder is selected, the refresh button is a no-op. */
  disabled?: boolean;

  /** Plan 10-04: New Folder button is wired here. */
  onNewFolder: () => void;
  /** Plan 10-04: Rename is enabled iff exactly one row is selected. */
  onRename: () => void;
  /** Number of currently-selected rows; gates the Rename button (== 1). */
  selectionCount: number;

  /** Plan 10-05: Delete is enabled iff selectionCount > 0. */
  onDelete: () => void;
  /** Plan 10-05: Move to… opens the FolderPickerModal in 'move' mode. */
  onMoveTo: () => void;
  /** Plan 10-05: Copy to… opens the FolderPickerModal in 'copy' mode. */
  onCopyTo: () => void;

  /**
   * Plan 11-04: Upload button. Receives the user-picked File array (multi-
   * select) and forwards it to the panel's per-file enqueue path. The hidden
   * <input type="file" multiple> lives in this component; clicking the
   * Upload button triggers the OS file picker.
   */
  onUploadFiles: (files: File[]) => void;
}

/**
 * Toolbar strip shown above the breadcrumb. Plan 10-04 wires New Folder and
 * Rename; plan 10-05 wires Delete + Move to… + Copy to….
 */
function FileManagerToolbar({
  showHidden,
  onToggleShowHidden,
  onRefresh,
  disabled = false,
  onNewFolder,
  onRename,
  selectionCount,
  onDelete,
  onMoveTo,
  onCopyTo,
  onUploadFiles,
}: FileManagerToolbarProps) {
  const { t } = useTranslation("fileManager");
  const renameEnabled = !disabled && selectionCount === 1;
  const newFolderEnabled = !disabled;
  const deleteEnabled = selectionCount > 0;
  const moveEnabled = selectionCount > 0;
  const copyEnabled = selectionCount > 0;
  // Upload button is gated by the same `disabled` flag as New Folder so
  // selection-less, no-current-path states do not surface a destination-free
  // Upload action.
  const uploadEnabled = !disabled;

  // Hidden <input type="file" multiple>: the Upload button triggers
  // inputRef.current?.click(); on change we forward the FileList up to the
  // panel and reset .value so re-selecting the same file fires onChange again
  // (HTML form-control quirk: identical filenames are otherwise no-ops).
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onUploadFiles(files);
    // Reset so picking the same file twice still triggers onChange.
    e.target.value = "";
  };

  return (
    <div className="border-lightgray bg-background flex flex-shrink-0 items-center gap-2 border-b p-2">
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled}
        title={t("toolbar.refresh")}
        aria-label={t("toolbar.refresh")}
        className="hover:bg-tertiary text-text rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshIcon className="h-4 w-4" />
      </button>

      <div className="bg-lightgray h-5 w-px" aria-hidden="true" />

      <button
        type="button"
        onClick={onNewFolder}
        disabled={!newFolderEnabled}
        title={t("toolbar.newFolder")}
        aria-label={t("toolbar.newFolder")}
        className="hover:bg-tertiary text-text rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FolderPlusIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleUploadClick}
        disabled={!uploadEnabled}
        title={t("toolbar.uploadFiles")}
        aria-label={t("toolbar.uploadFiles")}
        className="hover:bg-tertiary text-text rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UploadIcon className="h-4 w-4" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
      <button
        type="button"
        onClick={onRename}
        disabled={!renameEnabled}
        title={t("toolbar.rename")}
        aria-label={t("toolbar.rename")}
        className="hover:bg-tertiary text-text rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PencilIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!deleteEnabled}
        title={t("toolbar.delete")}
        aria-label={t("toolbar.delete")}
        className="hover:bg-tertiary text-error rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onMoveTo}
        disabled={!moveEnabled}
        title={t("toolbar.moveTo")}
        aria-label={t("toolbar.moveTo")}
        className="hover:bg-tertiary text-text rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MoveIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onCopyTo}
        disabled={!copyEnabled}
        title={t("toolbar.copyTo")}
        aria-label={t("toolbar.copyTo")}
        className="hover:bg-tertiary text-text rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CopyIcon className="h-4 w-4" />
      </button>

      <label className="text-text ml-auto flex cursor-pointer items-center gap-2 text-sm select-none">
        <input
          type="checkbox"
          checked={showHidden}
          onChange={(e) => onToggleShowHidden(e.target.checked)}
          className="accent-primary"
        />
        {t("toolbar.showHiddenFiles")}
      </label>
    </div>
  );
}

export default FileManagerToolbar;
