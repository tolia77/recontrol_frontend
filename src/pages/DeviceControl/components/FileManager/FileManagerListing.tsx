import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FileEntry, FilesListResponse } from '../../services/files';
import { FilesChannelError } from '../../services/files';
import { useToast } from 'src/components/ui';
import type { UseFilesChannel } from '../../hooks/useFilesChannel';
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
  /**
   * Called with the count of visible entries so the status bar can render
   * "{N} items". Parent owns the status bar because selection state
   * (plan 10-03) also drives it.
   */
  onVisibleCountChange: (count: number) => void;
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
 * Virtualized 4-column (Name / Size / Modified / Type) listing with
 * sticky header and a monotonic request-id guard against stale responses.
 */
export function FileManagerListing({
  channel,
  path,
  sort,
  onToggleSort,
  refreshKey,
  onVisibleCountChange,
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

  // Fire a new files.list every time path or refreshKey changes (sort is
  // client-side -- no round-trip needed).
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

  const sortedEntries = useMemo<FileEntry[]>(() => {
    if (state.kind !== 'ready') return [];
    const copy = [...state.entries];
    copy.sort((a, b) => compareEntries(a, b, sort));
    return copy;
  }, [state, sort]);

  // Report visible count to the parent so StatusBar can render "{N} items".
  useEffect(() => {
    onVisibleCountChange(sortedEntries.length);
  }, [sortedEntries.length, onVisibleCountChange]);

  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  useEffect(() => {
    // Clear focus when path changes
    setFocusedPath(null);
  }, [path]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sortedEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 10,
  });

  const handleRowClick = useCallback((p: string) => {
    setFocusedPath(p);
  }, []);

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
        {state.kind === 'ready' && sortedEntries.length === 0 && (
          <div className="p-4 text-sm text-darkgray">This folder is empty.</div>
        )}
        {state.kind === 'ready' && sortedEntries.length > 0 && (
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = sortedEntries[virtualRow.index];
              if (!entry) return null;
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
                    isFocused={focusedPath === entry.path}
                    onClick={() => handleRowClick(entry.path)}
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
