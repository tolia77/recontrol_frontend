/**
 * File Manager panel -- local types.
 *
 * All shapes are string-literal unions (no enums) to honor tsconfig
 * `erasableSyntaxOnly: true`. The panel-level `FileManagerState` is persisted
 * per-device-id in localStorage via `useFileManagerState`.
 */

export type SortColumn = 'name' | 'size' | 'modified' | 'type';

export type SortDirection = 'asc' | 'desc';

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
  currentPath: string | null;
  sort: SortState;
  showHidden: boolean;
}

/**
 * Coarse file-type classification used for icon + "Type" column text.
 */
export type FileTypeKind =
  | 'image'
  | 'video'
  | 'code'
  | 'doc'
  | 'text'
  | 'other';

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
