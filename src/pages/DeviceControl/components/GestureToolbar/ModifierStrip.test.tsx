import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import React from "react";
import ModifierStrip, { type ModifierStripHandle } from "./ModifierStrip";
import type { CommandAction } from "src/pages/DeviceControl/types";

// vitest.config.ts has globals: false — auto-cleanup does NOT register.
afterEach(() => {
  cleanup();
});

// Mock crypto.randomUUID so we don't need a real environment
beforeEach(() => {
  let counter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => `uuid-${++counter}` as ReturnType<typeof crypto.randomUUID>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const tMock = (key: string) => {
  const map: Record<string, string> = {
    "mobile.modifierStrip.ariaLabel": "Special keys",
    "mobile.modifierStrip.ctrl": "Ctrl",
    "mobile.modifierStrip.alt": "Alt",
    "mobile.modifierStrip.win": "Win",
    "mobile.modifierStrip.shift": "Shift",
    "mobile.modifierStrip.esc": "Esc",
    "mobile.modifierStrip.tab": "Tab",
    "mobile.modifierStrip.fn": "Fn",
    "mobile.modifierStrip.ctrlAltDel": "CAD",
  };
  return map[key] ?? key;
};

function renderStrip(
  addAction: (a: CommandAction) => void,
  {
    disabled = false,
    keyboardHeightPx = 0,
    stripRef,
  }: {
    disabled?: boolean;
    keyboardHeightPx?: number;
    stripRef?: React.Ref<ModifierStripHandle>;
  } = {},
) {
  return render(
    <ModifierStrip
      ref={stripRef}
      addAction={addAction}
      disabled={disabled}
      keyboardHeightPx={keyboardHeightPx}
      t={tMock}
    />,
  );
}

// ---------------------------------------------------------------------------
// KBD-03: Sticky modifier mechanics
// ---------------------------------------------------------------------------

describe("ModifierStrip — sticky modifier mechanics", () => {
  it("tapping Ctrl dispatches keyboard.keyDown with Key:17", () => {
    const addAction = vi.fn();
    renderStrip(addAction);

    fireEvent.click(screen.getByText("Ctrl"));

    expect(addAction).toHaveBeenCalledOnce();
    expect(addAction.mock.calls[0][0]).toMatchObject({
      type: "keyboard.keyDown",
      payload: { Key: 17 },
    });
  });

  it("tapping Ctrl sets aria-pressed=true on the key", () => {
    const addAction = vi.fn();
    renderStrip(addAction);

    const ctrlBtn = screen.getByText("Ctrl").closest("button")!;
    expect(ctrlBtn.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(ctrlBtn);
    expect(ctrlBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("tapping Ctrl twice (cancel) dispatches keyDown then keyUp(17), clears highlight", () => {
    const addAction = vi.fn();
    renderStrip(addAction);

    const ctrlBtn = screen.getByText("Ctrl").closest("button")!;

    // First tap — keyDown
    fireEvent.click(ctrlBtn);
    expect(addAction).toHaveBeenCalledOnce();
    expect(addAction.mock.calls[0][0]).toMatchObject({
      type: "keyboard.keyDown",
      payload: { Key: 17 },
    });

    // Second tap — cancel → keyUp
    fireEvent.click(ctrlBtn);
    expect(addAction).toHaveBeenCalledTimes(2);
    expect(addAction.mock.calls[1][0]).toMatchObject({
      type: "keyboard.keyUp",
      payload: { Key: 17 },
    });

    // aria-pressed back to false
    expect(ctrlBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("disabled=true → zero addAction calls on any key tap", () => {
    const addAction = vi.fn();
    renderStrip(addAction, { disabled: true });

    fireEvent.click(screen.getByText("Ctrl"));
    fireEvent.click(screen.getByText("Esc"));
    fireEvent.click(screen.getByText("Tab"));

    expect(addAction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// KBD-03: Non-sticky keys (Esc, Tab, arrows)
// ---------------------------------------------------------------------------

describe("ModifierStrip — non-sticky keys", () => {
  it("tapping Esc dispatches keyDown(27)", async () => {
    const addAction = vi.fn();
    renderStrip(addAction);

    fireEvent.click(screen.getByText("Esc"));

    // keyDown fires immediately
    expect(addAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "keyboard.keyDown", payload: { Key: 27 } }),
    );
  });

  it("tapping Tab dispatches keyDown(9) then keyUp(9) after timeout", async () => {
    vi.useFakeTimers();
    const addAction = vi.fn();
    renderStrip(addAction);

    fireEvent.click(screen.getByText("Tab"));

    // Only keyDown dispatched synchronously
    expect(addAction).toHaveBeenCalledOnce();
    expect(addAction.mock.calls[0][0]).toMatchObject({
      type: "keyboard.keyDown",
      payload: { Key: 9 },
    });

    // After the 50ms timeout, keyUp fires
    await act(async () => { vi.advanceTimersByTime(50); });

    expect(addAction).toHaveBeenCalledTimes(2);
    expect(addAction.mock.calls[1][0]).toMatchObject({
      type: "keyboard.keyUp",
      payload: { Key: 9 },
    });

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// KBD-03: deliverPrintable — combo routing via imperative handle
// ---------------------------------------------------------------------------

describe("ModifierStrip — deliverPrintable (combo routing)", () => {
  it("with Ctrl sticky, deliverPrintable('c') → keyDown(67), keyUp(67), keyUp(17), clears sticky", () => {
    const addAction = vi.fn();
    const stripRef = React.createRef<ModifierStripHandle>();

    renderStrip(addAction, { stripRef });

    // Arm Ctrl
    fireEvent.click(screen.getByText("Ctrl"));
    addAction.mockClear();

    // Deliver 'c' through the strip
    act(() => {
      stripRef.current!.deliverPrintable("c");
    });

    expect(addAction).toHaveBeenCalledTimes(3);
    expect(addAction.mock.calls[0][0]).toMatchObject({ type: "keyboard.keyDown", payload: { Key: 67 } });
    expect(addAction.mock.calls[1][0]).toMatchObject({ type: "keyboard.keyUp", payload: { Key: 67 } });
    expect(addAction.mock.calls[2][0]).toMatchObject({ type: "keyboard.keyUp", payload: { Key: 17 } });

    // Sticky cleared — Ctrl no longer aria-pressed
    const ctrlBtn = screen.getByText("Ctrl").closest("button")!;
    expect(ctrlBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("hasActiveModifier returns false when no modifier is sticky", () => {
    const addAction = vi.fn();
    const stripRef = React.createRef<ModifierStripHandle>();

    renderStrip(addAction, { stripRef });

    expect(stripRef.current!.hasActiveModifier()).toBe(false);
  });

  it("hasActiveModifier returns true after tapping a modifier", () => {
    const addAction = vi.fn();
    const stripRef = React.createRef<ModifierStripHandle>();

    renderStrip(addAction, { stripRef });

    fireEvent.click(screen.getByText("Ctrl"));
    expect(stripRef.current!.hasActiveModifier()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KBD-03: Ctrl+Alt+Del compound action
// ---------------------------------------------------------------------------

describe("ModifierStrip — CAD (Ctrl+Alt+Del)", () => {
  it("tapping CAD dispatches keyDown(17,18,46) then keyUp(46,18,17)", async () => {
    vi.useFakeTimers();
    const addAction = vi.fn();

    // Switch to Fn page first
    renderStrip(addAction);

    fireEvent.click(screen.getByText("Fn"));
    addAction.mockClear();

    fireEvent.click(screen.getByText("CAD"));

    // Three keyDowns dispatched synchronously
    expect(addAction).toHaveBeenCalledTimes(3);
    expect(addAction.mock.calls[0][0]).toMatchObject({ type: "keyboard.keyDown", payload: { Key: 17 } });
    expect(addAction.mock.calls[1][0]).toMatchObject({ type: "keyboard.keyDown", payload: { Key: 18 } });
    expect(addAction.mock.calls[2][0]).toMatchObject({ type: "keyboard.keyDown", payload: { Key: 46 } });

    // After 50ms, three keyUps in reverse order
    await act(async () => { vi.advanceTimersByTime(50); });

    expect(addAction).toHaveBeenCalledTimes(6);
    expect(addAction.mock.calls[3][0]).toMatchObject({ type: "keyboard.keyUp", payload: { Key: 46 } });
    expect(addAction.mock.calls[4][0]).toMatchObject({ type: "keyboard.keyUp", payload: { Key: 18 } });
    expect(addAction.mock.calls[5][0]).toMatchObject({ type: "keyboard.keyUp", payload: { Key: 17 } });

    vi.useRealTimers();
  });

  it("CAD disabled → zero addAction calls", async () => {
    vi.useFakeTimers();
    const addAction = vi.fn();
    renderStrip(addAction, { disabled: true });

    // Switch to Fn page
    fireEvent.click(screen.getByText("Fn"));
    addAction.mockClear();

    fireEvent.click(screen.getByText("CAD"));
    await act(async () => { vi.advanceTimersByTime(50); });

    expect(addAction).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// Fn page toggle
// ---------------------------------------------------------------------------

describe("ModifierStrip — Fn page toggle", () => {
  it("tapping Fn shows the F1-F12 page and CAD button", () => {
    const addAction = vi.fn();
    renderStrip(addAction);

    fireEvent.click(screen.getByText("Fn"));

    expect(screen.getByText("F1")).toBeTruthy();
    expect(screen.getByText("F12")).toBeTruthy();
    expect(screen.getByText("CAD")).toBeTruthy();
  });

  it("tapping Fn again returns to the main row", () => {
    const addAction = vi.fn();
    renderStrip(addAction);

    fireEvent.click(screen.getByText("Fn")); // switch to Fn page
    fireEvent.click(screen.getByText("Fn")); // switch back

    expect(screen.getByText("Ctrl")).toBeTruthy();
    expect(screen.queryByText("F1")).toBeNull();
  });
});
