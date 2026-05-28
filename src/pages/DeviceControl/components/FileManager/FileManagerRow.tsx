import { memo, useEffect, useRef } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { FileEntry } from "../../services/files";
import { IconForEntry } from "./icons";
import { formatBytes, formatDate, formatType } from "./utils/formatters";

export const ROW_HEIGHT_PX = 36;

interface FileManagerRowProps {
  entry: FileEntry;
  /** 0-based index in the visible (post-filter, post-sort) list. */
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  /** Plan 10-04: when this row's path === renamingPath, render inline input. */
  isRenaming: boolean;
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
  /** Plan 10-04: invoked when the inline rename input commits via Enter. */
  onRenameCommit: (newName: string) => void;
  /** Plan 10-04: invoked on Esc / blur to cancel the rename. */
  onRenameCancel: () => void;
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
}: FileManagerRowProps) {
  // Visual hierarchy:
  //   Selected + Focused -> bg-accent/30 ring-1 ring-accent
  //   Selected           -> bg-accent/20 text-text
  //   Focused only       -> bg-tertiary
  //   None               -> hover:bg-tertiary
  const stateClass =
    isSelected && isFocused
      ? "bg-accent/30 ring-1 ring-accent"
      : isSelected
        ? "bg-accent/20 text-text"
        : isFocused
          ? "bg-tertiary"
          : "hover:bg-tertiary/60";

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
        "border-lightgray/50 grid cursor-default grid-cols-[1fr_120px_180px_140px] items-center border-b px-3 text-sm select-none",
        stateClass,
      ].join(" ")}
      style={{ height: `${ROW_HEIGHT_PX}px` }}
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
            className="bg-background text-text border-accent min-w-0 flex-1 rounded border px-1 py-0.5 text-sm outline-none"
          />
        ) : (
          <span className="text-text truncate" title={entry.name}>
            {entry.name}
          </span>
        )}
      </div>
      <div className="text-darkgray pr-4 text-right tabular-nums">
        {entry.isDirectory ? "" : formatBytes(entry.sizeBytes)}
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
const FileManagerRow = memo(FileManagerRowImpl);

export default FileManagerRow;
