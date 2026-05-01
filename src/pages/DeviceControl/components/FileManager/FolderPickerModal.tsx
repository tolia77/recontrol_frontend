import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  FileEntry,
  FilesListResponse,
  FilesListRootsResponse,
} from '../../services/files';
import type { UseFilesChannel } from '../../hooks/useFilesChannel';
import { ChevronRightIcon, ChevronDownIcon, FolderIcon } from './icons';
import { mapFilesErrorToMessage } from './utils/errors';

interface FolderPickerModalProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  channel: UseFilesChannel;
  /**
   * Paths that cannot be selected as the destination. Always includes the
   * current parent folder (no-op move) and -- for Move -- the source paths
   * themselves (move-into-self for folders). Deeper move-into-self
   * (descendant-of-source) is caught at the wire level by the desktop's
   * ALLOWLIST_VIOLATION / IO_ERROR responses.
   */
  disallowedPaths?: string[];
  /**
   * In-flight gate. When true, the panel is iterating files.move /
   * files.copy sequentially over the source paths. Confirm + Cancel both
   * disabled, Confirm shows a spinner, Esc / overlay-click cancellation
   * suppressed -- mirrors {@link ConfirmDialog}'s `isBusy` semantics.
   */
  isBusy?: boolean;
  onConfirm: (destinationPath: string) => void;
  onCancel: () => void;
}

interface NodeState {
  /** Have we already issued files.list for this node? */
  loaded: boolean;
  /** Currently fetching children? */
  loading: boolean;
  /** Inline error from a failed files.list of this node. */
  error: string | null;
  /** Folder children (files filtered out -- this is a folder picker). */
  children: FileEntry[];
}

const EMPTY_NODE: NodeState = {
  loaded: false,
  loading: false,
  error: null,
  children: [],
};

/**
 * Tree-view folder picker used by Move to… and Copy to… (plan 10-05).
 *
 * Visual language matches {@link ConfirmDialog} (fixed-inset overlay +
 * centered card + z-50). Card is wider (`max-w-lg`) since the tree wants a
 * little horizontal breathing room.
 *
 * Lazy-loaded tree:
 *   - On open, calls `files.listRoots({})` and seeds the top-level nodes.
 *   - First-time expansion of any node fires `files.list({ path })` and
 *     caches the directories from `entries` (files filtered out -- this is
 *     a folder picker). Subsequent expansions are instant (Research
 *     Pitfall 6 -- avoid re-fetching on every collapse / expand cycle).
 *
 * Selection vs. expansion:
 *   - Clicking the chevron toggles expansion only.
 *   - Clicking the row name selects that node as the destination.
 *   - A row in `disallowedPaths` is greyed out and clicks are no-ops.
 *
 * NO breadcrumbs and NO in-modal create-folder (CONTEXT-locked omissions
 * for Phase 10; both are listed as "deferred" in 10-CONTEXT.md).
 *
 * In-flight safety (`isBusy`): once Confirm fires the panel's move/copy
 * loop, the modal stays mounted with `isBusy=true`. Confirm + Cancel are
 * disabled, Esc and overlay-click cancellation are suppressed -- the
 * panel will dismiss the modal in its `finally` block.
 */
export function FolderPickerModal({
  open,
  title,
  confirmLabel,
  channel,
  disallowedPaths,
  isBusy,
  onConfirm,
  onCancel,
}: FolderPickerModalProps) {
  const { t } = useTranslation('fileManager');
  const [roots, setRoots] = useState<FileEntry[] | null>(null);
  const [rootsError, setRootsError] = useState<string | null>(null);
  // Per-path expansion + child cache.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const nodesRef = useRef<Map<string, NodeState>>(new Map());
  // Force re-render when nodesRef mutates (the cache lives in a ref so its
  // identity stays stable across render cycles, but we still need React to
  // re-render when any node's state changes).
  const [nodeTick, setNodeTick] = useState(0);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const disallowed = useMemo(
    () => new Set(disallowedPaths ?? []),
    [disallowedPaths],
  );

  // Reset state on every open transition.
  useEffect(() => {
    if (!open) return;
    setRoots(null);
    setRootsError(null);
    setExpanded(new Set());
    nodesRef.current = new Map();
    setNodeTick(0);
    setSelectedPath(null);
  }, [open]);

  // Fetch roots when opened.
  useEffect(() => {
    if (!open) return;
    const request = channel.request;
    if (!request) {
      setRootsError(t('panel.filesChannelDisconnected'));
      return;
    }
    let cancelled = false;
    request<Record<string, never>, FilesListRootsResponse>(
      'files.listRoots',
      {},
    )
      .then((res) => {
        if (cancelled) return;
        setRoots(res.roots);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRootsError(mapFilesErrorToMessage(err, t));
      });
    return () => {
      cancelled = true;
    };
  }, [open, channel.request, t]);

  // Esc cancels only when not busy.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isBusy, onCancel]);

  const fetchChildren = useCallback(
    async (path: string) => {
      const request = channel.request;
      if (!request) return;
      const cur = nodesRef.current.get(path) ?? EMPTY_NODE;
      if (cur.loaded || cur.loading) return;
      nodesRef.current.set(path, { ...cur, loading: true, error: null });
      setNodeTick((tick) => tick + 1);
      try {
        const res = await request<{ path: string }, FilesListResponse>(
          'files.list',
          { path },
        );
        // Folders only -- this is a folder picker.
        const dirs = res.entries.filter((e) => e.isDirectory);
        nodesRef.current.set(path, {
          loaded: true,
          loading: false,
          error: null,
          children: dirs,
        });
      } catch (err: unknown) {
        nodesRef.current.set(path, {
          loaded: false,
          loading: false,
          error: mapFilesErrorToMessage(err, t),
          children: [],
        });
      }
      setNodeTick((tick) => tick + 1);
    },
    [channel.request, t],
  );

  const toggleExpanded = useCallback(
    (path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          const cur = nodesRef.current.get(path);
          if (!cur || (!cur.loaded && !cur.loading)) {
            void fetchChildren(path);
          }
        }
        return next;
      });
    },
    [fetchChildren],
  );

  const isDisallowed = useCallback(
    (path: string) => disallowed.has(path),
    [disallowed],
  );

  const handleRowClick = useCallback(
    (path: string) => {
      if (isDisallowed(path)) return;
      setSelectedPath(path);
    },
    [isDisallowed],
  );

  const handleOverlayClick = () => {
    if (isBusy) return;
    onCancel();
  };

  const canConfirm =
    !!selectedPath && !isDisallowed(selectedPath) && !isBusy;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="bg-background border border-lightgray rounded-lg shadow-xl max-w-lg w-[90%] p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="text-lg font-semibold mb-3 text-text">{title}</h2>

        <div className="max-h-[60vh] overflow-auto border border-lightgray rounded-md p-1 mb-4 bg-background">
          {rootsError ? (
            <div className="p-3 text-sm text-error">{rootsError}</div>
          ) : roots === null ? (
            <div className="p-3 text-sm text-darkgray">
              {t('dialogs.folderPicker.loading')}
            </div>
          ) : roots.length === 0 ? (
            <div className="p-3 text-sm text-darkgray">
              {t('dialogs.folderPicker.noSharedFolders')}
            </div>
          ) : (
            <ul role="tree" className="text-sm">
              {roots.map((root) => (
                <TreeNode
                  key={root.path}
                  entry={root}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggleExpanded}
                  selectedPath={selectedPath}
                  onSelect={handleRowClick}
                  isDisallowed={isDisallowed}
                  nodes={nodesRef.current}
                  // nodeTick wired in to force re-render when child cache mutates
                  nodeTick={nodeTick}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={!!isBusy}
            className="px-4 py-2 border border-lightgray rounded-md text-text hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('dialogs.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedPath) onConfirm(selectedPath);
            }}
            disabled={!canConfirm}
            className="px-4 py-2 bg-accent text-white rounded-md hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isBusy && (
              <span
                className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TreeNodeProps {
  entry: FileEntry;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  isDisallowed: (path: string) => boolean;
  nodes: Map<string, NodeState>;
  /** Bumped when nodes Map mutates so React re-renders the subtree. */
  nodeTick: number;
}

function TreeNode({
  entry,
  depth,
  expanded,
  onToggle,
  selectedPath,
  onSelect,
  isDisallowed,
  nodes,
  nodeTick,
}: TreeNodeProps) {
  const { t } = useTranslation('fileManager');
  const isExpanded = expanded.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const disallowed = isDisallowed(entry.path);
  const node = nodes.get(entry.path) ?? EMPTY_NODE;
  // Reference nodeTick so eslint doesn't flag it; the ref-stored Map already
  // gives us the latest data, but React needs the prop in our deps to
  // schedule a re-render.
  void nodeTick;

  const rowCls = [
    'flex items-center gap-1 py-1 pl-1 pr-2 rounded transition-colors',
    isSelected
      ? 'bg-accent/20 border-l-4 border-accent'
      : 'border-l-4 border-transparent',
    disallowed
      ? 'opacity-50 cursor-not-allowed'
      : 'hover:bg-tertiary cursor-pointer',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li role="treeitem" aria-expanded={isExpanded}>
      <div
        className={rowCls}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => onSelect(entry.path)}
      >
        <button
          type="button"
          aria-label={
            isExpanded
              ? t('dialogs.folderPicker.collapse')
              : t('dialogs.folderPicker.expand')
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggle(entry.path);
          }}
          className="p-0.5 rounded hover:bg-lightgray/30 text-text"
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-3 h-3" />
          ) : (
            <ChevronRightIcon className="w-3 h-3" />
          )}
        </button>
        <FolderIcon className="w-4 h-4 text-primary" />
        <span className="truncate text-text" title={entry.path}>
          {entry.name}
        </span>
        {node.loading && (
          <span
            className="ml-1 inline-block w-3 h-3 border-2 border-darkgray border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
        )}
      </div>
      {node.error && isExpanded && (
        <div
          className="text-xs text-error pl-2 py-1"
          style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}
        >
          {node.error}
        </div>
      )}
      {isExpanded && node.loaded && node.children.length === 0 && (
        <div
          className="text-xs text-darkgray py-1"
          style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}
        >
          {t('dialogs.folderPicker.noFolders')}
        </div>
      )}
      {isExpanded && node.children.length > 0 && (
        <ul role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedPath={selectedPath}
              onSelect={onSelect}
              isDisallowed={isDisallowed}
              nodes={nodes}
              nodeTick={nodeTick}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
