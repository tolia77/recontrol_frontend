/**
 * Tests for useFileOperations — CRUD-over-channel logic, guards, and conflict loop.
 *
 * Isolation strategy:
 * - channel.request is a vi.fn() injected via options (no real data channel)
 * - react-i18next useTranslation is NOT imported; the hook accepts t directly
 * - useToast is stubbed as { success, error, info, warning } vi.fns
 * - dispatch is a vi.fn()
 * - selection is a hand-rolled stub with a state.selected Set and a clear vi.fn()
 * - navigator.clipboard and document.execCommand stubbed for clipboard tests
 *
 * vitest.config.ts has globals:false — all vitest APIs imported explicitly.
 */
import { renderHook, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFileOperations } from "./useFileOperations";
import type { UseFileOperationsOptions } from "./useFileOperations";
import type {
  UseFilesChannel,
  FilesChannelRequest,
} from "src/pages/DeviceControl/hooks/realtime/useFilesChannel";
import type { FileEntry } from "src/pages/DeviceControl/services/files/filesProtocol.generated";
import { FilesChannelError } from "src/pages/DeviceControl/services/files/FilesChannelClient";

// ---------------------------------------------------------------------------
// Shared stubs / factories
// ---------------------------------------------------------------------------

function makeT() {
  return (k: string) => k;
}

function makeToast() {
  return {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };
}

function makeDispatch() {
  return vi.fn();
}

function makeSelection(selected: Set<string>) {
  return {
    state: { selected, focusedIndex: -1, anchorIndex: -1 },
    clear: vi.fn(),
    selectOnly: vi.fn(),
    toggle: vi.fn(),
    extendTo: vi.fn(),
    selectAll: vi.fn(),
    setFocus: vi.fn(),
    selectedEntries: [] as FileEntry[],
    selectedSize: 0,
  };
}

function makeEntry(path: string, name: string, isDirectory = false): FileEntry {
  return {
    path,
    name,
    isDirectory,
    isHidden: false,
    sizeBytes: 0,
    modifiedUtc: new Date("2026-01-01T00:00:00Z"),
  };
}

function makeRootRef() {
  return { current: null } as React.RefObject<HTMLDivElement | null>;
}

// Minimal channel stub helpers. The injected `request` is a vi.fn() whose
// generic signature does not match FilesChannelRequest, so we cast it; the
// hook only ever calls it, never inspects its type.
function makeChannel(requestFn: ReturnType<typeof vi.fn> | null): UseFilesChannel {
  return {
    status: requestFn ? ("open" as const) : ("closed" as const),
    request: requestFn as unknown as FilesChannelRequest | null,
    filesDataRef: { current: null },
    filesClient: null,
    filesDataChannel: null,
  };
}

function makeNameConflictError() {
  return new FilesChannelError({ code: "NAME_CONFLICT", message: "conflict" });
}

import React from "react";

// ---------------------------------------------------------------------------
// Default options builder
// ---------------------------------------------------------------------------

function buildOptions(
  overrides: Partial<UseFileOperationsOptions> = {},
): UseFileOperationsOptions {
  const requestFn = vi.fn().mockResolvedValue({});
  return {
    channel: makeChannel(requestFn),
    currentPath: "/home/user",
    selection: makeSelection(new Set<string>()),
    visibleEntries: [],
    suppressSingleDeleteConfirm: false,
    dispatch: makeDispatch(),
    requestConflictDecision: vi.fn().mockResolvedValue({ mode: "overwrite", applyToAll: false }),
    onRefresh: vi.fn(),
    rootRef: makeRootRef(),
    toast: makeToast(),
    t: makeT() as unknown as ReturnType<typeof makeT> & import("i18next").TFunction<"fileManager">,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// performDelete tests
// ---------------------------------------------------------------------------

describe("useFileOperations — performDelete", () => {
  it("calls files.delete once per path sequentially", async () => {
    const requestFn = vi.fn().mockResolvedValue({});
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set(["/home/user/a.txt", "/home/user/b.txt"]));
    const onRefresh = vi.fn();
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      dispatch,
      selection,
      onRefresh,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performDelete(["/home/user/a.txt", "/home/user/b.txt"]);
    });

    expect(requestFn).toHaveBeenCalledTimes(2);
    expect(requestFn).toHaveBeenNthCalledWith(1, "files.delete", { path: "/home/user/a.txt" });
    expect(requestFn).toHaveBeenNthCalledWith(2, "files.delete", { path: "/home/user/b.txt" });
  });

  it("dispatches SET_DELETING true before loop and false in finally", async () => {
    const requestFn = vi.fn().mockResolvedValue({});
    const dispatch = makeDispatch();
    const opts = buildOptions({ channel: makeChannel(requestFn), dispatch });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performDelete(["/home/user/file.txt"]);
    });

    const calls = dispatch.mock.calls.map((c) => c[0]);
    const setDeletingTrue = calls.findIndex(
      (a) => a.type === "SET_DELETING" && a.payload === true,
    );
    const setDeletingFalse = calls.findIndex(
      (a) => a.type === "SET_DELETING" && a.payload === false,
    );
    expect(setDeletingTrue).toBeGreaterThanOrEqual(0);
    expect(setDeletingFalse).toBeGreaterThan(setDeletingTrue);
  });

  it("calls selection.clear(), onRefresh(), and dispatches CLOSE_DELETE_CONFIRM on success", async () => {
    const requestFn = vi.fn().mockResolvedValue({});
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set(["/home/user/f.txt"]));
    const onRefresh = vi.fn();
    const opts = buildOptions({ channel: makeChannel(requestFn), dispatch, selection, onRefresh });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performDelete(["/home/user/f.txt"]);
    });

    expect(selection.clear).toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_DELETE_CONFIRM" });
  });

  it("calls toast.error per-path on error and still calls onRefresh and clears selection", async () => {
    const requestFn = vi.fn().mockRejectedValue(
      new FilesChannelError({ code: "IO_ERROR", message: "io error" }),
    );
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set(["/home/user/f.txt"]));
    const onRefresh = vi.fn();
    const toast = makeToast();
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      dispatch,
      selection,
      onRefresh,
      toast,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performDelete(["/home/user/f.txt"]);
    });

    expect(toast.error).toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalled();
    expect(selection.clear).toHaveBeenCalled();
  });

  it("toasts filesChannelDisconnected when channel.request is null", async () => {
    const toast = makeToast();
    const opts = buildOptions({ channel: makeChannel(null), toast });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performDelete(["/home/user/f.txt"]);
    });

    expect(toast.error).toHaveBeenCalledWith("panel.filesChannelDisconnected");
  });

  it("resets SET_DELETING false in finally even when request throws synchronously", async () => {
    const requestFn = vi.fn().mockRejectedValue(new Error("boom"));
    const dispatch = makeDispatch();
    const opts = buildOptions({ channel: makeChannel(requestFn), dispatch });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performDelete(["/home/user/f.txt"]);
    });

    const lastSetDeleting = dispatch.mock.calls
      .map((c) => c[0])
      .filter((a) => a.type === "SET_DELETING")
      .at(-1);
    expect(lastSetDeleting?.payload).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requestDelete tests
// ---------------------------------------------------------------------------

describe("useFileOperations — requestDelete", () => {
  it("opens confirm dialog for multi-file delete", async () => {
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set(["/home/user/a.txt", "/home/user/b.txt"]));
    const entries = [
      makeEntry("/home/user/a.txt", "a.txt"),
      makeEntry("/home/user/b.txt", "b.txt"),
    ];
    const opts = buildOptions({ dispatch, selection, visibleEntries: entries });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.requestDelete();
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "OPEN_DELETE_CONFIRM" }),
    );
  });

  it("opens confirm dialog for single-file delete when suppressSingleDeleteConfirm=false", async () => {
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set(["/home/user/a.txt"]));
    const entries = [makeEntry("/home/user/a.txt", "a.txt")];
    const opts = buildOptions({
      dispatch,
      selection,
      visibleEntries: entries,
      suppressSingleDeleteConfirm: false,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.requestDelete();
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "OPEN_DELETE_CONFIRM" }),
    );
  });

  it("skips the confirm dialog for a single delete when suppressSingleDeleteConfirm=true", async () => {
    const requestFn = vi.fn().mockResolvedValue({});
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set(["/home/user/a.txt"]));
    const entries = [makeEntry("/home/user/a.txt", "a.txt")];
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      dispatch,
      selection,
      visibleEntries: entries,
      suppressSingleDeleteConfirm: true,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.requestDelete();
    });

    // Should call files.delete directly, not open dialog
    expect(requestFn).toHaveBeenCalledWith("files.delete", { path: "/home/user/a.txt" });
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "OPEN_DELETE_CONFIRM" }),
    );
  });

  it("does nothing when selection is empty", async () => {
    const dispatch = makeDispatch();
    const requestFn = vi.fn();
    const selection = makeSelection(new Set<string>());
    const opts = buildOptions({ channel: makeChannel(requestFn), dispatch, selection });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.requestDelete();
    });

    expect(requestFn).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches OPEN_DELETE_CONFIRM with paths and resolved names", async () => {
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set(["/home/user/doc.pdf"]));
    const entries = [makeEntry("/home/user/doc.pdf", "doc.pdf")];
    const opts = buildOptions({ dispatch, selection, visibleEntries: entries });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.requestDelete();
    });

    expect(dispatch).toHaveBeenCalledWith({
      type: "OPEN_DELETE_CONFIRM",
      payload: { paths: ["/home/user/doc.pdf"], names: ["doc.pdf"] },
    });
  });
});

// ---------------------------------------------------------------------------
// performMoveOrCopy — isAncestor guard (T-27-04 regression)
// ---------------------------------------------------------------------------

describe("useFileOperations — performMoveOrCopy isAncestor guard (T-27-04)", () => {
  it("blocks moving a folder into its own descendant and calls toast.error(cannotMoveIntoSelf)", async () => {
    const requestFn = vi.fn().mockResolvedValue({});
    const toast = makeToast();
    const dispatch = makeDispatch();
    // Attempt to move /home/user/folder INTO /home/user/folder/sub (ancestor check)
    const selection = makeSelection(new Set(["/home/user/folder"]));
    const entries = [makeEntry("/home/user/folder", "folder", true)];
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      dispatch,
      selection,
      visibleEntries: entries,
      toast,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      // dstParent is a descendant of src → isAncestor returns true
      await result.current.performMoveOrCopy("move", "/home/user/folder/sub");
    });

    expect(toast.error).toHaveBeenCalledWith("panel.cannotMoveIntoSelf");
    // wire call must NOT be made for this path
    expect(requestFn).not.toHaveBeenCalled();
  });

  it("continues processing other items after skipping the self-nest violation", async () => {
    const requestFn = vi.fn().mockResolvedValue({});
    const toast = makeToast();
    // Two files: one is ancestor of dst, one is not
    const selection = makeSelection(
      new Set(["/home/user/folder", "/home/user/other.txt"]),
    );
    const entries = [
      makeEntry("/home/user/folder", "folder", true),
      makeEntry("/home/user/other.txt", "other.txt"),
    ];
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      selection,
      visibleEntries: entries,
      toast,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performMoveOrCopy("move", "/home/user/folder/sub");
    });

    // isAncestor guard fires for folder, toast called; other.txt proceeds
    expect(toast.error).toHaveBeenCalledWith("panel.cannotMoveIntoSelf");
    // other.txt is NOT an ancestor of /home/user/folder/sub — so it gets moved
    expect(requestFn).toHaveBeenCalledWith(
      "files.move",
      expect.objectContaining({ src: "/home/user/other.txt" }),
    );
  });
});

// ---------------------------------------------------------------------------
// performMoveOrCopy — NAME_CONFLICT loop
// ---------------------------------------------------------------------------

describe("useFileOperations — performMoveOrCopy NAME_CONFLICT loop", () => {
  it("calls requestConflictDecision on NAME_CONFLICT and retries with chosen mode", async () => {
    const requestFn = vi
      .fn()
      // First call: reject with NAME_CONFLICT
      .mockRejectedValueOnce(makeNameConflictError())
      // Second call (after overwrite decision): succeed
      .mockResolvedValueOnce({});

    const requestConflictDecision = vi
      .fn()
      .mockResolvedValue({ mode: "overwrite", applyToAll: false });

    const selection = makeSelection(new Set(["/home/user/file.txt"]));
    const entries = [makeEntry("/home/user/file.txt", "file.txt")];
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      selection,
      visibleEntries: entries,
      requestConflictDecision,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performMoveOrCopy("copy", "/home/user/dest");
    });

    expect(requestConflictDecision).toHaveBeenCalledWith(
      "copy",
      "file.txt",
      expect.any(String),
    );
    expect(requestFn).toHaveBeenCalledTimes(2);
  });

  it("breaks on skip decision without retry", async () => {
    const requestFn = vi.fn().mockRejectedValue(makeNameConflictError());
    const requestConflictDecision = vi
      .fn()
      .mockResolvedValue({ mode: "skip", applyToAll: false });

    const selection = makeSelection(new Set(["/home/user/file.txt"]));
    const entries = [makeEntry("/home/user/file.txt", "file.txt")];
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      selection,
      visibleEntries: entries,
      requestConflictDecision,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performMoveOrCopy("move", "/home/user/dest");
    });

    // Only one request call (the conflicting one) — no retry after skip
    expect(requestFn).toHaveBeenCalledTimes(1);
  });

  it("propagates applyToAll mode to subsequent files", async () => {
    // Two files; first conflicts with applyToAll=true overwrite; second should
    // use the remembered mode without calling requestConflictDecision again.
    const requestFn = vi
      .fn()
      .mockRejectedValueOnce(makeNameConflictError()) // a.txt conflicts
      .mockResolvedValueOnce({}) // a.txt retry with overwrite succeeds
      .mockResolvedValueOnce({}); // b.txt succeeds directly

    const requestConflictDecision = vi
      .fn()
      .mockResolvedValue({ mode: "overwrite", applyToAll: true });

    const selection = makeSelection(
      new Set(["/home/user/a.txt", "/home/user/b.txt"]),
    );
    const entries = [
      makeEntry("/home/user/a.txt", "a.txt"),
      makeEntry("/home/user/b.txt", "b.txt"),
    ];
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      selection,
      visibleEntries: entries,
      requestConflictDecision,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performMoveOrCopy("copy", "/home/user/dest");
    });

    // requestConflictDecision only called ONCE (for a.txt); b.txt uses remembered mode
    expect(requestConflictDecision).toHaveBeenCalledTimes(1);
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it("dispatches SET_OPERATING true before loop and false in finally", async () => {
    const requestFn = vi.fn().mockResolvedValue({});
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set(["/home/user/f.txt"]));
    const entries = [makeEntry("/home/user/f.txt", "f.txt")];
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      dispatch,
      selection,
      visibleEntries: entries,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performMoveOrCopy("copy", "/home/user/dest");
    });

    const calls = dispatch.mock.calls.map((c) => c[0]);
    const setOpTrue = calls.findIndex(
      (a) => a.type === "SET_OPERATING" && a.payload === true,
    );
    const setOpFalse = calls.findIndex(
      (a) => a.type === "SET_OPERATING" && a.payload === false,
    );
    expect(setOpTrue).toBeGreaterThanOrEqual(0);
    expect(setOpFalse).toBeGreaterThan(setOpTrue);
  });

  it("toasts filesChannelDisconnected when channel.request is null (move/copy)", async () => {
    const toast = makeToast();
    const selection = makeSelection(new Set(["/home/user/f.txt"]));
    const opts = buildOptions({ channel: makeChannel(null), selection, toast });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.performMoveOrCopy("move", "/home/user/dest");
    });

    expect(toast.error).toHaveBeenCalledWith("panel.filesChannelDisconnected");
  });
});

// ---------------------------------------------------------------------------
// createFolder tests
// ---------------------------------------------------------------------------

describe("useFileOperations — createFolder", () => {
  it("dispatches CLOSE_NEW_FOLDER without firing wire call on empty input", async () => {
    const requestFn = vi.fn();
    const dispatch = makeDispatch();
    const opts = buildOptions({ channel: makeChannel(requestFn), dispatch });

    const { result } = renderHook(() => useFileOperations(opts));

    act(() => {
      result.current.createFolder("  ");
    });

    expect(requestFn).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_NEW_FOLDER" });
  });

  it("dispatches CLOSE_NEW_FOLDER without firing wire call when currentPath is null", async () => {
    const requestFn = vi.fn();
    const dispatch = makeDispatch();
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      dispatch,
      currentPath: null,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    act(() => {
      result.current.createFolder("NewFolder");
    });

    expect(requestFn).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_NEW_FOLDER" });
  });

  it("fires files.mkdir and dispatches CLOSE_NEW_FOLDER + onRefresh on success", async () => {
    const requestFn = vi.fn().mockResolvedValue({ path: "/home/user/NewFolder" });
    const dispatch = makeDispatch();
    const onRefresh = vi.fn();
    const selection = makeSelection(new Set<string>());
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      dispatch,
      onRefresh,
      selection,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      result.current.createFolder("NewFolder");
      // Flush microtasks from .then()
      await Promise.resolve();
    });

    expect(requestFn).toHaveBeenCalledWith("files.mkdir", {
      parentPath: "/home/user",
      name: "NewFolder",
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_NEW_FOLDER" });
    expect(onRefresh).toHaveBeenCalled();
  });

  it("keeps editor open and toasts error on createFolder failure", async () => {
    const requestFn = vi
      .fn()
      .mockRejectedValue(new FilesChannelError({ code: "IO_ERROR", message: "fail" }));
    const dispatch = makeDispatch();
    const toast = makeToast();
    const opts = buildOptions({ channel: makeChannel(requestFn), dispatch, toast });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      result.current.createFolder("Bad");
      await Promise.resolve();
    });

    // CLOSE_NEW_FOLDER must NOT have been dispatched
    expect(dispatch).not.toHaveBeenCalledWith({ type: "CLOSE_NEW_FOLDER" });
    expect(toast.error).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// commitRename tests
// ---------------------------------------------------------------------------

describe("useFileOperations — commitRename", () => {
  it("dispatches CLOSE_RENAME without wire call on empty new name", async () => {
    const requestFn = vi.fn();
    const dispatch = makeDispatch();
    const entries = [makeEntry("/home/user/a.txt", "a.txt")];
    const opts = buildOptions({ channel: makeChannel(requestFn), dispatch, visibleEntries: entries });

    const { result } = renderHook(() => useFileOperations(opts));

    act(() => {
      result.current.commitRename("/home/user/a.txt", "   ");
    });

    expect(requestFn).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_RENAME" });
  });

  it("dispatches CLOSE_RENAME without wire call when name unchanged", async () => {
    const requestFn = vi.fn();
    const dispatch = makeDispatch();
    const entries = [makeEntry("/home/user/a.txt", "a.txt")];
    const opts = buildOptions({ channel: makeChannel(requestFn), dispatch, visibleEntries: entries });

    const { result } = renderHook(() => useFileOperations(opts));

    act(() => {
      result.current.commitRename("/home/user/a.txt", "a.txt");
    });

    expect(requestFn).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_RENAME" });
  });

  it("fires files.rename and dispatches CLOSE_RENAME on success", async () => {
    const requestFn = vi.fn().mockResolvedValue({ path: "/home/user/b.txt" });
    const dispatch = makeDispatch();
    const onRefresh = vi.fn();
    const entries = [makeEntry("/home/user/a.txt", "a.txt")];
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      dispatch,
      onRefresh,
      visibleEntries: entries,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      result.current.commitRename("/home/user/a.txt", "b.txt");
      await Promise.resolve();
    });

    expect(requestFn).toHaveBeenCalledWith("files.rename", {
      path: "/home/user/a.txt",
      newName: "b.txt",
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_RENAME" });
    expect(onRefresh).toHaveBeenCalled();
  });

  it("keeps editor open and toasts on rename error", async () => {
    const requestFn = vi
      .fn()
      .mockRejectedValue(new FilesChannelError({ code: "IO_ERROR", message: "fail" }));
    const dispatch = makeDispatch();
    const toast = makeToast();
    const entries = [makeEntry("/home/user/a.txt", "a.txt")];
    const opts = buildOptions({
      channel: makeChannel(requestFn),
      dispatch,
      toast,
      visibleEntries: entries,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      result.current.commitRename("/home/user/a.txt", "new.txt");
      await Promise.resolve();
    });

    expect(dispatch).not.toHaveBeenCalledWith({ type: "CLOSE_RENAME" });
    expect(toast.error).toHaveBeenCalled();
  });

  it("dispatches CLOSE_RENAME when channel.request is null", () => {
    const dispatch = makeDispatch();
    const toast = makeToast();
    const entries = [makeEntry("/home/user/a.txt", "a.txt")];
    const opts = buildOptions({
      channel: makeChannel(null),
      dispatch,
      toast,
      visibleEntries: entries,
    });

    const { result } = renderHook(() => useFileOperations(opts));

    act(() => {
      result.current.commitRename("/home/user/a.txt", "b.txt");
    });

    expect(toast.error).toHaveBeenCalledWith("panel.filesChannelDisconnected");
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_RENAME" });
  });
});

// ---------------------------------------------------------------------------
// copyPathToClipboard tests
// ---------------------------------------------------------------------------

describe("useFileOperations — copyPathToClipboard", () => {
  beforeEach(() => {
    // Ensure navigator.clipboard is writable via defineProperty
    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    // jsdom does not define document.execCommand — define it so vi.spyOn works.
    if (!Object.getOwnPropertyDescriptor(document, "execCommand")) {
      Object.defineProperty(document, "execCommand", {
        writable: true,
        configurable: true,
        value: vi.fn().mockReturnValue(false),
      });
    }
  });

  it("uses navigator.clipboard.writeText and calls toast.success on success", async () => {
    const toast = makeToast();
    const opts = buildOptions({ toast });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.copyPathToClipboard("/home/user/file.txt");
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("/home/user/file.txt");
    expect(toast.success).toHaveBeenCalledWith("panel.pathCopied");
  });

  it("falls back to document.execCommand when clipboard.writeText throws", async () => {
    // Make clipboard.writeText reject
    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    const execCommandSpy = vi
      .spyOn(document, "execCommand")
      .mockReturnValue(true);
    const toast = makeToast();
    const opts = buildOptions({ toast });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.copyPathToClipboard("/home/user/file.txt");
    });

    expect(execCommandSpy).toHaveBeenCalledWith("copy");
    expect(toast.success).toHaveBeenCalledWith("panel.pathCopied");
  });

  it("falls back to execCommand when clipboard is undefined", async () => {
    // Remove clipboard entirely
    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      configurable: true,
      value: undefined,
    });
    const execCommandSpy = vi
      .spyOn(document, "execCommand")
      .mockReturnValue(true);
    const toast = makeToast();
    const opts = buildOptions({ toast });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.copyPathToClipboard("/home/user/file.txt");
    });

    expect(execCommandSpy).toHaveBeenCalledWith("copy");
    expect(toast.success).toHaveBeenCalledWith("panel.pathCopied");
  });

  it("calls toast.error when both clipboard and execCommand fail", async () => {
    Object.defineProperty(navigator, "clipboard", {
      writable: true,
      configurable: true,
      value: undefined,
    });
    vi.spyOn(document, "execCommand").mockReturnValue(false);
    const toast = makeToast();
    const opts = buildOptions({ toast });

    const { result } = renderHook(() => useFileOperations(opts));

    await act(async () => {
      await result.current.copyPathToClipboard("/home/user/file.txt");
    });

    expect(toast.error).toHaveBeenCalledWith("panel.couldNotCopyPath");
  });
});

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

describe("useFileOperations — cancelNewFolder, cancelRename, armRename", () => {
  it("cancelNewFolder dispatches CLOSE_NEW_FOLDER", () => {
    const dispatch = makeDispatch();
    const opts = buildOptions({ dispatch });
    const { result } = renderHook(() => useFileOperations(opts));
    act(() => result.current.cancelNewFolder());
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_NEW_FOLDER" });
  });

  it("cancelRename dispatches CLOSE_RENAME", () => {
    const dispatch = makeDispatch();
    const opts = buildOptions({ dispatch });
    const { result } = renderHook(() => useFileOperations(opts));
    act(() => result.current.cancelRename());
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_RENAME" });
  });

  it("armRename dispatches CLOSE_NEW_FOLDER then OPEN_RENAME with path", () => {
    const dispatch = makeDispatch();
    const opts = buildOptions({ dispatch });
    const { result } = renderHook(() => useFileOperations(opts));
    act(() => result.current.armRename("/home/user/a.txt"));
    expect(dispatch).toHaveBeenCalledWith({ type: "CLOSE_NEW_FOLDER" });
    expect(dispatch).toHaveBeenCalledWith({ type: "OPEN_RENAME", payload: "/home/user/a.txt" });
  });
});

describe("useFileOperations — openMovePicker / openCopyPicker", () => {
  it("dispatches OPEN_MOVE_PICKER when selection is non-empty", () => {
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set(["/home/user/f.txt"]));
    const opts = buildOptions({ dispatch, selection });
    const { result } = renderHook(() => useFileOperations(opts));
    act(() => result.current.openMovePicker());
    expect(dispatch).toHaveBeenCalledWith({ type: "OPEN_MOVE_PICKER" });
  });

  it("does nothing for openMovePicker when selection is empty", () => {
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set<string>());
    const opts = buildOptions({ dispatch, selection });
    const { result } = renderHook(() => useFileOperations(opts));
    act(() => result.current.openMovePicker());
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("dispatches OPEN_COPY_PICKER when selection is non-empty", () => {
    const dispatch = makeDispatch();
    const selection = makeSelection(new Set(["/home/user/f.txt"]));
    const opts = buildOptions({ dispatch, selection });
    const { result } = renderHook(() => useFileOperations(opts));
    act(() => result.current.openCopyPicker());
    expect(dispatch).toHaveBeenCalledWith({ type: "OPEN_COPY_PICKER" });
  });
});
