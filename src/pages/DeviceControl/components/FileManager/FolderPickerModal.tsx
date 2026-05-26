import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "src/components/ui";
import type {
  FileEntry,
  FilesListResponse,
  FilesListRootsResponse,
} from "../../services/files";
import type { UseFilesChannel } from "../../hooks/useFilesChannel";
import { ChevronRightIcon, ChevronDownIcon, FolderIcon } from "./icons";
import { mapFilesErrorToMessage } from "./utils/errors";

interface FolderPickerModalProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  channel: UseFilesChannel;
  /**
   * Paths that cannot be selected as the destination. For Move this includes
   * the current parent (no-op) plus the source paths themselves (move-into-
   * self for folders). For Copy this is just the source paths -- copy into
   * the current parent IS allowed; the desktop's NAME_CONFLICT response and
   * the panel's conflict dialog handle rename ("Keep Both"). Deeper move-
   * into-self (descendant-of-source) is caught at the wire level via
   * ALLOWLIST_VIOLATION / IO_ERROR.
   */
  disallowedPaths?: string[];
  /**
   * The folder the user is currently viewing in the panel. Rendered with a
   * distinct "current location" badge so the user can orient themselves --
   * separate from {@link disallowedPaths} so we don't conflate "you are
   * here" with "this destination is forbidden". For Copy, this row is also
   * selectable; for Move, the parent caller adds it to disallowedPaths
   * since moving to where you already are is a no-op.
   */
  currentPath?: string | null;
  /**
   * In-flight gate. When true, the panel is iterating files.move /
   * files.copy sequentially over the source paths. Confirm + Cancel both
   * disabled, Confirm shows a spinner, Esc / overlay-click cancellation
   * suppressed -- mirrors the `isBusy` semantics used across file manager
   * dialogs.
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
 * Card is wider (`size="lg"`) since the tree wants a little horizontal
 * breathing room.
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
 * disabled, Esc and overlay-click cancellation are suppressed via
 * suppressEsc/suppressOverlayClick -- the panel will dismiss the modal in
 * its `finally` block.
 */
export function FolderPickerModal({
  open,
  title,
  confirmLabel,
  channel,
  disallowedPaths,
  currentPath,
  isBusy,
  onConfirm,
  onCancel,
}: FolderPickerModalProps) {
  const { t } = useTranslation("fileManager");
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
      setRootsError(t("panel.filesChannelDisconnected"));
      return;
    }
    let cancelled = false;
    request<Record<string, never>, FilesListRootsResponse>(
      "files.listRoots",
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
          "files.list",
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

  const canConfirm = !!selectedPath && !isDisallowed(selectedPath) && !isBusy;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="lg"
      suppressEsc={!!isBusy}
      suppressOverlayClick={!!isBusy}
    >
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body>
        <div className="border-lightgray bg-background mb-4 max-h-[60vh] overflow-auto rounded-md border p-1">
          {rootsError ? (
            <div className="text-error p-3 text-sm">{rootsError}</div>
          ) : roots === null ? (
            <div className="text-darkgray p-3 text-sm">
              {t("dialogs.folderPicker.loading")}
            </div>
          ) : roots.length === 0 ? (
            <div className="text-darkgray p-3 text-sm">
              {t("dialogs.folderPicker.noSharedFolders")}
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
                  currentPath={currentPath ?? null}
                  nodes={nodesRef.current}
                  // nodeTick wired in to force re-render when child cache mutates
                  nodeTick={nodeTick}
                />
              ))}
            </ul>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onCancel}
          disabled={!!isBusy}
          className="border-lightgray text-text hover:bg-tertiary rounded-md border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("dialogs.cancel")}
        </button>
        <button
          type="button"
          onClick={() => {
            if (selectedPath) onConfirm(selectedPath);
          }}
          disabled={!canConfirm}
          className="bg-accent inline-flex items-center gap-2 rounded-md px-4 py-2 text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy && (
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"
              aria-hidden="true"
            />
          )}
          {confirmLabel}
        </button>
      </Modal.Footer>
    </Modal>
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
  currentPath: string | null;
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
  currentPath,
  nodes,
  nodeTick,
}: TreeNodeProps) {
  const { t } = useTranslation("fileManager");
  const isExpanded = expanded.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const disallowed = isDisallowed(entry.path);
  const isCurrent = currentPath !== null && entry.path === currentPath;
  const node = nodes.get(entry.path) ?? EMPTY_NODE;
  // Reference nodeTick so eslint doesn't flag it; the ref-stored Map already
  // gives us the latest data, but React needs the prop in our deps to
  // schedule a re-render.
  void nodeTick;

  // "Current location" gets its own visual language so users don't read it
  // as disabled. When it's selectable (Copy), it stays at full opacity with
  // a hover affordance. When it's also disallowed (Move), we drop the
  // forbidden cursor but keep full text colour -- the badge carries the
  // semantics, not the greyed-out look.
  const rowCls = [
    "flex items-center gap-1 py-1 pl-1 pr-2 rounded transition-colors",
    isSelected
      ? "bg-accent/20 border-l-4 border-accent"
      : isCurrent
        ? "bg-primary/5 border-l-4 border-primary/40"
        : "border-l-4 border-transparent",
    disallowed
      ? isCurrent
        ? "cursor-default"
        : "opacity-50 cursor-not-allowed"
      : "hover:bg-tertiary cursor-pointer",
  ]
    .filter(Boolean)
    .join(" ");

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
              ? t("dialogs.folderPicker.collapse")
              : t("dialogs.folderPicker.expand")
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggle(entry.path);
          }}
          className="hover:bg-lightgray/30 text-text rounded p-0.5"
        >
          {isExpanded ? (
            <ChevronDownIcon className="h-3 w-3" />
          ) : (
            <ChevronRightIcon className="h-3 w-3" />
          )}
        </button>
        <FolderIcon className="text-primary h-4 w-4" />
        <span className="text-text truncate" title={entry.path}>
          {entry.name}
        </span>
        {isCurrent && (
          <span
            className="bg-primary/15 text-primary border-primary/30 ml-1 inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] tracking-wide uppercase"
            aria-label={t("dialogs.folderPicker.currentLabel")}
          >
            {t("dialogs.folderPicker.currentLabel")}
          </span>
        )}
        {node.loading && (
          <span
            className="border-darkgray ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-t-transparent"
            aria-hidden="true"
          />
        )}
      </div>
      {node.error && isExpanded && (
        <div
          className="text-error py-1 pl-2 text-xs"
          style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}
        >
          {node.error}
        </div>
      )}
      {isExpanded && node.loaded && node.children.length === 0 && (
        <div
          className="text-darkgray py-1 text-xs"
          style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}
        >
          {t("dialogs.folderPicker.noFolders")}
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
              currentPath={currentPath}
              nodes={nodes}
              nodeTick={nodeTick}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
