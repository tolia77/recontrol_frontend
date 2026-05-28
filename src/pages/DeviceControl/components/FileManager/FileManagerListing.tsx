import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { FileEntry, FilesListResponse } from "src/pages/DeviceControl/services/files/filesProtocol.generated";
import { FilesChannelError } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import { useToast } from "src/components/ui";
import type { UseFilesChannel } from "src/pages/DeviceControl/hooks/realtime/useFilesChannel";
import type { useFileManagerSelection } from "src/pages/DeviceControl/hooks/state/useFileManagerSelection";
import type { SortColumn, SortState } from "./types";
import FileManagerRow, { ROW_HEIGHT_PX } from "./FileManagerRow";
import { FolderIcon } from "./icons";
import { compareEntries } from "./utils/sort";

/**
 * Threshold for "second click on already-selected-and-focused row arms rename"
 * (Windows Explorer parity). A second click within this many ms of the first
 * is treated as a double-click (handled by React's onDoubleClick); a second
 * click after this delay arms the inline rename flow.
 */
const RENAME_CLICK_DELAY_MS = 500;

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

  // ----- Plan 10-04 additions -----

  /** When true, render a pseudo-row at the top of the list with an inline input. */
  newFolderPending: boolean;
  /** Called when the new-folder input commits via Enter. */
  onNewFolderCommit: (name: string) => void;
  /** Called when the new-folder input cancels via Esc / blur. */
  onNewFolderCancel: () => void;
  /** Path of the row currently in inline-rename mode, or null. */
  renamingPath: string | null;
  /** Called when an existing row's rename input commits via Enter. */
  onRenameCommit: (path: string, newName: string) => void;
  /** Called when an existing row's rename input cancels via Esc / blur. */
  onRenameCancel: () => void;
  /** Called when a row is right-clicked. The panel opens the row context menu. */
  onRowContextMenu: (e: MouseEvent, entry: FileEntry) => void;
  /** Called when the empty area of the listing is right-clicked. */
  onEmptyContextMenu: (e: MouseEvent) => void;
  /** Called by row click handler when the second-click-to-rename heuristic fires. */
  onRenameArm: (path: string) => void;
}

type ListingState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; entries: FileEntry[] };

function errorMessageFor(
  err: FilesChannelError,
  t: TFunction<"fileManager">,
): string {
  switch (err.info.code) {
    case "ALLOWLIST_VIOLATION":
      return t("errors.listing.allowlistViolation");
    case "NOT_FOUND":
      return t("errors.listing.notFound");
    case "PERMISSION_DENIED":
      return t("errors.listing.permissionDenied");
    case "TIMEOUT":
      return t("errors.listing.timeout");
    case "CHANNEL_NOT_OPEN":
      return t("errors.listing.channelNotOpen");
    case "DISPOSED":
      return t("errors.listing.disposed");
    default:
      return t("errors.listing.couldNotLoadFolder");
  }
}

/**
 * Virtualized 4-column (Name / Size / Modified / Type) listing with sticky
 * header, monotonic request-id guard against stale responses, and Windows-
 * Explorer-style click-selection (single / shift-range / ctrl-toggle).
 *
 * Plan 10-04 adds:
 *   - Pseudo-row for new folder creation (rendered ABOVE the virtualized rows;
 *     not part of the virtualizer's index space so it doesn't shift the row
 *     indices the selection / keyboard handlers operate on).
 *   - Per-row inline rename input (when entry.path === renamingPath).
 *   - Right-click handlers (row + empty area) that open a {@link ContextMenu}
 *     in the parent panel.
 *   - Second-click-to-rename heuristic (RENAME_CLICK_DELAY_MS): a click on a
 *     row that is ALREADY solo-selected and focused, occurring more than
 *     500ms after the previous click on it, arms inline rename. A click within
 *     500ms is left to React's onDoubleClick to handle as activation.
 */
function FileManagerListing({
  channel,
  path,
  sort,
  onToggleSort,
  refreshKey,
  showHidden,
  selection,
  onVisibleEntriesChange,
  onActivate,
  newFolderPending,
  onNewFolderCommit,
  onNewFolderCancel,
  renamingPath,
  onRenameCommit,
  onRenameCancel,
  onRowContextMenu,
  onEmptyContextMenu,
  onRenameArm,
}: FileManagerListingProps) {
  const { t } = useTranslation("fileManager");
  const [state, setState] = useState<ListingState>({ kind: "idle" });
  const toast = useToast();

  // Monotonic request id; drop any response whose id is not the current max.
  const requestIdRef = useRef(0);

  // Per-path last-click timestamps for the second-click-to-rename heuristic.
  // Keyed by entry.path so that switching focus between rows doesn't carry
  // a stale timestamp from a previous row.
  const lastClickByPathRef = useRef<Map<string, number>>(new Map());

  // Reset when the channel closes entirely.
  useEffect(() => {
    if (!channel.request) {
      setState({ kind: "idle" });
    }
  }, [channel.request]);

  // Fire a new files.list every time path or refreshKey changes (sort + hidden
  // filter are client-side -- no round-trip needed).
  useEffect(() => {
    const request = channel.request;
    if (!request || !path) {
      setState({ kind: "idle" });
      return;
    }
    const myId = ++requestIdRef.current;
    setState({ kind: "loading" });
    request<{ path: string }, FilesListResponse>("files.list", { path })
      .then((res) => {
        if (myId !== requestIdRef.current) return; // stale
        setState({ kind: "ready", entries: res.entries });
      })
      .catch((err: unknown) => {
        if (myId !== requestIdRef.current) return; // stale
        const message =
          err instanceof FilesChannelError
            ? errorMessageFor(err, t)
            : t("errors.listing.unexpectedLoadingFolder");
        setState({ kind: "error", message });
        toast.error(message);
      });
  }, [channel.request, path, refreshKey, toast, t]);

  // Apply the show-hidden filter BEFORE sorting (NAV-14; isHidden guaranteed
  // by plan 10-01).
  const visibleEntries = useMemo<FileEntry[]>(() => {
    if (state.kind !== "ready") return [];
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
    (index: number, entry: FileEntry, e: MouseEvent<HTMLDivElement>) => {
      const now = Date.now();
      const lastAt = lastClickByPathRef.current.get(entry.path) ?? 0;
      lastClickByPathRef.current.set(entry.path, now);

      if (e.shiftKey) {
        selection.extendTo(index);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        selection.toggle(index);
        return;
      }

      // Plain single-click. Second-click-to-rename heuristic: if the row is
      // ALREADY solo-selected AND focused, AND the previous click on it was
      // more than RENAME_CLICK_DELAY_MS ago, arm inline rename.
      const isSoloSelected =
        selection.state.selected.size === 1 &&
        selection.state.selected.has(entry.path);
      const isFocused = selection.state.focusedIndex === index;
      const dt = now - lastAt;
      if (
        isSoloSelected &&
        isFocused &&
        lastAt > 0 &&
        dt > RENAME_CLICK_DELAY_MS &&
        renamingPath !== entry.path
      ) {
        onRenameArm(entry.path);
        return;
      }

      selection.selectOnly(index);
    },
    [selection, onRenameArm, renamingPath],
  );

  const handleRowDoubleClick = useCallback(
    (entry: FileEntry) => {
      onActivate(entry);
    },
    [onActivate],
  );

  const handleNewFolderKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onNewFolderCommit(e.currentTarget.value);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onNewFolderCancel();
        return;
      }
      // Don't let typing leak to the panel keyboard handler.
      e.stopPropagation();
    },
    [onNewFolderCommit, onNewFolderCancel],
  );

  // Auto-focus + select-all on the new folder input as soon as it mounts.
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!newFolderPending) return;
    const el = newFolderInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [newFolderPending]);

  const sortIndicator = (col: SortColumn) => {
    if (sort.column !== col) return null;
    return (
      <span className="ml-1 text-xs">
        {sort.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const renderHeaderButton = (
    label: string,
    col: SortColumn,
    align: "left" | "right" = "left",
  ) => (
    <button
      type="button"
      onClick={() => onToggleSort(col)}
      className={[
        "hover:bg-tertiary/60 flex h-full cursor-pointer items-center gap-1 px-3 transition-colors select-none",
        align === "right" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <span>{label}</span>
      {sortIndicator(col)}
    </button>
  );

  const focusedIndex = selection.state.focusedIndex;
  const selectedPaths = selection.state.selected;

  const handleScrollContainerContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    // Only fire when the click was NOT on a row (rows stopPropagation in
    // their own onContextMenu). Empty-area clicks land here.
    e.preventDefault();
    onEmptyContextMenu(e);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Sticky 4-column header */}
      <div
        role="row"
        className="bg-background border-lightgray text-text grid flex-shrink-0 grid-cols-[1fr_120px_180px_140px] border-b text-sm font-semibold"
        style={{ height: `${ROW_HEIGHT_PX}px` }}
      >
        {renderHeaderButton(t("listing.columnName"), "name", "left")}
        {renderHeaderButton(t("listing.columnSize"), "size", "right")}
        {renderHeaderButton(t("listing.columnModified"), "modified", "left")}
        {renderHeaderButton(t("listing.columnType"), "type", "left")}
      </div>

      {/* New-folder pseudo-row, rendered ABOVE the scroll container so it's
          always visible regardless of scroll position. */}
      {newFolderPending && (
        <div
          role="row"
          className="border-lightgray/50 bg-tertiary/30 grid flex-shrink-0 grid-cols-[1fr_120px_180px_140px] items-center border-b px-3 text-sm"
          style={{ height: `${ROW_HEIGHT_PX}px` }}
          onContextMenu={(e) => e.stopPropagation()}
        >
          <div className="flex min-w-0 items-center">
            <FolderIcon className="text-primary mr-2 h-4 w-4 flex-shrink-0" />
            <input
              ref={newFolderInputRef}
              type="text"
              defaultValue={t("listing.defaultNewFolderName")}
              onKeyDown={handleNewFolderKeyDown}
              onBlur={onNewFolderCancel}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              className="bg-background text-text border-accent min-w-0 flex-1 rounded border px-1 py-0.5 text-sm outline-none"
            />
          </div>
          <div />
          <div />
          <div />
        </div>
      )}

      <div
        ref={parentRef}
        className="min-h-0 flex-1 overflow-auto"
        onContextMenu={handleScrollContainerContextMenu}
      >
        {state.kind === "idle" && !path && (
          <div className="text-darkgray p-4 text-sm">
            {t("listing.selectFolderPrompt")}
          </div>
        )}
        {state.kind === "loading" && (
          <div className="text-darkgray p-4 text-sm">
            {t("listing.loading")}
          </div>
        )}
        {state.kind === "error" && (
          <div className="text-error p-4 text-sm">{state.message}</div>
        )}
        {state.kind === "ready" &&
          visibleEntries.length === 0 &&
          !newFolderPending && (
            <div className="text-darkgray p-4 text-sm">
              {t("listing.emptyFolder")}
            </div>
          )}
        {state.kind === "ready" && visibleEntries.length > 0 && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = visibleEntries[virtualRow.index];
              if (!entry) return null;
              const index = virtualRow.index;
              return (
                <div
                  key={entry.path}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${ROW_HEIGHT_PX}px`,
                  }}
                >
                  <FileManagerRow
                    entry={entry}
                    index={index}
                    isSelected={selectedPaths.has(entry.path)}
                    isFocused={focusedIndex === index}
                    isRenaming={renamingPath === entry.path}
                    onClick={(e) => handleRowClick(index, entry, e)}
                    onDoubleClick={() => handleRowDoubleClick(entry)}
                    onContextMenu={(e) => onRowContextMenu(e, entry)}
                    onRenameCommit={(newName) =>
                      onRenameCommit(entry.path, newName)
                    }
                    onRenameCancel={onRenameCancel}
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

export default FileManagerListing;
