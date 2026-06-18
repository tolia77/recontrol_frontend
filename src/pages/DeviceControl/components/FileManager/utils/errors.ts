import { FilesChannelError } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import type { TFunction } from "i18next";

/**
 * Map a {@link FilesChannelError} (or any unknown thrown value) to a single
 * localized, human-readable string (via i18next `t`) for use in toast
 * notifications.
 *
 * Branches on the structured `code` field rather than `message` so the wire
 * envelope stays stable. INVALID_NAME drills into `data.reason` (an
 * {@link InvalidNameReason} value) to surface a specific message per reason,
 * matching the desktop's InvalidFileNameException semantics.
 *
 * Covers all 15 FilesErrorCode values (including the four transfer codes
 * TRANSFER_NOT_FOUND, CANCELLED, STALLED, DISK_FULL) and all 6
 * InvalidNameReason values.
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

  // Share-level files permission denials carry `data.permission` to discriminate
  // read vs write so the user knows which capability the session lacks. OS-level
  // permission denials (PERMISSION_READ / PERMISSION_WRITE) keep their existing
  // generic mapping below.
  if (code === "PERMISSION_DENIED") {
    const permission = (data as { permission?: string } | undefined)?.permission;
    if (permission === "files_write") {
      return t("errors.codes.PERMISSION_DENIED_FILES_WRITE");
    }
    if (permission === "files_read") {
      return t("errors.codes.PERMISSION_DENIED_FILES_READ");
    }
  }

  const key = `errors.codes.${code}` as const;
  const translated = t(key);
  return translated === key ? t("errors.unknownOperation") : translated;
}
