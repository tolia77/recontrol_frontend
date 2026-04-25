import { RefreshIcon } from '../../icons';
import { FolderPlusIcon, PencilIcon, TrashIcon, MoveIcon, CopyIcon } from './icons';

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
}

/**
 * Toolbar strip shown above the breadcrumb. Plan 10-04 wires New Folder and
 * Rename; Delete / Move / Copy stay disabled stubs until plan 10-05.
 */
export function FileManagerToolbar({
  showHidden,
  onToggleShowHidden,
  onRefresh,
  disabled = false,
  onNewFolder,
  onRename,
  selectionCount,
}: FileManagerToolbarProps) {
  const renameEnabled = !disabled && selectionCount === 1;
  const newFolderEnabled = !disabled;

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
        onClick={onRename}
        disabled={!renameEnabled}
        title="Rename (F2)"
        className="p-1.5 rounded hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text transition-colors"
      >
        <PencilIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        disabled
        title="coming soon"
        className="p-1.5 rounded text-darkgray opacity-50 cursor-not-allowed"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        disabled
        title="coming soon"
        className="p-1.5 rounded text-darkgray opacity-50 cursor-not-allowed"
      >
        <MoveIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        disabled
        title="coming soon"
        className="p-1.5 rounded text-darkgray opacity-50 cursor-not-allowed"
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
