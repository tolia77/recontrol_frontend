// Hook integration coverage strategy:
//   - The hook itself is a thin React glue around detectCapability.
//   - Decision logic lives in detectCapability (pure function) in services/clipboard/clipboardCore.ts.
//   - Since @testing-library/react is NOT installed, we test the underlying
//     detectCapability function directly with various navigator shapes.
//   - Per PATTERNS.md "No Analog Found": pure-helper coverage is preferred over
//     installing a render harness for a one-shot capability check.
import { describe, expect, it } from "vitest";
import { detectCapability } from "src/pages/DeviceControl/services/clipboard/clipboardCore";

describe("useClipboardCapability (underlying detectCapability)", () => {
  it("returns canRead=true when navigator.clipboard.readText is a function", () => {
    const fakeNav = {
      clipboard: {
        readText: async () => "",
        writeText: async () => {},
      },
    } as unknown as Navigator;
    expect(detectCapability(fakeNav, true)).toEqual({
      canRead: true,
      canWrite: true,
      isSecureContext: true,
    });
  });

  it("returns canRead=false when clipboard is missing", () => {
    const fakeNav = {} as unknown as Navigator;
    expect(detectCapability(fakeNav, true)).toEqual({
      canRead: false,
      canWrite: false,
      isSecureContext: true,
    });
  });

  it("reports isSecureContext=false when not secure", () => {
    const fakeNav = {
      clipboard: {
        readText: async () => "",
        writeText: async () => {},
      },
    } as unknown as Navigator;
    expect(detectCapability(fakeNav, false).isSecureContext).toBe(false);
  });

  it("returns canRead=true, canWrite=false when only readText is present", () => {
    const fakeNav = {
      clipboard: { readText: async () => "" },
    } as unknown as Navigator;
    const caps = detectCapability(fakeNav, true);
    expect(caps.canRead).toBe(true);
    expect(caps.canWrite).toBe(false);
    expect(caps.isSecureContext).toBe(true);
  });

  it("returns all-false when navigator is undefined", () => {
    expect(detectCapability(undefined, false)).toEqual({
      canRead: false,
      canWrite: false,
      isSecureContext: false,
    });
  });

  it("does not call navigator.permissions.query (function does not touch the permissions API)", () => {
    let called = false;
    const fakeNav = {
      clipboard: { readText: async () => "", writeText: async () => {} },
      permissions: {
        query: () => {
          called = true;
          return Promise.resolve({
            state: "granted",
          } as unknown as PermissionStatus);
        },
      },
    } as unknown as Navigator;
    detectCapability(fakeNav, true);
    expect(called).toBe(false);
  });
});
