import { FilesChannelError } from "src/pages/DeviceControl/services/files";
import type { TFunction } from "i18next";

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
 *   - All 15 FilesErrorCode values (ALLOWLIST_VIOLATION, INVALID_NAME,
 *     NOT_FOUND, PERMISSION_DENIED, IO_ERROR, INTERNAL_ERROR, UNKNOWN_COMMAND,
 *     TIMEOUT, MALFORMED_RESPONSE, CHANNEL_NOT_OPEN, DISPOSED, plus the four
 *     phase-11 transfer codes TRANSFER_NOT_FOUND, CANCELLED, STALLED,
 *     DISK_FULL).
 *   - All 6 InvalidNameReason values (RESERVED, ILLEGAL_CHAR, TOO_LONG, EMPTY,
 *     DOT_ONLY, TRAILING_SPACE_OR_DOT).
 *
 * Anything not matching falls through to `err.message || 'Unknown error'`.
 */
export function mapFilesErrorToMessage(
  err: unknown,
  t: TFunction<"fileManager">,
): string {
  if (!(err instanceof FilesChannelError)) {
    return t("errors.unexpected");
  }
  const { code, data } = err.info;

  if (code === "INVALID_NAME") {
    const reason = (data as { reason?: string } | undefined)?.reason;
    switch (reason) {
      case "RESERVED":
        return t("errors.invalidName.reserved");
      case "ILLEGAL_CHAR":
        return t("errors.invalidName.illegalChar");
      case "TOO_LONG":
        return t("errors.invalidName.tooLong");
      case "EMPTY":
        return t("errors.invalidName.empty");
      case "DOT_ONLY":
        return t("errors.invalidName.dotOnly");
      case "TRAILING_SPACE_OR_DOT":
        return t("errors.invalidName.trailingSpaceOrDot");
      default:
        return t("errors.invalidName.fallback");
    }
  }

  const key = `errors.codes.${code}` as const;
  const translated = t(key);
  return translated === key ? t("errors.unknownOperation") : translated;
}
