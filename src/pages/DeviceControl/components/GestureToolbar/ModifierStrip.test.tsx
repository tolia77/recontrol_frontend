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

// Sticky modifier mechanics

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

// Non-sticky keys (Esc, Tab, arrows)

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

// deliverPrintable — combo routing via imperative handle

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

  it("with Ctrl sticky, deliverPrintable('ab') types every char then releases the modifier once", () => {
    const addAction = vi.fn();
    const stripRef = React.createRef<ModifierStripHandle>();

    renderStrip(addAction, { stripRef });

    // Arm Ctrl
    fireEvent.click(screen.getByText("Ctrl"));
    addAction.mockClear();

    // Deliver a multi-char commit through the strip
    act(() => {
      stripRef.current!.deliverPrintable("ab");
    });

    // keyDown(A=65), keyUp(65), keyDown(B=66), keyUp(66), then keyUp(Ctrl=17)
    expect(addAction).toHaveBeenCalledTimes(5);
    expect(addAction.mock.calls[0][0]).toMatchObject({ type: "keyboard.keyDown", payload: { Key: 65 } });
    expect(addAction.mock.calls[1][0]).toMatchObject({ type: "keyboard.keyUp", payload: { Key: 65 } });
    expect(addAction.mock.calls[2][0]).toMatchObject({ type: "keyboard.keyDown", payload: { Key: 66 } });
    expect(addAction.mock.calls[3][0]).toMatchObject({ type: "keyboard.keyUp", payload: { Key: 66 } });
    expect(addAction.mock.calls[4][0]).toMatchObject({ type: "keyboard.keyUp", payload: { Key: 17 } });

    // Sticky cleared after full delivery
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

// Ctrl+Alt+Del compound action

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

// Unmount cleanup: release sticky modifiers and flush pending keyUps

describe("ModifierStrip — unmount cleanup", () => {
  it("unmount with Ctrl armed dispatches keyUp(17)", () => {
    const addAction = vi.fn();
    const { unmount } = renderStrip(addAction);

    // Arm Ctrl
    fireEvent.click(screen.getByText("Ctrl"));
    addAction.mockClear();

    unmount();

    expect(addAction).toHaveBeenCalledOnce();
    expect(addAction.mock.calls[0][0]).toMatchObject({
      type: "keyboard.keyUp",
      payload: { Key: 17 },
    });
  });

  it("unmount with Ctrl AND Shift armed dispatches keyUp(Shift=16) then keyUp(Ctrl=17) in reverse order", () => {
    const addAction = vi.fn();
    const { unmount } = renderStrip(addAction);

    fireEvent.click(screen.getByText("Ctrl"));
    fireEvent.click(screen.getByText("Shift"));
    addAction.mockClear();

    unmount();

    expect(addAction).toHaveBeenCalledTimes(2);
    expect(addAction.mock.calls[0][0]).toMatchObject({
      type: "keyboard.keyUp",
      payload: { Key: 16 }, // Shift released first
    });
    expect(addAction.mock.calls[1][0]).toMatchObject({
      type: "keyboard.keyUp",
      payload: { Key: 17 }, // Ctrl released second
    });
  });

  it("unmount with no modifier armed dispatches zero additional keyUps", () => {
    const addAction = vi.fn();
    const { unmount } = renderStrip(addAction);

    unmount();

    expect(addAction).not.toHaveBeenCalled();
  });

  it("unmount with disabled=true dispatches zero keyUps (arming was suppressed)", () => {
    const addAction = vi.fn();
    const { unmount } = renderStrip(addAction, { disabled: true });

    unmount();

    expect(addAction).not.toHaveBeenCalled();
  });

  it("tapping Tab then unmounting before timers advance flushes keyUp(9) synchronously", () => {
    vi.useFakeTimers();
    const addAction = vi.fn();
    const { unmount } = renderStrip(addAction);

    fireEvent.click(screen.getByText("Tab"));

    // Only keyDown dispatched so far
    expect(addAction).toHaveBeenCalledOnce();
    addAction.mockClear();

    // Unmount without advancing timers
    unmount();

    // Cleanup must flush the pending keyUp(9) synchronously
    expect(addAction).toHaveBeenCalledOnce();
    expect(addAction.mock.calls[0][0]).toMatchObject({
      type: "keyboard.keyUp",
      payload: { Key: 9 },
    });

    // Advance timers — original setTimeout callback should NOT double-fire (timer was cleared)
    act(() => { vi.advanceTimersByTime(100); });
    expect(addAction).toHaveBeenCalledOnce(); // still only 1, no double-fire

    vi.useRealTimers();
  });
});

// Focus-steal guard: strip taps must not blur the hidden input
// (blur unmounts the strip before click fires → no key ever dispatched)

describe("ModifierStrip — focus-steal guard", () => {
  it("pointerdown on a strip button is default-prevented (hidden input keeps focus)", () => {
    const addAction = vi.fn();
    renderStrip(addAction);

    const altBtn = screen.getByText("Alt").closest("button")!;
    const prevented = !fireEvent.pointerDown(altBtn); // fireEvent returns false when defaultPrevented

    expect(prevented).toBe(true);
  });

  it("mousedown on a strip button is default-prevented (non-pointer-event fallback)", () => {
    const addAction = vi.fn();
    renderStrip(addAction);

    const tabBtn = screen.getByText("Tab").closest("button")!;
    const prevented = !fireEvent.mouseDown(tabBtn);

    expect(prevented).toBe(true);
  });
});

// Fn page toggle

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
