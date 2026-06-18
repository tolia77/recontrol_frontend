// Unit tests for mapFilesErrorToMessage.
//
// Coverage focus: the share-level PERMISSION_DENIED discrimination, which
// branches on `error.data.permission` to surface a read-specific or
// write-specific message instead of the generic OS-level
// denial copy. Also smoke-covers the templated `errors.codes.<CODE>` fallback
// path and the INVALID_NAME drill-down so future regressions on either branch
// stay obvious. The mapping function is pure; we feed it a fake `t` that
// echoes the requested i18n key so we can assert behavior without booting the
// real i18next runtime.
import { describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { mapFilesErrorToMessage } from "./errors";
import { FilesChannelError } from "src/pages/DeviceControl/services/files/FilesChannelClient";
import type { FilesError } from "src/pages/DeviceControl/services/files/filesProtocol.generated";

/**
 * Mock `t`: returns `<translated:KEY>` so the mapping function's
 * "did i18next find a translation?" check (`translated === key`) sees a real
 * translation. Tests assert against this prefixed form so they can verify the
 * exact key requested without rendering English / Ukrainian strings.
 *
 * Note: errors.ts treats `translated === key` as "missing translation" and
 * falls back to `errors.unknownOperation`. A bare identity `t` would trip that
 * branch on every code path, so we return a distinct value here.
 */
const t = ((key: string) => `<translated:${key}>`) as unknown as TFunction<
  "fileManager"
>;

const tr = (key: string) => `<translated:${key}>`;

function makeError(info: FilesError): FilesChannelError {
  return new FilesChannelError(info);
}

describe("mapFilesErrorToMessage", () => {
  it("returns the read-specific message when PERMISSION_DENIED carries permission=files_read", () => {
    const err = makeError({
      code: "PERMISSION_DENIED",
      message: "session lacks files_read",
      data: { permission: "files_read" },
    });
    expect(mapFilesErrorToMessage(err, t)).toBe(
      tr("errors.codes.PERMISSION_DENIED_FILES_READ"),
    );
  });

  it("returns the write-specific message when PERMISSION_DENIED carries permission=files_write", () => {
    const err = makeError({
      code: "PERMISSION_DENIED",
      message: "session lacks files_write",
      data: { permission: "files_write" },
    });
    expect(mapFilesErrorToMessage(err, t)).toBe(
      tr("errors.codes.PERMISSION_DENIED_FILES_WRITE"),
    );
  });

  it("falls back to the generic PERMISSION_DENIED string when no permission field is present", () => {
    const err = makeError({
      code: "PERMISSION_DENIED",
      message: "OS denied access",
    });
    expect(mapFilesErrorToMessage(err, t)).toBe(
      tr("errors.codes.PERMISSION_DENIED"),
    );
  });

  it("ignores an unrecognized permission value and uses the generic PERMISSION_DENIED string", () => {
    const err = makeError({
      code: "PERMISSION_DENIED",
      message: "OS denied access",
      data: { permission: "screen_view" },
    });
    expect(mapFilesErrorToMessage(err, t)).toBe(
      tr("errors.codes.PERMISSION_DENIED"),
    );
  });

  it("maps OS-level PERMISSION_READ to its dedicated code key unchanged", () => {
    const err = makeError({
      code: "PERMISSION_READ",
      message: "OS read denied",
    });
    expect(mapFilesErrorToMessage(err, t)).toBe(
      tr("errors.codes.PERMISSION_READ"),
    );
  });

  it("drills into INVALID_NAME reason for a specific sub-message", () => {
    const err = makeError({
      code: "INVALID_NAME",
      message: "bad name",
      data: { reason: "RESERVED" },
    });
    expect(mapFilesErrorToMessage(err, t)).toBe(tr("errors.invalidName.reserved"));
  });

  it("returns the unexpected-error key for non-FilesChannelError throwables", () => {
    expect(mapFilesErrorToMessage(new Error("boom"), t)).toBe(
      tr("errors.unexpected"),
    );
  });
});
