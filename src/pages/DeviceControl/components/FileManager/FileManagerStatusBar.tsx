import { formatBytes } from './utils/formatters';

interface FileManagerStatusBarProps {
  totalCount: number;
  /** In 10-02 selectionCount is always 0; plan 10-03 wires it for real. */
  selectionCount: number;
  selectionSize: number;
}

export function FileManagerStatusBar({
  totalCount,
  selectionCount,
  selectionSize,
}: FileManagerStatusBarProps) {
  const hasSelection = selectionCount > 0;
  return (
    <footer
      role="status"
      className="border-t border-lightgray px-3 py-1.5 text-sm text-darkgray bg-background flex-shrink-0"
    >
      {hasSelection ? (
        <span>
          {selectionCount} item{selectionCount === 1 ? '' : 's'} selected
          {selectionSize > 0 ? ` — ${formatBytes(selectionSize)}` : ''}
        </span>
      ) : (
        <span>
          {totalCount} item{totalCount === 1 ? '' : 's'}
        </span>
      )}
    </footer>
  );
}
