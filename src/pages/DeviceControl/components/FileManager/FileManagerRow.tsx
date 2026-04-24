import { memo } from 'react';
import type { FileEntry } from '../../services/files';
import { IconForEntry } from './icons';
import { formatBytes, formatDate, formatType } from './utils/formatters';

export const ROW_HEIGHT_PX = 36;

interface FileManagerRowProps {
  entry: FileEntry;
  isFocused: boolean;
  onClick: () => void;
}

function FileManagerRowImpl({ entry, isFocused, onClick }: FileManagerRowProps) {
  return (
    <div
      role="row"
      onClick={onClick}
      className={[
        'grid grid-cols-[1fr_120px_180px_140px] items-center px-3 cursor-default text-sm border-b border-lightgray/50',
        isFocused ? 'bg-tertiary' : 'hover:bg-tertiary/60',
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
 * Memoized row; re-renders only when entry identity, focus, or onClick
 * changes.
 */
export const FileManagerRow = memo(FileManagerRowImpl);
