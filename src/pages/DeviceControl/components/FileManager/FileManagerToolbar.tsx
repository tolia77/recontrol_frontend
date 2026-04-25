import { useRef } from 'react';
import { RefreshIcon } from '../../icons';
import {
  FolderPlusIcon,
  PencilIcon,
  TrashIcon,
  MoveIcon,
  CopyIcon,
  UploadIcon,
} from './icons';

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
export function FileManagerToolbar({
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
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-2 p-2 border-b border-lightgray bg-background flex-shrink-0">
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled}
        title="Refresh (F5)"
        className="p-1.5 rounded hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text transition-colors"
      >
        <RefreshIcon className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-lightgray" aria-hidden="true" />

      <button
        type="button"
        onClick={onNewFolder}
        disabled={!newFolderEnabled}
        title="New folder"
        className="p-1.5 rounded hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text transition-colors"
      >
        <FolderPlusIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={handleUploadClick}
        disabled={!uploadEnabled}
        title="Upload files"
        className="p-1.5 rounded hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text transition-colors"
      >
        <UploadIcon className="w-4 h-4" />
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
        title="Rename (F2)"
        className="p-1.5 rounded hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text transition-colors"
      >
        <PencilIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={!deleteEnabled}
        title="Delete (Del)"
        className="p-1.5 rounded hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-error transition-colors"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onMoveTo}
        disabled={!moveEnabled}
        title="Move to…"
        className="p-1.5 rounded hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text transition-colors"
      >
        <MoveIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onCopyTo}
        disabled={!copyEnabled}
        title="Copy to…"
        className="p-1.5 rounded hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text transition-colors"
      >
        <CopyIcon className="w-4 h-4" />
      </button>

      <label className="ml-auto flex items-center gap-2 text-sm text-text cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showHidden}
          onChange={(e) => onToggleShowHidden(e.target.checked)}
          className="accent-primary"
        />
        Show hidden files
      </label>
    </div>
  );
}
