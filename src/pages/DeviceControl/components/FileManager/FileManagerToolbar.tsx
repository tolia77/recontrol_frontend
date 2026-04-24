import { RefreshIcon } from '../../icons';
import { FolderPlusIcon, PencilIcon, TrashIcon, MoveIcon, CopyIcon } from './icons';

interface FileManagerToolbarProps {
  showHidden: boolean;
  onToggleShowHidden: (v: boolean) => void;
  onRefresh: () => void;
  /** When no folder is selected, the refresh button is a no-op. */
  disabled?: boolean;
}

/**
 * Toolbar strip shown above the breadcrumb. In plan 10-02 only Refresh + Show
 * hidden files are wired; the write-op buttons are rendered as stubs so the
 * layout doesn't jump between plans.
 */
export function FileManagerToolbar({
  showHidden,
  onToggleShowHidden,
  onRefresh,
  disabled = false,
}: FileManagerToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-2 border-b border-lightgray bg-background flex-shrink-0">
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled}
        title="Refresh"
        className="p-1.5 rounded hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed text-text transition-colors"
      >
        <RefreshIcon className="w-4 h-4" />
      </button>

      <div className="w-px h-5 bg-lightgray" aria-hidden="true" />

      <button
        type="button"
        disabled
        title="coming soon"
        className="p-1.5 rounded text-darkgray opacity-50 cursor-not-allowed"
      >
        <FolderPlusIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        disabled
        title="coming soon"
        className="p-1.5 rounded text-darkgray opacity-50 cursor-not-allowed"
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
