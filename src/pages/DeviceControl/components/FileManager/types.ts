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
