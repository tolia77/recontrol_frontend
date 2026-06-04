import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import GestureToolbar from "./GestureToolbar";
import type { CommandAction } from "src/pages/DeviceControl/types";

// vitest.config.ts has globals: false — auto-cleanup does NOT register.
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  let counter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `uuid-${++counter}` as ReturnType<typeof crypto.randomUUID>,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderToolbar(
  addAction: (a: CommandAction) => void,
  {
    canUseKeyboard = true,
    rightPaneActive = null,
  }: {
    canUseKeyboard?: boolean;
    rightPaneActive?: "files" | "assistant" | "scenarios" | null;
  } = {},
) {
  return render(
    <MemoryRouter>
      <GestureToolbar
        addAction={addAction}
        disabled={false}
        rightPaneActive={rightPaneActive}
        onSelectPanel={vi.fn()}
        aiAllowed={true}
        onAiBlocked={vi.fn()}
        onDisconnect={vi.fn()}
        canUseKeyboard={canUseKeyboard}
      />
    </MemoryRouter>,
  );
}

/** Helper: raise the keyboard (focus hidden input) */
function raiseKeyboard(container: HTMLElement) {
  const input = container.querySelector('input[aria-hidden="true"]') as HTMLInputElement;
  expect(input).toBeTruthy();
  act(() => {
    input.focus();
    fireEvent.focus(input);
  });
  return input;
}

// ---------------------------------------------------------------------------
// KBD-02: Hidden input attributes
// ---------------------------------------------------------------------------

describe("GestureToolbar — hidden input attributes", () => {
  it("has D-02 suppression attributes", () => {
    const { container } = renderToolbar(vi.fn());
    const input = container.querySelector('input[aria-hidden="true"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.getAttribute("autocapitalize")).toBe("off");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("autocomplete")).toBe("off");
  });
});

// ---------------------------------------------------------------------------
// KBD-02: onInput → typeText (no modifier)
// ---------------------------------------------------------------------------

describe("GestureToolbar — onInput pipeline", () => {
  it("onInput with value 'h' and no modifier dispatches keyboard.typeText", () => {
    vi.useFakeTimers();
    const addAction = vi.fn();
    const { container } = renderToolbar(addAction);
    const input = raiseKeyboard(container);

    // Simulate typing 'h' into the hidden input
    Object.defineProperty(input, "value", { writable: true, value: "h" });
    fireEvent.input(input);

    expect(addAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "keyboard.typeText", payload: { Text: "h" } }),
    );

    // Input value should be cleared
    expect(input.value).toBe("");

    vi.useRealTimers();
  });

  it("onInput with empty value dispatches nothing", () => {
    const addAction = vi.fn();
    const { container } = renderToolbar(addAction);
    const input = raiseKeyboard(container);

    Object.defineProperty(input, "value", { writable: true, value: "" });
    fireEvent.input(input);

    expect(addAction).not.toHaveBeenCalled();
  });

  it("onInput with canUseKeyboard=false dispatches nothing", () => {
    const addAction = vi.fn();
    const { container } = renderToolbar(addAction, { canUseKeyboard: false });
    const input = raiseKeyboard(container);

    Object.defineProperty(input, "value", { writable: true, value: "a" });
    fireEvent.input(input);

    expect(addAction).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// KBD-02: onKeyDown → keyDown + keyUp (control keys)
// ---------------------------------------------------------------------------

describe("GestureToolbar — onKeyDown pipeline", () => {
  it("Enter dispatches keyDown(13) then keyUp(13) after 50ms", async () => {
    vi.useFakeTimers();
    const addAction = vi.fn();
    const { container } = renderToolbar(addAction);
    const input = raiseKeyboard(container);

    fireEvent.keyDown(input, { key: "Enter" });

    expect(addAction).toHaveBeenCalledOnce();
    expect(addAction.mock.calls[0][0]).toMatchObject({
      type: "keyboard.keyDown",
      payload: { Key: 13 },
    });

    await act(async () => { vi.advanceTimersByTime(50); });

    expect(addAction).toHaveBeenCalledTimes(2);
    expect(addAction.mock.calls[1][0]).toMatchObject({
      type: "keyboard.keyUp",
      payload: { Key: 13 },
    });

    vi.useRealTimers();
  });

  it("printable key 'a' onKeyDown dispatches nothing (handled by onInput)", () => {
    const addAction = vi.fn();
    const { container } = renderToolbar(addAction);
    const input = raiseKeyboard(container);

    fireEvent.keyDown(input, { key: "a" });

    expect(addAction).not.toHaveBeenCalled();
  });

  it("Backspace dispatches keyDown(8)", () => {
    vi.useFakeTimers();
    const addAction = vi.fn();
    const { container } = renderToolbar(addAction);
    const input = raiseKeyboard(container);

    fireEvent.keyDown(input, { key: "Backspace" });

    expect(addAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "keyboard.keyDown", payload: { Key: 8 } }),
    );
    vi.useRealTimers();
  });

  it("ArrowLeft dispatches keyDown(37)", () => {
    vi.useFakeTimers();
    const addAction = vi.fn();
    const { container } = renderToolbar(addAction);
    const input = raiseKeyboard(container);

    fireEvent.keyDown(input, { key: "ArrowLeft" });

    expect(addAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: "keyboard.keyDown", payload: { Key: 37 } }),
    );
    vi.useRealTimers();
  });

  it("canUseKeyboard=false → onKeyDown dispatches nothing", () => {
    vi.useFakeTimers();
    const addAction = vi.fn();
    const { container } = renderToolbar(addAction, { canUseKeyboard: false });
    const input = raiseKeyboard(container);

    fireEvent.keyDown(input, { key: "Enter" });

    expect(addAction).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// KBD-02: ModifierStrip mount condition
// ---------------------------------------------------------------------------

describe("GestureToolbar — ModifierStrip mount condition", () => {
  it("ModifierStrip is NOT rendered when keyboard is not raised", () => {
    renderToolbar(vi.fn());
    // Strip has aria-label="Special keys"
    expect(screen.queryByRole("toolbar", { name: "Special keys" })).toBeNull();
  });

  it("ModifierStrip IS rendered when keyboard is raised and no pane is active", () => {
    const { container } = renderToolbar(vi.fn(), { rightPaneActive: null });
    raiseKeyboard(container);
    // The strip has role="toolbar" — look for it by role regardless of aria-label
    // (i18n returns the key in test environment, not "Special keys")
    expect(screen.queryByRole("toolbar")).toBeTruthy();
  });

  it("ModifierStrip is NOT rendered when a right pane is active (sheet wins)", () => {
    const { container } = renderToolbar(vi.fn(), { rightPaneActive: "files" });
    raiseKeyboard(container);
    expect(screen.queryByRole("toolbar")).toBeNull();
  });
});
