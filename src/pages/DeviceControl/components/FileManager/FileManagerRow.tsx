import { memo, useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { FileEntry } from "src/pages/DeviceControl/services/files/filesProtocol.generated";
import { IconForEntry } from "./icons";
import { formatBytes, formatDate, formatType } from "./utils/formatters";

export const ROW_HEIGHT_PX = 36;
export const MOBILE_ROW_HEIGHT_PX = 44;

interface FileManagerRowProps {
  entry: FileEntry;
  /** 0-based index in the visible (post-filter, post-sort) list. */
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  /** When this row's path === renamingPath, render an inline edit input. */
  isRenaming: boolean;
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
  /** Invoked when the inline rename input commits via Enter. */
  onRenameCommit: (newName: string) => void;
  /** Invoked on Esc / blur to cancel the rename. */
  onRenameCancel: () => void;
  /** Mobile: when true, row uses 44px touch height and shows a kebab button. */
  isMobile?: boolean;
  /** Mobile: called with the kebab button's DOMRect; parent positions ContextMenu. */
  onKebabClick?: (rect: DOMRect) => void;
  /** Translated aria-label for the mobile kebab button (threaded from listing). */
  moreActionsLabel?: string;
}

/**
 * Compute the index of the LAST `.` in a name, treated as the start of the
 * extension. Returns -1 for hidden dotfiles whose only dot is the leading one
 * (e.g. ".gitignore" -- the whole name should be selected, not "" before the
 * dot). Folders bypass this entirely (whole-name selection).
 */
function stemEnd(name: string, isDirectory: boolean): number {
  if (isDirectory) return name.length;
  // Find the last dot, but ignore a leading dot at index 0 -- ".env" should
  // be selected entirely, not "" before the dot.
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return name.length; // no extension OR pure dotfile
  return lastDot;
}

function FileManagerRowImpl({
  entry,
  index,
  isSelected,
  isFocused,
  isRenaming,
  onClick,
  onDoubleClick,
  onContextMenu,
  onRenameCommit,
  onRenameCancel,
  isMobile,
  onKebabClick,
  moreActionsLabel,
}: FileManagerRowProps) {
  // Visual hierarchy:
  //   Selected + Focused -> bg-primary/12 ring-1 ring-primary/30
  //   Selected           -> bg-primary/8 text-foreground
  //   Focused only       -> bg-surface-muted
  //   None               -> hover:bg-surface-muted
  const stateClass =
    isSelected && isFocused
      ? "bg-primary/12 ring-1 ring-primary/30"
      : isSelected
        ? "bg-primary/8 text-foreground"
        : isFocused
          ? "bg-surface-muted"
          : "hover:bg-surface-muted";

  const inputRef = useRef<HTMLInputElement>(null);

  // On enter into rename mode: focus the input + select only the stem.
  useEffect(() => {
    if (!isRenaming) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const end = stemEnd(entry.name, entry.isDirectory);
    try {
      el.setSelectionRange(0, end);
    } catch {
      // Some browsers throw on type="text" inputs in rare states; fall back
      // to selecting everything which is still better than nothing.
      el.select();
    }
  }, [isRenaming, entry.name, entry.isDirectory]);

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      onRenameCommit(e.currentTarget.value);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onRenameCancel();
      return;
    }
    // Stop propagation so parent panel keyboard handler (F2/Delete/Arrows)
    // doesn't trigger while the user types.
    e.stopPropagation();
  };

  const handleRowContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e);
  };

  const handleKebabClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onKebabClick?.(e.currentTarget.getBoundingClientRect());
  };

  return (
    <div
      role="row"
      data-row-index={index}
      onClick={isRenaming ? undefined : onClick}
      onDoubleClick={isRenaming ? undefined : onDoubleClick}
      onContextMenu={
        isRenaming ? (e) => e.stopPropagation() : handleRowContextMenu
      }
      className={[
        "border-border/50 grid cursor-default items-center border-b px-3 text-body select-none",
        isMobile
          ? "grid-cols-[1fr_auto] min-h-[44px]"
          : "grid-cols-[1fr_120px_180px_140px]",
        stateClass,
      ].join(" ")}
      style={isMobile ? undefined : { height: `${ROW_HEIGHT_PX}px` }}
    >
      <div className="flex min-w-0 items-center">
        <IconForEntry entry={entry} className="mr-2 h-4 w-4 flex-shrink-0" />
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            defaultValue={entry.name}
            onKeyDown={handleInputKeyDown}
            onBlur={onRenameCancel}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            className="bg-surface text-foreground border-primary min-w-0 flex-1 rounded border px-1 py-0.5 text-body outline-none"
          />
        ) : (
          <span className="text-foreground truncate" title={entry.name}>
            {entry.name}
          </span>
        )}
      </div>
      {isMobile ? (
        /* Mobile: kebab button replaces the desktop size/date/type columns */
        isMobile && onKebabClick ? (
          <button
            type="button"
            onClick={handleKebabClick}
            className="text-muted-foreground hover:text-foreground flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center bg-transparent"
            aria-label={moreActionsLabel ?? "More actions"}
          >
            ⋯
          </button>
        ) : null
      ) : (
        <>
          <div className="text-muted-foreground pr-4 text-right tabular-nums">
            {entry.isDirectory ? "" : formatBytes(entry.sizeBytes)}
          </div>
          <div className="text-muted-foreground">{formatDate(entry.modifiedUtc)}</div>
          <div className="text-muted-foreground truncate">
            {formatType(entry.name, entry.isDirectory)}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Memoized row; re-renders only when one of its scalar props changes
 * (entry identity, selection bit, focus bit, click handlers).
 */
const FileManagerRow = memo(FileManagerRowImpl);

export default FileManagerRow;
