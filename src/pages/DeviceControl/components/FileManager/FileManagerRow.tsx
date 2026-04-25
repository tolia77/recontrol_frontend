import { memo } from 'react';
import type { MouseEvent } from 'react';
import type { FileEntry } from '../../services/files';
import { IconForEntry } from './icons';
import { formatBytes, formatDate, formatType } from './utils/formatters';

export const ROW_HEIGHT_PX = 36;

interface FileManagerRowProps {
  entry: FileEntry;
  /** 0-based index in the visible (post-filter, post-sort) list. */
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
}

function FileManagerRowImpl({
  entry,
  index,
  isSelected,
  isFocused,
  onClick,
  onDoubleClick,
}: FileManagerRowProps) {
  // Visual hierarchy:
  //   Selected + Focused -> bg-accent/30 ring-1 ring-accent
  //   Selected           -> bg-accent/20 text-text
  //   Focused only       -> bg-tertiary
  //   None               -> hover:bg-tertiary
  const stateClass =
    isSelected && isFocused
      ? 'bg-accent/30 ring-1 ring-accent'
      : isSelected
        ? 'bg-accent/20 text-text'
        : isFocused
          ? 'bg-tertiary'
          : 'hover:bg-tertiary/60';

  return (
    <div
      role="row"
      data-row-index={index}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={[
        'grid grid-cols-[1fr_120px_180px_140px] items-center px-3 cursor-default text-sm border-b border-lightgray/50 select-none',
        stateClass,
      ].join(' ')}
      style={{ height: `${ROW_HEIGHT_PX}px` }}
    >
      <div className="flex items-center min-w-0">
        <IconForEntry entry={entry} className="w-4 h-4 mr-2 flex-shrink-0" />
        <span className="truncate text-text" title={entry.name}>
          {entry.name}
        </span>
      </div>
      <div className="text-right text-darkgray tabular-nums pr-4">
        {entry.isDirectory ? '' : formatBytes(entry.sizeBytes)}
      </div>
      <div className="text-darkgray">{formatDate(entry.modifiedUtc)}</div>
      <div className="text-darkgray truncate">
        {formatType(entry.name, entry.isDirectory)}
      </div>
    </div>
  );
}

/**
 * Memoized row; re-renders only when one of its scalar props changes
 * (entry identity, selection bit, focus bit, click handlers).
 */
export const FileManagerRow = memo(FileManagerRowImpl);
