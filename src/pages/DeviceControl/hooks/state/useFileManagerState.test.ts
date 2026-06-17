/**
 * Tests for useFileManagerState — localStorage persistence, clamping,
 * corrupt-JSON fallback, per-device keying, and re-hydration on deviceId change.
 *
 * Isolation strategy:
 * - jsdom provides window.localStorage natively
 * - localStorage is cleared in afterEach so tests don't bleed into each other
 * - Explicit imports throughout (vitest.config.ts globals:false)
 */
import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFileManagerState } from "./useFileManagerState";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEVICE_ID = "device-abc-123";

/** Build the storage key exactly as the SUT does. */
function key(deviceId: string, field: string): string {
  return `recontrol.fm.v1.${deviceId}.${field}`;
}

afterEach(() => {
  localStorage.clear();
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe("useFileManagerState — initial state", () => {
  it("starts with the panel CLOSED (rightPaneActive null, panelOpen false) regardless of stored value", () => {
    // Even if some old session stored 'files' for rightPaneActive, it must be ignored.
    localStorage.setItem(key(DEVICE_ID, "rightPaneActive"), "files");
    localStorage.setItem(key(DEVICE_ID, "panelOpen"), "true");

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.rightPaneActive).toBeNull();
    expect(result.current.state.panelOpen).toBe(false);
  });

  it("reads splitRatio from localStorage when it is a valid float", () => {
    localStorage.setItem(key(DEVICE_ID, "splitRatio"), "0.7");

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.splitRatio).toBe(0.7);
  });

  it("clamps splitRatio below 0.1 up to 0.1", () => {
    localStorage.setItem(key(DEVICE_ID, "splitRatio"), "0.05");

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.splitRatio).toBe(0.1);
  });

  it("clamps splitRatio above 0.9 down to 0.9", () => {
    localStorage.setItem(key(DEVICE_ID, "splitRatio"), "0.99");

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.splitRatio).toBe(0.9);
  });

  it("falls back to default splitRatio (0.5) when stored value is not a finite number", () => {
    localStorage.setItem(key(DEVICE_ID, "splitRatio"), "NaN");

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.splitRatio).toBe(0.5);
  });

  it("falls back to default sort on corrupt JSON", () => {
    localStorage.setItem(key(DEVICE_ID, "sort"), "{bad json{{");

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.sort).toEqual({ column: "name", direction: "asc" });
  });

  it("falls back to default sort when sort JSON is valid but missing required fields", () => {
    localStorage.setItem(key(DEVICE_ID, "sort"), JSON.stringify({ column: 42, direction: "invalid" }));

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.sort).toEqual({ column: "name", direction: "asc" });
  });

  it("reads a valid sort from localStorage", () => {
    localStorage.setItem(key(DEVICE_ID, "sort"), JSON.stringify({ column: "size", direction: "desc" }));

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.sort).toEqual({ column: "size", direction: "desc" });
  });

  it('parses showHidden from "true"', () => {
    localStorage.setItem(key(DEVICE_ID, "showHidden"), "true");

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.showHidden).toBe(true);
  });

  it('showHidden defaults to false for any value other than "true"', () => {
    localStorage.setItem(key(DEVICE_ID, "showHidden"), "1");

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.showHidden).toBe(false);
  });

  it("reads currentPath from localStorage", () => {
    localStorage.setItem(key(DEVICE_ID, "currentPath"), "/home/user/docs");

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.currentPath).toBe("/home/user/docs");
  });

  it("treats empty string currentPath as null", () => {
    localStorage.setItem(key(DEVICE_ID, "currentPath"), "");

    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    expect(result.current.state.currentPath).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Empty deviceId — DEFAULT_STATE, no localStorage access
// ---------------------------------------------------------------------------

describe("useFileManagerState — empty deviceId", () => {
  it("returns DEFAULT_STATE when deviceId is empty string", () => {
    const { result } = renderHook(() => useFileManagerState(""));

    expect(result.current.state).toEqual({
      panelOpen: false,
      splitRatio: 0.5,
      rightPaneActive: null,
      currentPath: null,
      sort: { column: "name", direction: "asc" },
      showHidden: false,
    });
  });

  it("does not call localStorage.getItem when deviceId is empty", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

    renderHook(() => useFileManagerState(""));

    expect(getItemSpy).not.toHaveBeenCalled();
  });

  it("does not call localStorage.setItem when a setter is called with empty deviceId", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useFileManagerState(""));

    act(() => {
      result.current.setShowHidden(true);
    });

    expect(setItemSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Setters write to localStorage under the correct key
// ---------------------------------------------------------------------------

describe("useFileManagerState — setters write to localStorage", () => {
  it("setSplitRatio writes recontrol.fm.v1.{deviceId}.splitRatio", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setSplitRatio(0.6);
    });

    expect(localStorage.getItem(key(DEVICE_ID, "splitRatio"))).toBe("0.6");
  });

  it("setSplitRatio clamps to [0.1, 0.9] when writing", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setSplitRatio(0.0);
    });

    expect(localStorage.getItem(key(DEVICE_ID, "splitRatio"))).toBe("0.1");

    act(() => {
      result.current.setSplitRatio(1.0);
    });

    expect(localStorage.getItem(key(DEVICE_ID, "splitRatio"))).toBe("0.9");
  });

  it("setShowHidden writes recontrol.fm.v1.{deviceId}.showHidden", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setShowHidden(true);
    });

    expect(localStorage.getItem(key(DEVICE_ID, "showHidden"))).toBe("true");

    act(() => {
      result.current.setShowHidden(false);
    });

    expect(localStorage.getItem(key(DEVICE_ID, "showHidden"))).toBe("false");
  });

  it("setCurrentPath writes recontrol.fm.v1.{deviceId}.currentPath", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setCurrentPath("/home/user/pictures");
    });

    expect(localStorage.getItem(key(DEVICE_ID, "currentPath"))).toBe("/home/user/pictures");
  });

  it("setCurrentPath writes empty string for null", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setCurrentPath(null);
    });

    expect(localStorage.getItem(key(DEVICE_ID, "currentPath"))).toBe("");
  });

  it("setSort writes recontrol.fm.v1.{deviceId}.sort as JSON", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setSort({ column: "modified", direction: "desc" });
    });

    const stored = localStorage.getItem(key(DEVICE_ID, "sort"));
    expect(JSON.parse(stored!)).toEqual({ column: "modified", direction: "desc" });
  });

  it("setPanelOpen(true) writes panelOpen=true and rightPaneActive=files", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setPanelOpen(true);
    });

    expect(localStorage.getItem(key(DEVICE_ID, "panelOpen"))).toBe("true");
    expect(localStorage.getItem(key(DEVICE_ID, "rightPaneActive"))).toBe("files");
  });

  it("setPanelOpen(false) writes panelOpen=false and rightPaneActive=empty", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setPanelOpen(false);
    });

    expect(localStorage.getItem(key(DEVICE_ID, "panelOpen"))).toBe("false");
    expect(localStorage.getItem(key(DEVICE_ID, "rightPaneActive"))).toBe("");
  });

  it("setRightPaneActive writes recontrol.fm.v1.{deviceId}.rightPaneActive", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setRightPaneActive("assistant");
    });

    expect(localStorage.getItem(key(DEVICE_ID, "rightPaneActive"))).toBe("assistant");
  });
});

// ---------------------------------------------------------------------------
// Setters also update in-memory state
// ---------------------------------------------------------------------------

describe("useFileManagerState — setters update state", () => {
  it("setSplitRatio updates state.splitRatio", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setSplitRatio(0.3);
    });

    expect(result.current.state.splitRatio).toBe(0.3);
  });

  it("setShowHidden updates state.showHidden", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setShowHidden(true);
    });

    expect(result.current.state.showHidden).toBe(true);
  });

  it("setCurrentPath updates state.currentPath", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setCurrentPath("/home/user/video");
    });

    expect(result.current.state.currentPath).toBe("/home/user/video");
  });

  it("setSort updates state.sort", () => {
    const { result } = renderHook(() => useFileManagerState(DEVICE_ID));

    act(() => {
      result.current.setSort({ column: "size", direction: "asc" });
    });

    expect(result.current.state.sort).toEqual({ column: "size", direction: "asc" });
  });
});

// ---------------------------------------------------------------------------
// Per-device keying
// ---------------------------------------------------------------------------

describe("useFileManagerState — per-device keying", () => {
  it("does not mix state between two different deviceIds", () => {
    localStorage.setItem(key("device-A", "showHidden"), "true");
    localStorage.setItem(key("device-B", "showHidden"), "false");

    const { result: resultA } = renderHook(() => useFileManagerState("device-A"));
    const { result: resultB } = renderHook(() => useFileManagerState("device-B"));

    expect(resultA.current.state.showHidden).toBe(true);
    expect(resultB.current.state.showHidden).toBe(false);
  });

  it("writes to the correct device-scoped key when multiple devices involved", () => {
    const { result } = renderHook(() => useFileManagerState("device-X"));

    act(() => {
      result.current.setSplitRatio(0.4);
    });

    expect(localStorage.getItem("recontrol.fm.v1.device-X.splitRatio")).toBe("0.4");
    // Unrelated device key must not be written
    expect(localStorage.getItem("recontrol.fm.v1.device-Y.splitRatio")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Re-hydration on deviceId change
// ---------------------------------------------------------------------------

describe("useFileManagerState — re-hydration when deviceId changes", () => {
  it("re-hydrates state when deviceId changes (useEffect)", () => {
    // Seed both devices
    localStorage.setItem(key("device-1", "showHidden"), "false");
    localStorage.setItem(key("device-2", "showHidden"), "true");

    const { result, rerender } = renderHook(
      ({ deviceId }: { deviceId: string }) => useFileManagerState(deviceId),
      { initialProps: { deviceId: "device-1" } },
    );

    expect(result.current.state.showHidden).toBe(false);

    act(() => {
      rerender({ deviceId: "device-2" });
    });

    expect(result.current.state.showHidden).toBe(true);
  });

  it("re-hydrates splitRatio from the new device on deviceId change", () => {
    localStorage.setItem(key("dev-A", "splitRatio"), "0.3");
    localStorage.setItem(key("dev-B", "splitRatio"), "0.8");

    const { result, rerender } = renderHook(
      ({ deviceId }: { deviceId: string }) => useFileManagerState(deviceId),
      { initialProps: { deviceId: "dev-A" } },
    );

    expect(result.current.state.splitRatio).toBe(0.3);

    act(() => {
      rerender({ deviceId: "dev-B" });
    });

    expect(result.current.state.splitRatio).toBe(0.8);
  });

  it("resets to DEFAULT_STATE when deviceId changes to empty string", () => {
    localStorage.setItem(key(DEVICE_ID, "showHidden"), "true");

    const { result, rerender } = renderHook(
      ({ deviceId }: { deviceId: string }) => useFileManagerState(deviceId),
      { initialProps: { deviceId: DEVICE_ID } },
    );

    expect(result.current.state.showHidden).toBe(true);

    act(() => {
      rerender({ deviceId: "" });
    });

    expect(result.current.state.showHidden).toBe(false);
    expect(result.current.state.splitRatio).toBe(0.5);
  });
});
