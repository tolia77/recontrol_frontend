/**
 * files-ctl wire protocol: request/response envelopes and payloads for every command the
 * web UI may invoke on the desktop client. Transferred as JSON over the 'files-ctl' WebRTC
 * data channel. Phase 9 introduced request/response; Phase 11 adds server-pushed event
 * envelopes (status:'event') and the six transfer-control commands
 * (files.upload.begin/complete, files.download.begin/complete, files.transfer.cancel,
 * files.transfer.error).
 */
export interface FilesProtocolGenerated {
  error?: FilesError;
  errorCode?: FilesErrorCode;
  errorEnvelope?: FilesErrorEnvelope;
  fileEntry?: FileEntry;
  filesCopyRequest?: FilesCopyRequest;
  filesCopyResponse?: FilesCopyResponse;
  filesDeleteRequest?: FilesDeleteRequest;
  filesDeleteResponse?: FilesDeleteResponse;
  filesDownloadBeginRequest?: FilesDownloadBeginRequest;
  filesDownloadBeginResponse?: FilesDownloadBeginResponse;
  filesDownloadCompletePayload?: FilesDownloadCompletePayload;
  filesEventEnvelope?: FilesEventEnvelope;
  filesListRequest?: FilesListRequest;
  filesListResponse?: FilesListResponse;
  filesListRootsRequest?: FilesListRootsRequest;
  filesListRootsResponse?: FilesListRootsResponse;
  filesMkdirRequest?: FilesMkdirRequest;
  filesMkdirResponse?: FilesMkdirResponse;
  filesMoveRequest?: FilesMoveRequest;
  filesMoveResponse?: FilesMoveResponse;
  filesRenameRequest?: FilesRenameRequest;
  filesRenameResponse?: FilesRenameResponse;
  filesTransferCancelRequest?: FilesTransferCancelRequest;
  filesTransferCancelResponse?: FilesTransferCancelResponse;
  filesTransferErrorPayload?: FilesTransferErrorPayload;
  filesUploadBeginRequest?: FilesUploadBeginRequest;
  filesUploadBeginResponse?: FilesUploadBeginResponse;
  filesUploadCompleteRequest?: FilesUploadCompleteRequest;
  filesUploadCompleteResponse?: FilesUploadCompleteResponse;
  invalidNameReason?: InvalidNameReason;
  nameConflictMode?: NameConflictMode;
  request?: FilesRequestEnvelope;
  success?: FilesSuccessEnvelope;
}

/**
 * Structured error object carried in FilesErrorEnvelope.error. Code is stable; message is a
 * fallback string the backend may supply for developer logs (the frontend should key off
 * code for user-facing text). Data is a free-form object whose shape depends on code (e.g.,
 * INVALID_NAME uses { reason: InvalidNameReason }).
 *
 * Structured error describing why the request failed.
 *
 * Structured FilesError describing the failure (typical codes: STALLED, IO_ERROR,
 * DISK_FULL, INTERNAL_ERROR).
 */
export interface FilesError {
  /**
   * Stable machine-readable identifier for the error class.
   */
  code: FilesErrorCode;
  /**
   * Optional structured context whose shape depends on code. For INVALID_NAME: { reason:
   * InvalidNameReason }. For ALLOWLIST_VIOLATION: { path: string }. For IO_ERROR: { errno?:
   * string }.
   */
  data?: { [key: string]: any };
  /**
   * Fallback human-readable description for logs / debugging. Not a user-facing string.
   */
  message: string;
}

/**
 * Stable machine-readable identifier for the error class.
 *
 * Stable machine-readable error codes. Codes are frozen for the lifetime of the protocol;
 * add new codes rather than repurposing old ones. Human-readable messages are produced from
 * these codes by the frontend i18n layer in Phase 12. Phase-11 additions
 * (TRANSFER_NOT_FOUND, CANCELLED, STALLED, DISK_FULL) cover transfer-pipeline cancel races,
 * stall pushes, and disk-full reports. Phase-12 additions (PERMISSION_READ,
 * PERMISSION_WRITE, SOURCE_GONE, DESTINATION_GONE, NAME_CONFLICT) split permission errors
 * by direction and add explicit codes for missing source/destination and destination-name
 * collisions so the frontend can render actionable dialogs without parsing free-text
 * messages.
 */
export type FilesErrorCode =
  | "ALLOWLIST_VIOLATION"
  | "INVALID_NAME"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "PERMISSION_READ"
  | "PERMISSION_WRITE"
  | "SOURCE_GONE"
  | "DESTINATION_GONE"
  | "NAME_CONFLICT"
  | "IO_ERROR"
  | "INTERNAL_ERROR"
  | "UNKNOWN_COMMAND"
  | "TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "CHANNEL_NOT_OPEN"
  | "DISPOSED"
  | "TRANSFER_NOT_FOUND"
  | "CANCELLED"
  | "STALLED"
  | "DISK_FULL";

/**
 * Negative response envelope. status is always 'error' and error carries the structured
 * FilesError.
 */
export interface FilesErrorEnvelope {
  /**
   * Structured error describing why the request failed.
   */
  error: FilesError;
  /**
   * Same correlation id as the request.
   */
  id: string;
  /**
   * Discriminator: always the literal string 'error' on this envelope.
   */
  status: ErrorEnvelopeStatus;
}

export type ErrorEnvelopeStatus = "error";

/**
 * Metadata for a single file or directory within an allowlisted root.
 */
export interface FileEntry {
  /**
   * True if the entry is a directory, false for regular files. Symlinks that escape the
   * allowlist are never returned.
   */
  isDirectory: boolean;
  /**
   * True if the entry is hidden per the host platform: FileAttributes.Hidden on Windows,
   * leading dot on POSIX. Frontend filters these out by default and exposes a 'Show hidden
   * files' toggle.
   */
  isHidden: boolean;
  /**
   * Last-modified timestamp in ISO-8601 / RFC-3339 UTC form (e.g. 2026-04-24T08:25:31Z).
   */
  modifiedUtc: Date;
  /**
   * Base name of the entry (no path separators).
   */
  name: string;
  /**
   * Canonical absolute path of the entry as observed by the desktop after allowlist
   * resolution.
   */
  path: string;
  /**
   * Size in bytes. For directories, value is 0 and callers should ignore it.
   */
  sizeBytes: number;
}

/**
 * Request payload for files.copy. Copies a single file from src to dst. Directory copy is
 * out of scope for Phase 9.
 */
export interface FilesCopyRequest {
  /**
   * Absolute canonical destination path. Parent must exist.
   */
  dst: string;
  /**
   * Conflict behavior when destination name already exists.
   */
  mode: NameConflictMode;
  /**
   * Absolute canonical source path (file, not directory).
   */
  src: string;
}

/**
 * Conflict behavior when destination name already exists.
 *
 * Name-conflict behavior for upload/move/copy commands.
 */
export type NameConflictMode = "fail" | "replace" | "skip" | "keepBoth";

/**
 * Response payload for files.copy. Echoes the resolved src and dst.
 */
export interface FilesCopyResponse {
  /**
   * Canonical destination path of the created copy.
   */
  dst: string;
  /**
   * Canonical source path.
   */
  src: string;
}

/**
 * Request payload for files.delete. Deletes a file or empty directory; recursive deletion
 * is explicitly out of scope for Phase 9.
 */
export interface FilesDeleteRequest {
  /**
   * Absolute canonical path to delete.
   */
  path: string;
}

/**
 * Response payload for files.delete. No fields; an empty object indicates success.
 */
export interface FilesDeleteResponse {}

/**
 * Request payload for files.download.begin. Asks the desktop to start streaming the bytes
 * of path over files-data. The desktop allocates a transferId and begins sending chunks.
 */
export interface FilesDownloadBeginRequest {
  /**
   * Absolute canonical path of the file to download. Must resolve inside an allowlisted root
   * and must be a regular file.
   */
  path: string;
}

/**
 * Response payload for files.download.begin. Returns the desktop-allocated transferId,
 * total size, and base name so the browser can preallocate buffers and surface filename in
 * UI.
 */
export interface FilesDownloadBeginResponse {
  /**
   * Base name of the file (no path separators). Used by the browser to suggest a Save-As
   * filename.
   */
  name: string;
  /**
   * Total size of the file in bytes as observed by the desktop at request time.
   */
  size: number;
  /**
   * Unsigned 32-bit identifier allocated by the desktop. Every files-data chunk header will
   * carry this id.
   */
  transferId: number;
}

/**
 * Payload for the files.download.complete server-pushed event. Sent by the desktop on the
 * files-ctl channel after the last chunk for transferId has been written to files-data, so
 * the browser knows when to finalize / save the assembled bytes.
 */
export interface FilesDownloadCompletePayload {
  /**
   * Total bytes streamed. Browser uses this to verify reassembly length.
   */
  totalBytes: number;
  /**
   * Identifier of the download that just finished.
   */
  transferId: number;
}

/**
 * Server-pushed event envelope. Distinguished from request/response envelopes by
 * status:'event'. Used for files.download.complete and files.transfer.error in Phase 11.
 * The frontend's FilesChannelClient dispatches these to listeners registered by command
 * name (NOT correlated by id).
 */
export interface FilesEventEnvelope {
  /**
   * Event identifier, e.g. 'files.download.complete' or 'files.transfer.error'.
   */
  command: string;
  /**
   * Event-specific payload. Shape depends on command.
   */
  payload: { [key: string]: any };
  status: FilesEventEnvelopeStatus;
}

export type FilesEventEnvelopeStatus = "event";

/**
 * Request payload for files.list. Lists immediate children of path (non-recursive).
 */
export interface FilesListRequest {
  /**
   * Absolute canonical path to list. Must resolve inside an allowlisted root after symlink
   * resolution.
   */
  path: string;
}

/**
 * Response payload for files.list. Mirrors the requested path and carries the enumerated
 * entries.
 */
export interface FilesListResponse {
  /**
   * Direct children of path. Does not include '.' or '..'. Sort order is unspecified; the UI
   * sorts client-side.
   */
  entries: FileEntry[];
  /**
   * Canonical path that was listed. Echoes the request after canonicalization.
   */
  path: string;
}

/**
 * Request payload for files.listRoots. No parameters.
 */
export interface FilesListRootsRequest {}

/**
 * Response payload for files.listRoots. Returns the allowlisted roots the caller is
 * permitted to browse.
 */
export interface FilesListRootsResponse {
  /**
   * Allowlisted roots exposed to the browser. Each entry is presented as a FileEntry with
   * isDirectory=true.
   */
  roots: FileEntry[];
}

/**
 * Request payload for files.mkdir. Creates a single new subdirectory inside parentPath.
 */
export interface FilesMkdirRequest {
  /**
   * Name of the new directory. Must pass name validation (no reserved names, no illegal
   * chars).
   */
  name: string;
  /**
   * Absolute canonical path of the parent directory. Must resolve inside an allowlisted root.
   */
  parentPath: string;
}

/**
 * Response payload for files.mkdir. Returns the path of the newly created directory.
 */
export interface FilesMkdirResponse {
  /**
   * Canonical path of the created directory.
   */
  path: string;
}

/**
 * Request payload for files.move. Moves src to dst; both must resolve inside allowlisted
 * roots.
 */
export interface FilesMoveRequest {
  /**
   * Absolute canonical destination path. Parent must exist.
   */
  dst: string;
  /**
   * Conflict behavior when destination name already exists.
   */
  mode: NameConflictMode;
  /**
   * Absolute canonical source path.
   */
  src: string;
}

/**
 * Response payload for files.move. Echoes the resolved src and dst.
 */
export interface FilesMoveResponse {
  /**
   * Canonical destination path after the move.
   */
  dst: string;
  /**
   * Canonical source path as it was at request time.
   */
  src: string;
}

/**
 * Request payload for files.rename. Renames path to a sibling with newName; does not move
 * across directories.
 */
export interface FilesRenameRequest {
  /**
   * New base name (no path separators). Must pass name validation.
   */
  newName: string;
  /**
   * Absolute canonical path of the entry to rename.
   */
  path: string;
}

/**
 * Response payload for files.rename. Returns the new canonical path.
 */
export interface FilesRenameResponse {
  /**
   * Canonical path of the entry after rename.
   */
  path: string;
}

/**
 * Request payload for files.transfer.cancel. Aborts an in-flight upload or download
 * identified by transferId. Idempotent: cancelling an already-finished or already-cancelled
 * transfer returns success.
 */
export interface FilesTransferCancelRequest {
  /**
   * Why the cancel is being issued. Pinned at schema level to prevent drift; receivers MAY
   * treat unknown values as 'user'.
   */
  reason: Reason;
  /**
   * Identifier of the transfer to cancel, as returned by files.upload.begin or
   * files.download.begin.
   */
  transferId: number;
}

/**
 * Why the cancel is being issued. Pinned at schema level to prevent drift; receivers MAY
 * treat unknown values as 'user'.
 */
export type Reason = "user" | "disconnect" | "stalled" | "desktop_error";

/**
 * Response payload for files.transfer.cancel. No fields; an empty object indicates success.
 */
export interface FilesTransferCancelResponse {}

/**
 * Payload for the files.transfer.error server-pushed event. Sent by the desktop when an
 * in-flight transfer fails (stall, IO error, disk full, etc). The frontend dispatches by
 * command name and matches transferId to the active transfer.
 */
export interface FilesTransferErrorPayload {
  /**
   * Structured FilesError describing the failure (typical codes: STALLED, IO_ERROR,
   * DISK_FULL, INTERNAL_ERROR).
   */
  error: FilesError;
  /**
   * Identifier of the transfer that failed.
   */
  transferId: number;
}

/**
 * Request payload for files.upload.begin. Reserves a transferId on the desktop side for an
 * upload (browser->desktop) and returns the .partial path that will receive bytes over the
 * files-data channel.
 */
export interface FilesUploadBeginRequest {
  /**
   * Conflict behavior when destination name already exists.
   */
  mode: NameConflictMode;
  /**
   * Final base name of the uploaded file (no path separators). Must pass name validation.
   */
  name: string;
  /**
   * Absolute canonical path of the parent directory. Must resolve inside an allowlisted root.
   */
  parentPath: string;
  /**
   * Total size of the file in bytes as known to the browser. Used by the desktop to decide on
   * disk-space and to verify completion.
   */
  size: number;
}

/**
 * Response payload for files.upload.begin. Returns the desktop-allocated transferId and the
 * .partial path the desktop will write incoming chunks to.
 */
export interface FilesUploadBeginResponse {
  /**
   * Canonical absolute path of the .partial file the desktop will write into. Renamed to the
   * final name on files.upload.complete.
   */
  partialPath: string;
  /**
   * Unsigned 32-bit identifier allocated by the desktop. The browser MUST echo this in every
   * chunk header on files-data and in any subsequent files.upload.complete /
   * files.transfer.cancel for this transfer.
   */
  transferId: number;
}

/**
 * Request payload for files.upload.complete. Signals that all bytes have been sent on
 * files-data. The desktop verifies the .partial size matches expectedBytes, then renames
 * .partial to the final name.
 */
export interface FilesUploadCompleteRequest {
  /**
   * Total bytes the browser sent on files-data for this transfer. Desktop rejects if .partial
   * size differs.
   */
  expectedBytes: number;
  /**
   * Identifier returned by the matching files.upload.begin response.
   */
  transferId: number;
}

/**
 * Response payload for files.upload.complete. Returns the canonical path of the final file
 * after the .partial -> final rename.
 */
export interface FilesUploadCompleteResponse {
  /**
   * Canonical absolute path of the finalized file.
   */
  path: string;
}

/**
 * Refinement of INVALID_NAME errors so the UI can render a specific reason without parsing
 * free-text messages.
 */
export type InvalidNameReason =
  | "RESERVED"
  | "ILLEGAL_CHAR"
  | "TOO_LONG"
  | "EMPTY"
  | "DOT_ONLY"
  | "TRAILING_SPACE_OR_DOT";

/**
 * Every request sent from the frontend to the desktop on the files-ctl channel. id is a
 * UUID chosen by the caller; the same id appears on the matching response envelope.
 */
export interface FilesRequestEnvelope {
  /**
   * Dot-namespaced command identifier, e.g. files.list.
   */
  command: string;
  /**
   * Caller-chosen correlation id (UUID v4 recommended).
   */
  id: string;
  /**
   * Command-specific request payload. Shape depends on command.
   */
  payload: { [key: string]: any };
}

/**
 * Positive response envelope. result shape depends on the request command.
 */
export interface FilesSuccessEnvelope {
  /**
   * Same correlation id as the request.
   */
  id: string;
  /**
   * Command-specific success result. May be null for commands whose response carries no data
   * (e.g. files.delete).
   */
  result: { [key: string]: any } | null;
  /**
   * Discriminator: always the literal string 'success' on this envelope.
   */
  status: SuccessStatus;
}

export type SuccessStatus = "success";
