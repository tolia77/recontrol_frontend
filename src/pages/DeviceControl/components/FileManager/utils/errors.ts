import { FilesChannelError } from '../../../services/files';

/**
 * Map a {@link FilesChannelError} (or any unknown thrown value) to a single
 * human-readable English string for use in toast notifications.
 *
 * Branches on the structured `code` field rather than `message` so the wire
 * envelope stays stable. INVALID_NAME drills into `data.reason` (an
 * {@link InvalidNameReason} value) to surface a specific message per reason
 * (matches the wire-level guarantee from plan 09-04 and the desktop's
 * InvalidFileNameException semantics from 09-01).
 *
 * Keep the strings literal English for Phase 10. Phase 12 will replace this
 * function (or rewrite its internals) with i18next keyed lookups.
 *
 * Coverage matrix (every code referenced by the wire schema):
 *   - All 11 FilesErrorCode values (ALLOWLIST_VIOLATION, INVALID_NAME,
 *     NOT_FOUND, PERMISSION_DENIED, IO_ERROR, INTERNAL_ERROR, UNKNOWN_COMMAND,
 *     TIMEOUT, MALFORMED_RESPONSE, CHANNEL_NOT_OPEN, DISPOSED).
 *   - All 6 InvalidNameReason values (RESERVED, ILLEGAL_CHAR, TOO_LONG, EMPTY,
 *     DOT_ONLY, TRAILING_SPACE_OR_DOT).
 *
 * Anything not matching falls through to `err.message || 'Unknown error'`.
 */
export function mapFilesErrorToMessage(err: unknown): string {
  if (!(err instanceof FilesChannelError)) {
    return 'Unexpected error.';
  }
  const { code, data, message } = err.info;

  if (code === 'INVALID_NAME') {
    const reason = (data as { reason?: string } | undefined)?.reason;
    switch (reason) {
      case 'RESERVED':
        return 'Name is a reserved Windows name (e.g. CON, PRN, NUL).';
      case 'ILLEGAL_CHAR':
        return 'Name contains an illegal character.';
      case 'TOO_LONG':
        return 'Name is too long.';
      case 'EMPTY':
        return 'Name cannot be empty.';
      case 'DOT_ONLY':
        return 'Name cannot be only dots.';
      case 'TRAILING_SPACE_OR_DOT':
        return 'Name cannot end with a space or a dot.';
      default:
        return 'That name is not allowed.';
    }
  }

  switch (code) {
    case 'ALLOWLIST_VIOLATION':
      return 'That location is outside the shared area.';
    case 'NOT_FOUND':
      return 'Item not found. It may have been moved or deleted.';
    case 'PERMISSION_DENIED':
      return 'Permission denied on the remote computer.';
    case 'IO_ERROR':
      return 'The remote computer could not complete the operation.';
    case 'INTERNAL_ERROR':
      return 'The remote computer returned an unexpected error.';
    case 'UNKNOWN_COMMAND':
      return 'This version of ReControl Desktop does not support that command.';
    case 'TIMEOUT':
      return 'The remote computer did not respond in time.';
    case 'MALFORMED_RESPONSE':
      return 'The remote response was malformed.';
    case 'CHANNEL_NOT_OPEN':
      return 'Files channel is disconnected. Reconnect the stream.';
    case 'DISPOSED':
      return 'Files channel has been closed.';
    default:
      return message || 'Unknown error.';
  }
}
