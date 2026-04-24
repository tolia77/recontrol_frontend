import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UseFilesChannel } from '../../hooks/useFilesChannel';
import { useFilesRoots } from '../../hooks/useFilesRoots';
import type { FileManagerState, SortColumn, SortState } from './types';
import { FileManagerToolbar } from './FileManagerToolbar';
import { FileManagerBreadcrumb } from './FileManagerBreadcrumb';
import { FileManagerSidebar } from './FileManagerSidebar';
import { FileManagerListing } from './FileManagerListing';
import { FileManagerStatusBar } from './FileManagerStatusBar';
import { FileManagerEmptyAllowlist } from './FileManagerEmptyAllowlist';
import { isAncestor } from './utils/pathUtils';

interface FileManagerPanelProps {
  /** Used for storage keying in parent hooks; included for completeness. */
  deviceId: string;
  channel: UseFilesChannel;
  state: FileManagerState;
  setCurrentPath: (p: string | null) => void;
  setSort: (s: SortState) => void;
  setShowHidden: (v: boolean) => void;
}

/**
 * Top-level orchestrator for the file-manager UI. Composes the toolbar,
 * breadcrumb, sidebar, listing, and status bar. Handles disconnected and
 * empty-allowlist states at the panel level so sub-components don't need to
 * each branch on them.
 */
export function FileManagerPanel({
  deviceId: _deviceId,
  channel,
  state,
  setCurrentPath,
  setSort,
  setShowHidden,
}: FileManagerPanelProps) {
  const rootsResult = useFilesRoots(channel);
  const [visibleCount, setVisibleCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // When roots arrive for the first time and we don't have a currentPath yet,
  // leave currentPath null (empty-state prompt); the user must click a root.
  // But if our persisted currentPath no longer matches any known root, clear
  // it so we don't keep trying to list a folder that's no longer shared.
  useEffect(() => {
    if (!rootsResult.roots || rootsResult.roots.length === 0) return;
    if (state.currentPath === null) return;
    const stillReachable = rootsResult.roots.some(
      (r) =>
        r.path === state.currentPath ||
        isAncestor(r.path, state.currentPath as string),
    );
    if (!stillReachable) {
      setCurrentPath(null);
    }
    // Intentionally depend on roots identity + currentPath
  }, [rootsResult.roots, state.currentPath, setCurrentPath]);

  // Figure out which root the current path lives under so the breadcrumb knows
  // which separator to use.
  const activeRootPath = useMemo(() => {
    if (!state.currentPath || !rootsResult.roots) return null;
    const hit = rootsResult.roots.find(
      (r) =>
        r.path === state.currentPath ||
        isAncestor(r.path, state.currentPath as string),
    );
    return hit?.path ?? null;
  }, [state.currentPath, rootsResult.roots]);

  const handleToggleSort = useCallback(
    (col: SortColumn) => {
      if (state.sort.column === col) {
        setSort({
          column: col,
          direction: state.sort.direction === 'asc' ? 'desc' : 'asc',
        });
      } else {
        setSort({ column: col, direction: 'asc' });
      }
    },
    [state.sort, setSort],
  );

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleSelectRoot = useCallback(
    (path: string) => {
      setCurrentPath(path);
    },
    [setCurrentPath],
  );

  // Handle channel-closed placeholder.
  if (channel.status === 'closed' || channel.status === 'failed') {
    return (
      <div className="flex h-full w-full bg-background text-text items-center justify-center p-8 text-center text-darkgray text-sm">
        Files channel disconnected -- reconnect the stream.
      </div>
    );
  }

  // Handle empty-allowlist state.
  if (rootsResult.isEmpty) {
    return (
      <div className="flex h-full w-full bg-background text-text">
        <FileManagerEmptyAllowlist />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-background text-text">
      <FileManagerSidebar
        roots={rootsResult.roots}
        isLoading={rootsResult.isLoading}
        error={rootsResult.error ? 'Could not load shared folders' : null}
        currentPath={state.currentPath}
        onSelectRoot={handleSelectRoot}
      />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <FileManagerToolbar
          showHidden={state.showHidden}
          onToggleShowHidden={setShowHidden}
          onRefresh={handleRefresh}
          disabled={state.currentPath === null}
        />
        <FileManagerBreadcrumb
          currentPath={state.currentPath}
          rootPath={activeRootPath}
          onNavigate={setCurrentPath}
        />
        <FileManagerListing
          channel={channel}
          path={state.currentPath}
          sort={state.sort}
          onToggleSort={handleToggleSort}
          refreshKey={refreshKey}
          onVisibleCountChange={setVisibleCount}
        />
        <FileManagerStatusBar
          totalCount={visibleCount}
          selectionCount={0}
          selectionSize={0}
        />
      </div>
    </div>
  );
}
