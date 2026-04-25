import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FileEntry, FilesListResponse } from '../../services/files';
import { FilesChannelError } from '../../services/files';
import { useToast } from 'src/components/ui';
import type { UseFilesChannel } from '../../hooks/useFilesChannel';
import type { useFileManagerSelection } from '../../hooks/useFileManagerSelection';
import type { SortColumn, SortState } from './types';
import { ROW_HEIGHT_PX, FileManagerRow } from './FileManagerRow';
import { compareEntries } from './utils/sort';

interface FileManagerListingProps {
  channel: UseFilesChannel;
  path: string | null;
  sort: SortState;
  onToggleSort: (col: SortColumn) => void;
  /** Bump to force a re-fetch of the current path without changing it. */
  refreshKey: number;
  /** When false, entries with isHidden=true are filtered out of the listing. */
  showHidden: boolean;
  /** Selection state owned by the panel; same instance shared with keyboard handler. */
  selection: ReturnType<typeof useFileManagerSelection>;
  /**
   * Bubbles the post-filter, post-sort entries to the panel so that the
   * keyboard handler and status bar see the SAME visible array as the
   * listing. Identity changes here trigger selection invalidation in the
   * selection hook (Pitfall 5).
   */
  onVisibleEntriesChange: (entries: FileEntry[]) => void;
  /** Called when a file/folder row is double-clicked or activated by Enter. */
  onActivate: (entry: FileEntry) => void;
}

type ListingState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; entries: FileEntry[] };

function errorMessageFor(err: FilesChannelError): string {
  switch (err.info.code) {
    case 'ALLOWLIST_VIOLATION': return 'This folder is outside the shared area.';
    case 'NOT_FOUND':           return 'Folder does not exist.';
    case 'PERMISSION_DENIED':   return 'Permission denied on the remote.';
    case 'TIMEOUT':             return 'Remote did not respond in time.';
    case 'CHANNEL_NOT_OPEN':    return 'Files channel disconnected. Reconnect the stream.';
    case 'DISPOSED':            return 'Files channel disposed. Reconnect the stream.';
    default:                    return 'Could not load folder.';
  }
}

/**
 * Virtualized 4-column (Name / Size / Modified / Type) listing with sticky
 * header, monotonic request-id guard against stale responses, and Windows-
 * Explorer-style click-selection (single / shift-range / ctrl-toggle).
 *
 * Selection state lives in the panel (so keyboard shortcuts share it); the
 * listing only consumes it. Activation (double-click / Enter) is also routed
 * up to the panel so folder navigation and the file-stub toast both happen
 * in one place.
 */
export function FileManagerListing({
  channel,
  path,
  sort,
  onToggleSort,
  refreshKey,
  showHidden,
  selection,
  onVisibleEntriesChange,
  onActivate,
}: FileManagerListingProps) {
  const [state, setState] = useState<ListingState>({ kind: 'idle' });
  const toast = useToast();

  // Monotonic request id; drop any response whose id is not the current max.
  const requestIdRef = useRef(0);

  // Reset when the channel closes entirely.
  useEffect(() => {
    if (!channel.request) {
      setState({ kind: 'idle' });
    }
  }, [channel.request]);

  // Fire a new files.list every time path or refreshKey changes (sort + hidden
  // filter are client-side -- no round-trip needed).
  useEffect(() => {
    const request = channel.request;
    if (!request || !path) {
      setState({ kind: 'idle' });
      return;
    }
    const myId = ++requestIdRef.current;
    setState({ kind: 'loading' });
    request<{ path: string }, FilesListResponse>('files.list', { path })
      .then((res) => {
        if (myId !== requestIdRef.current) return; // stale
        setState({ kind: 'ready', entries: res.entries });
      })
      .catch((err: unknown) => {
        if (myId !== requestIdRef.current) return; // stale
        const message =
          err instanceof FilesChannelError
            ? errorMessageFor(err)
            : 'Unexpected error loading folder.';
        setState({ kind: 'error', message });
        toast.error(message);
      });
  }, [channel.request, path, refreshKey, toast]);

  // Apply the show-hidden filter BEFORE sorting (NAV-14; isHidden guaranteed
  // by plan 10-01).
  const visibleEntries = useMemo<FileEntry[]>(() => {
    if (state.kind !== 'ready') return [];
    const filtered = showHidden
      ? state.entries
      : state.entries.filter((e) => !e.isHidden);
    const copy = [...filtered];
    copy.sort((a, b) => compareEntries(a, b, sort));
    return copy;
  }, [state, sort, showHidden]);

  // Bubble visible entries up to the panel so keyboard handler and status
  // bar see the same array. Array identity changes here drive selection
  // invalidation in useFileManagerSelection.
  useEffect(() => {
    onVisibleEntriesChange(visibleEntries);
  }, [visibleEntries, onVisibleEntriesChange]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: visibleEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 10,
  });

  const handleRowClick = useCallback(
    (index: number, e: MouseEvent<HTMLDivElement>) => {
      if (e.shiftKey) {
        selection.extendTo(index);
      } else if (e.ctrlKey || e.metaKey) {
        selection.toggle(index);
      } else {
        selection.selectOnly(index);
      }
    },
    [selection],
  );

  const handleRowDoubleClick = useCallback(
    (entry: FileEntry) => {
      onActivate(entry);
    },
    [onActivate],
  );

  const sortIndicator = (col: SortColumn) => {
    if (sort.column !== col) return null;
    return (
      <span className="text-xs ml-1">
        {sort.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const renderHeaderButton = (label: string, col: SortColumn, align: 'left' | 'right' = 'left') => (
    <button
      type="button"
      onClick={() => onToggleSort(col)}
      className={[
        'flex items-center gap-1 px-3 h-full select-none cursor-pointer hover:bg-tertiary/60 transition-colors',
        align === 'right' ? 'justify-end' : 'justify-start',
      ].join(' ')}
    >
      <span>{label}</span>
      {sortIndicator(col)}
    </button>
  );

  const focusedIndex = selection.state.focusedIndex;
  const selectedPaths = selection.state.selected;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sticky 4-column header */}
      <div
        role="row"
        className="grid grid-cols-[1fr_120px_180px_140px] bg-background border-b border-lightgray font-semibold text-sm text-text flex-shrink-0"
        style={{ height: `${ROW_HEIGHT_PX}px` }}
      >
        {renderHeaderButton('Name', 'name', 'left')}
        {renderHeaderButton('Size', 'size', 'right')}
        {renderHeaderButton('Modified', 'modified', 'left')}
        {renderHeaderButton('Type', 'type', 'left')}
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto min-h-0">
        {state.kind === 'idle' && !path && (
          <div className="p-4 text-sm text-darkgray">
            Select a folder from the sidebar to start browsing.
          </div>
        )}
        {state.kind === 'loading' && (
          <div className="p-4 text-sm text-darkgray">Loading...</div>
        )}
        {state.kind === 'error' && (
          <div className="p-4 text-sm text-error">{state.message}</div>
        )}
        {state.kind === 'ready' && visibleEntries.length === 0 && (
          <div className="p-4 text-sm text-darkgray">This folder is empty.</div>
        )}
        {state.kind === 'ready' && visibleEntries.length > 0 && (
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = visibleEntries[virtualRow.index];
              if (!entry) return null;
              const index = virtualRow.index;
              return (
                <div
                  key={entry.path}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${ROW_HEIGHT_PX}px`,
                  }}
                >
                  <FileManagerRow
                    entry={entry}
                    index={index}
                    isSelected={selectedPaths.has(entry.path)}
                    isFocused={focusedIndex === index}
                    onClick={(e) => handleRowClick(index, e)}
                    onDoubleClick={() => handleRowDoubleClick(entry)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
