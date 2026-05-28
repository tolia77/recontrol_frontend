import type { FileEntry } from "../../services/files";
import type { ContextMenuState } from "./types";

/**
 * FileManager UI-flow reducer (Plan 27-01 / FILES-03).
 *
 * Models all dialog/prompt/editing/menu/operation-flow state that was
 * previously scattered across ~14 independent `useState` vars in
 * `FileManagerPanel.tsx` (D-03).
 *
 * Design invariants (cross-reference 27-CONTEXT):
 *   - Pure function: no side effects, no I/O, no Promise resolvers (D-05).
 *     Resolver callbacks live in `pendingResolversRef` in the container.
 *   - `warningPrompt` and `conflictPrompt` carry display data ONLY — the
 *     `resolve()` callback is NOT stored here (D-05).
 *   - `COMMIT_SUPPRESS_SINGLE_DELETE` is the ONLY transition that sets
 *     `suppressSingleDeleteConfirm: true`. The checkbox's pending value rides
 *     on `confirm.suppressOnConfirm` (toggled via `SET_SUPPRESS_ON_CONFIRM`)
 *     and is flushed to the session flag only on actual user confirmation.
 *     This preserves the commit-on-confirm semantics that fixed a prior bug
 *     where cancelling the dialog still suppressed future single-file deletes.
 *   - Unknown / forward-compat action types are ignored silently (`default:
 *     return state`).
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface FileManagerUiState {
  // Delete flow
  confirm: {
    kind: "delete";
    paths: string[];
    names: string[];
    /**
     * Local pending value for the "Don't ask again" checkbox.
     * Only flushed to `suppressSingleDeleteConfirm` (via
     * COMMIT_SUPPRESS_SINGLE_DELETE) when the user actually confirms the
     * delete. Cancelling the dialog must NOT flip the session flag.
     */
    suppressOnConfirm: boolean;
  } | null;
  isDeleting: boolean;
  /**
   * Session-scoped flag: when true, single-file deletes skip the confirm
   * dialog. Lives in reducer state ONLY — NOT persisted to any storage.
   * Resets on full page reload / component unmount.
   */
  suppressSingleDeleteConfirm: boolean;

  // Move / copy flow
  picker: { kind: "move" | "copy" } | null;
  isOperating: boolean;

  /**
   * Upload warning prompt — display data only.
   * The resolve callback is stored in `pendingResolversRef` in the container
   * (D-05). Never put `resolve` here.
   */
  warningPrompt: { fileName: string; sizeBytes: number } | null;

  /**
   * Conflict prompt — display data only.
   * The resolve callback is stored in `pendingResolversRef` in the container
   * (D-05). Never put `resolve` here.
   */
  conflictPrompt: {
    operation: "upload" | "move" | "copy";
    fileName: string;
    destinationPath: string;
  } | null;

  // Download gates
  downloadBlocked: { name: string; size: number } | null;
  pendingDownloadWarn: FileEntry | null;

  // Inline-edit flow
  newFolderPending: boolean;
  renamingPath: string | null;

  // Context menu
  contextMenu: ContextMenuState | null;

  // Disconnect banner
  disconnectBanner: string | null;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const initialFileManagerUiState: FileManagerUiState = {
  confirm: null,
  isDeleting: false,
  suppressSingleDeleteConfirm: false,
  picker: null,
  isOperating: false,
  warningPrompt: null,
  conflictPrompt: null,
  downloadBlocked: null,
  pendingDownloadWarn: null,
  newFolderPending: false,
  renamingPath: null,
  contextMenu: null,
  disconnectBanner: null,
};

// ---------------------------------------------------------------------------
// Action union
// ---------------------------------------------------------------------------

export type FileManagerUiAction =
  // Delete dialog
  | { type: "OPEN_DELETE_CONFIRM"; payload: { paths: string[]; names: string[] } }
  | { type: "CLOSE_DELETE_CONFIRM" }
  | { type: "SET_DELETING"; payload: boolean }
  /**
   * COMMIT_SUPPRESS_SINGLE_DELETE fires only on actual user confirmation (when
   * `confirm.suppressOnConfirm` is true). This is the ONLY action that sets
   * `suppressSingleDeleteConfirm: true`. Never dispatch it on checkbox toggle.
   */
  | { type: "COMMIT_SUPPRESS_SINGLE_DELETE" }
  /**
   * SET_SUPPRESS_ON_CONFIRM updates the local pending checkbox value on the
   * pending `confirm` object. It does NOT touch `suppressSingleDeleteConfirm`.
   */
  | { type: "SET_SUPPRESS_ON_CONFIRM"; payload: boolean }
  // Move / copy picker
  | { type: "OPEN_MOVE_PICKER" }
  | { type: "OPEN_COPY_PICKER" }
  | { type: "CLOSE_PICKER" }
  | { type: "SET_OPERATING"; payload: boolean }
  // Upload warning prompt (display data only — no resolver in payload)
  | { type: "OPEN_LARGE_UPLOAD_WARN"; payload: { fileName: string; sizeBytes: number } }
  | { type: "CLOSE_LARGE_UPLOAD_WARN" }
  // Name conflict prompt (display data only — no resolver in payload)
  | {
      type: "OPEN_CONFLICT_PROMPT";
      payload: {
        operation: "upload" | "move" | "copy";
        fileName: string;
        destinationPath: string;
      };
    }
  | { type: "CLOSE_CONFLICT_PROMPT" }
  // Download gates
  | { type: "OPEN_DOWNLOAD_BLOCKED"; payload: { name: string; size: number } }
  | { type: "CLOSE_DOWNLOAD_BLOCKED" }
  | { type: "OPEN_DOWNLOAD_WARN"; payload: FileEntry }
  | { type: "CLOSE_DOWNLOAD_WARN" }
  // Inline edit
  | { type: "OPEN_NEW_FOLDER" }
  | { type: "CLOSE_NEW_FOLDER" }
  | { type: "OPEN_RENAME"; payload: string }
  | { type: "CLOSE_RENAME" }
  // Context menu
  | { type: "OPEN_CONTEXT_MENU"; payload: ContextMenuState }
  | { type: "CLOSE_CONTEXT_MENU" }
  // Disconnect banner
  | { type: "SET_DISCONNECT_BANNER"; payload: string | null };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function fileManagerUiReducer(
  state: FileManagerUiState,
  action: FileManagerUiAction,
): FileManagerUiState {
  switch (action.type) {
    // ---- Delete dialog -------------------------------------------------- //

    case "OPEN_DELETE_CONFIRM":
      return {
        ...state,
        confirm: {
          kind: "delete",
          paths: action.payload.paths,
          names: action.payload.names,
          suppressOnConfirm: false,
        },
      };

    case "CLOSE_DELETE_CONFIRM":
      return { ...state, confirm: null };

    case "SET_DELETING":
      return { ...state, isDeleting: action.payload };

    case "COMMIT_SUPPRESS_SINGLE_DELETE":
      // Commit-on-confirm semantics (D-05 / §Established Patterns):
      // only fired when the user actually confirms deletion AND the
      // suppressOnConfirm checkbox was checked. This is the ONLY transition
      // that flips the session-scoped suppress flag to true.
      return { ...state, suppressSingleDeleteConfirm: true };

    case "SET_SUPPRESS_ON_CONFIRM":
      // Update the local pending checkbox value on the in-flight confirm
      // object. Guard: if confirm is null (dialog closed), no-op.
      return state.confirm
        ? { ...state, confirm: { ...state.confirm, suppressOnConfirm: action.payload } }
        : state;

    // ---- Move / copy picker --------------------------------------------- //

    case "OPEN_MOVE_PICKER":
      return { ...state, picker: { kind: "move" } };

    case "OPEN_COPY_PICKER":
      return { ...state, picker: { kind: "copy" } };

    case "CLOSE_PICKER":
      return { ...state, picker: null };

    case "SET_OPERATING":
      return { ...state, isOperating: action.payload };

    // ---- Upload warning prompt ------------------------------------------ //

    case "OPEN_LARGE_UPLOAD_WARN":
      return { ...state, warningPrompt: action.payload };

    case "CLOSE_LARGE_UPLOAD_WARN":
      return { ...state, warningPrompt: null };

    // ---- Conflict prompt ------------------------------------------------- //

    case "OPEN_CONFLICT_PROMPT":
      return { ...state, conflictPrompt: action.payload };

    case "CLOSE_CONFLICT_PROMPT":
      return { ...state, conflictPrompt: null };

    // ---- Download gates -------------------------------------------------- //

    case "OPEN_DOWNLOAD_BLOCKED":
      return { ...state, downloadBlocked: action.payload };

    case "CLOSE_DOWNLOAD_BLOCKED":
      return { ...state, downloadBlocked: null };

    case "OPEN_DOWNLOAD_WARN":
      return { ...state, pendingDownloadWarn: action.payload };

    case "CLOSE_DOWNLOAD_WARN":
      return { ...state, pendingDownloadWarn: null };

    // ---- Inline edit ----------------------------------------------------- //

    case "OPEN_NEW_FOLDER":
      return { ...state, newFolderPending: true };

    case "CLOSE_NEW_FOLDER":
      return { ...state, newFolderPending: false };

    case "OPEN_RENAME":
      return { ...state, renamingPath: action.payload };

    case "CLOSE_RENAME":
      return { ...state, renamingPath: null };

    // ---- Context menu ---------------------------------------------------- //

    case "OPEN_CONTEXT_MENU":
      return { ...state, contextMenu: action.payload };

    case "CLOSE_CONTEXT_MENU":
      return { ...state, contextMenu: null };

    // ---- Disconnect banner ----------------------------------------------- //

    case "SET_DISCONNECT_BANNER":
      return { ...state, disconnectBanner: action.payload };

    // ---- Forward-compat: unknown action types are silently ignored ------- //

    default:
      return state;
  }
}
