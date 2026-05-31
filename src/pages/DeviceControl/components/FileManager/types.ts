/**
 * File Manager panel -- local types.
 *
 * All shapes are string-literal unions (no enums) to honor tsconfig
 * `erasableSyntaxOnly: true`. The panel-level `FileManagerState` is persisted
 * per-device-id in localStorage via `useFileManagerState`.
 */

export type SortColumn = "name" | "size" | "modified" | "type";

export type SortDirection = "asc" | "desc";

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

/**
 * Full panel state persisted (per-device) to localStorage. Selection + scroll
 * position are intentionally NOT here -- they are in-memory React state only
 * (Phase-10 Research decision; Plan 10-03 wires selection).
 */
export interface FileManagerState {
  panelOpen: boolean;
  splitRatio: number;
  /** Phase 20 D-01/D-02 + Phase 21 UI-02: which right pane is active (mutex). null = all closed. */
  rightPaneActive: "files" | "assistant" | "scenarios" | null;
  currentPath: string | null;
  sort: SortState;
  showHidden: boolean;
}

/**
 * Coarse file-type classification used for icon + "Type" column text.
 */
export type FileTypeKind =
  | "image"
  | "video"
  | "code"
  | "doc"
  | "text"
  | "other";

/**
 * In-memory selection state for the file manager listing. Plan 10-03 wires
 * Windows-Explorer-style single / shift / ctrl click semantics on top of this.
 *
 * - `selected`: the set of currently-selected entry paths.
 * - `focusedIndex`: row currently rendered as "focused" (arrow-key target);
 *   -1 when nothing is focused.
 * - `anchorIndex`: the row of the last single-click or ctrl-click; the pivot
 *   for shift-click range selection. -1 when no anchor exists.
 *
 * Selection is intentionally not persisted (Research Pattern 3 + Pitfall 5):
 * navigating to a new folder, or a different sort/filter that changes the
 * `entries` array identity, resets `selected` and `anchorIndex` to empty/-1
 * and clamps `focusedIndex` into the new range.
 */
export interface SelectionState {
  selected: ReadonlySet<string>;
  focusedIndex: number;
  anchorIndex: number;
}

/**
 * One row of a {@link ContextMenuState}. Plan 10-04 introduces this with a
 * Rename / Delete / Move / Copy shape; plan 10-05 turns the disabled stubs
 * live without changing the shape.
 *
 * - `separator: true` renders as a divider; the `label` and `onSelect` fields
 *   are ignored for that row but still required for shape uniformity.
 * - `disabled: true` makes the row click a no-op and renders dimmed.
 * - `danger: true` paints the label in `text-error` (used on Delete).
 */
export interface ContextMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

/**
 * State for the cursor-positioned context menu. When non-null the menu is
 * rendered at viewport coords {x, y}; closing the menu sets it back to null.
 *
 * Auto-flip semantics: if the menu would extend past the viewport edge, the
 * menu offsets itself by its own width / height so it stays on screen. The
 * primitive ({@link ContextMenu}) measures itself and applies the flip.
 */
export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

/**
 * Props for the {@link ConfirmDialog} primitive (plan 10-05). Used for the
 * destructive delete confirmation; reusable for any future yes/no modal that
 * needs to gate a wire round-trip behind explicit user assent.
 *
 * - `dangerous`: paints the primary button red and shifts default focus to
 *   Cancel (Windows-Explorer-style destructive action confirmation).
 * - `checkbox`: optional row rendered between body and buttons; the dialog
 *   does NOT own its checked state -- the caller passes the controlled value
 *   so the panel can persist (or NOT persist, as in the session-scoped
 *   "don't ask again for single-file deletes" flag) the choice.
 * - `isBusy`: load-bearing for destructive-op safety. When true, both
 *   Confirm and Cancel buttons are disabled, the Confirm button shows a
 *   spinner, and Esc / overlay-click cancellation are suppressed -- the
 *   wire call has already been fired, double-submit is forbidden.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  dangerous?: boolean;
  checkbox?: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  };
  isBusy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}
