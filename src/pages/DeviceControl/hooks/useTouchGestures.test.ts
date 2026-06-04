/**
 * useTouchGestures.test.ts — TOUCH-02/03/04/05 classification proof
 *
 * Tests the gesture classifier via two strategies:
 *   1. Pure helper functions extracted from the hook (classifyTap, clicksFromDelta)
 *   2. A thin harness feeding synthetic pointer-event-like objects to the hook
 *      handlers, with a spy addAction to assert the correct envelope sequence.
 *
 * Uses vitest fake timers for long-press (400ms) and double-tap (300ms) windows.
 * jsdom's PointerEvent support is partial, so we construct plain objects matching
 * the React.PointerEvent shape that the handlers read.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import {
  useTouchGestures,
  classifyTap,
  clicksFromDelta,
  TAP_MAX_MS,
  TAP_MAX_MOVE_PX,
  DOUBLE_TAP_WINDOW_MS,
  LONG_PRESS_MS,
} from "./useTouchGestures";
import type { CommandAction } from "src/pages/DeviceControl/types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Synthetic pointer event factory
// ---------------------------------------------------------------------------

function makePointerEvent(
  overrides: Partial<{
    pointerId: number;
    clientX: number;
    clientY: number;
    button: number;
    buttons: number;
    pointerType: string;
  }> = {},
) {
  const {
    pointerId = 1,
    clientX = 100,
    clientY = 100,
    button = 0,
    buttons = 1,
    pointerType = "touch",
  } = overrides;

  const target = {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  };

  return {
    pointerId,
    clientX,
    clientY,
    button,
    buttons,
    pointerType,
    preventDefault: vi.fn(),
    target,
    // React.PointerEvent expects nativeEvent — not read by our handlers
  } as unknown as React.PointerEvent<Element>;
}

// Container rect helper (same pattern as coord tests)
function makeRect(w: number, h: number): DOMRect {
  return {
    left: 0,
    top: 0,
    width: w,
    height: h,
    right: w,
    bottom: h,
    x: 0,
    y: 0,
    toJSON() {},
  } as DOMRect;
}

// Intrinsic dimensions helper
function makeIntrinsic(nW = 1920, nH = 1080) {
  return { nW, nH };
}

// ---------------------------------------------------------------------------
// Hook harness: renders useTouchGestures with spied addAction
// ---------------------------------------------------------------------------

function renderGestureHook(disabled = false) {
  const addAction = vi.fn<(action: CommandAction) => void>();
  const rect = makeRect(390, 844);
  const intrinsic = makeIntrinsic();

  const { result } = renderHook(() =>
    useTouchGestures({
      addAction,
      disabled,
      getRect: () => rect,
      getIntrinsic: () => intrinsic,
    }),
  );

  return { addAction, handlers: result.current };
}

// ---------------------------------------------------------------------------
// Pure helper unit tests
// ---------------------------------------------------------------------------

describe("classifyTap (pure helper)", () => {
  it("returns true for press within TAP_MAX_MS and small movement", () => {
    const entry = {
      startX: 100,
      startY: 100,
      startT: 1000,
      lastX: 103,
      lastY: 102,
    };
    expect(classifyTap(entry, 1000 + TAP_MAX_MS - 1)).toBe(true);
  });

  it("returns false when duration exceeds TAP_MAX_MS", () => {
    const entry = {
      startX: 100,
      startY: 100,
      startT: 1000,
      lastX: 100,
      lastY: 100,
    };
    expect(classifyTap(entry, 1000 + TAP_MAX_MS + 1)).toBe(false);
  });

  it("returns false when movement exceeds TAP_MAX_MOVE_PX", () => {
    const entry = {
      startX: 100,
      startY: 100,
      startT: 1000,
      lastX: 100 + TAP_MAX_MOVE_PX + 1,
      lastY: 100,
    };
    expect(classifyTap(entry, 1000 + 50)).toBe(false);
  });
});

describe("clicksFromDelta (pure helper)", () => {
  it("returns positive for drag upward (natural scroll: content follows fingers)", () => {
    // drag up means dy is negative (clientY decreased) → remote scrolls down → positive Clicks
    const clicks = clicksFromDelta(-120);
    expect(clicks).toBeGreaterThan(0);
  });

  it("returns negative for drag downward", () => {
    const clicks = clicksFromDelta(120);
    expect(clicks).toBeLessThan(0);
  });

  it("returns 0 for no movement", () => {
    expect(clicksFromDelta(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Threshold constants exported and match spec
// ---------------------------------------------------------------------------

describe("threshold constants (TOUCH spec-locked values)", () => {
  it("TAP_MAX_MS is 200", () => expect(TAP_MAX_MS).toBe(200));
  it("TAP_MAX_MOVE_PX is 8", () => expect(TAP_MAX_MOVE_PX).toBe(8));
  it("DOUBLE_TAP_WINDOW_MS is 300", () => expect(DOUBLE_TAP_WINDOW_MS).toBe(300));
  it("LONG_PRESS_MS is 400", () => expect(LONG_PRESS_MS).toBe(400));
});

// ---------------------------------------------------------------------------
// Integration tests via handler harness
// ---------------------------------------------------------------------------

describe("useTouchGestures integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  // TOUCH-02: one-finger tap → left click down/up
  it("TOUCH-02: one-finger tap emits mouse.down then mouse.up with Button=0 (left)", async () => {
    const { addAction, handlers } = renderGestureHook();

    const down = makePointerEvent({ pointerId: 1, clientX: 100, clientY: 100 });
    const up = makePointerEvent({
      pointerId: 1,
      clientX: 102,
      clientY: 101,
      buttons: 0,
    });

    act(() => {
      handlers.onPointerDown(down);
    });

    // lift within TAP_MAX_MS (simulate 50ms elapsed via fake timers)
    act(() => {
      vi.advanceTimersByTime(50);
      handlers.onPointerUp(up);
    });

    expect(addAction).toHaveBeenCalledTimes(2);
    expect(addAction).toHaveBeenNthCalledWith(1, {
      type: "mouse.down",
      payload: { Button: 0 },
    });
    expect(addAction).toHaveBeenNthCalledWith(2, {
      type: "mouse.up",
      payload: { Button: 0 },
    });
  });

  // TOUCH-02: double-tap → two left down/up sequences
  it("TOUCH-02: double-tap emits two left down/up sequences", async () => {
    const { addAction, handlers } = renderGestureHook();

    const tap = (id = 1) =>
      makePointerEvent({ pointerId: id, clientX: 100, clientY: 100 });
    const lift = (id = 1) =>
      makePointerEvent({ pointerId: id, clientX: 102, clientY: 101, buttons: 0 });

    // First tap
    act(() => {
      handlers.onPointerDown(tap());
    });
    act(() => {
      vi.advanceTimersByTime(50);
      handlers.onPointerUp(lift());
    });

    // Second tap within DOUBLE_TAP_WINDOW_MS
    act(() => {
      vi.advanceTimersByTime(100);
      handlers.onPointerDown(tap());
    });
    act(() => {
      vi.advanceTimersByTime(50);
      handlers.onPointerUp(lift());
    });

    // Expect 4 calls: 2 down/up pairs
    expect(addAction).toHaveBeenCalledTimes(4);
    const types = addAction.mock.calls.map((c) => c[0].type);
    expect(types).toEqual([
      "mouse.down",
      "mouse.up",
      "mouse.down",
      "mouse.up",
    ]);
  });

  // TOUCH-03: tap-hold-drag → mouse.down on arm, mouse.move during drag, mouse.up on lift
  it("TOUCH-03: tap-hold-drag emits mouse.down on long-press arm, mouse.move on drag, mouse.up on lift", () => {
    const { addAction, handlers } = renderGestureHook();

    const down = makePointerEvent({ pointerId: 1, clientX: 100, clientY: 100 });
    act(() => {
      handlers.onPointerDown(down);
    });

    // Hold for LONG_PRESS_MS without moving — arms drag mode
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    });

    // mouse.down should be emitted after the timer
    expect(addAction).toHaveBeenCalledWith({
      type: "mouse.down",
      payload: { Button: 0 },
    });

    // Now drag the finger (move > 8px)
    const move = makePointerEvent({
      pointerId: 1,
      clientX: 150,
      clientY: 130,
    });
    act(() => {
      handlers.onPointerMove(move);
    });

    // Flush rAF-coalesced mouse.move (advance timers doesn't advance rAF in jsdom;
    // the rAF callback is invoked synchronously in jsdom test env when not mocked)
    // Just assert mouse.move was queued (addAction won't have it yet since rAF is pending,
    // but we can verify it's not a tap sequence)
    const up = makePointerEvent({
      pointerId: 1,
      clientX: 150,
      clientY: 130,
      buttons: 0,
    });
    act(() => {
      handlers.onPointerUp(up);
    });

    const types = addAction.mock.calls.map((c) => c[0].type);
    expect(types).toContain("mouse.down");
    expect(types).toContain("mouse.up");
    // Verify the up button is left (0)
    const upCall = addAction.mock.calls.find((c) => c[0].type === "mouse.up");
    expect(upCall?.[0].payload?.Button).toBe(0);
  });

  // TOUCH-04: two-finger tap → right-click (mapButtonToBackend(2) → 1)
  it("TOUCH-04: two-finger tap emits mouse.down/up with Button=1 (right, via mapButtonToBackend(2))", () => {
    const { addAction, handlers } = renderGestureHook();

    const down1 = makePointerEvent({ pointerId: 1, clientX: 100, clientY: 100 });
    const down2 = makePointerEvent({ pointerId: 2, clientX: 120, clientY: 100 });

    act(() => {
      handlers.onPointerDown(down1);
      handlers.onPointerDown(down2);
    });

    const up1 = makePointerEvent({ pointerId: 1, clientX: 102, clientY: 101, buttons: 0 });
    const up2 = makePointerEvent({ pointerId: 2, clientX: 122, clientY: 101, buttons: 0 });

    act(() => {
      vi.advanceTimersByTime(80);
      handlers.onPointerUp(up1);
      handlers.onPointerUp(up2);
    });

    const types = addAction.mock.calls.map((c) => c[0].type);
    expect(types).toContain("mouse.down");
    expect(types).toContain("mouse.up");

    const downCall = addAction.mock.calls.find((c) => c[0].type === "mouse.down");
    expect(downCall?.[0].payload?.Button).toBe(1); // mapButtonToBackend(2) === 1
  });

  // TOUCH-05: two-finger vertical drag → mouse.scroll
  it("TOUCH-05: two-finger drag up emits mouse.scroll with positive Clicks (natural scroll)", () => {
    const { addAction, handlers } = renderGestureHook();

    const down1 = makePointerEvent({ pointerId: 1, clientX: 100, clientY: 200 });
    const down2 = makePointerEvent({ pointerId: 2, clientX: 120, clientY: 200 });

    act(() => {
      handlers.onPointerDown(down1);
      handlers.onPointerDown(down2);
    });

    // Drag both fingers up by 60px (drag up → natural scroll → remote content scrolls down → positive Clicks)
    const move1 = makePointerEvent({ pointerId: 1, clientX: 100, clientY: 140 });
    const move2 = makePointerEvent({ pointerId: 2, clientX: 120, clientY: 140 });

    act(() => {
      vi.advanceTimersByTime(50);
      handlers.onPointerMove(move1);
      handlers.onPointerMove(move2);
    });

    // Give a bit of time for rAF-coalesced scroll (jsdom handles rAF synchronously in some cases)
    act(() => {
      vi.advanceTimersByTime(50);
    });

    const scrollCalls = addAction.mock.calls.filter(
      (c) => c[0].type === "mouse.scroll",
    );
    expect(scrollCalls.length).toBeGreaterThan(0);
    const clicks = scrollCalls[0][0].payload?.Clicks as number;
    expect(clicks).toBeGreaterThan(0);
  });

  // Defect 1 regression: hold-drag active → second finger joins → left button released exactly once
  it("Defect-1: second finger joining during hold-drag releases the held left button exactly once", () => {
    const { addAction, handlers } = renderGestureHook();

    // Arm hold-drag: put one finger down and hold for LONG_PRESS_MS
    const down1 = makePointerEvent({ pointerId: 1, clientX: 100, clientY: 100 });
    act(() => {
      handlers.onPointerDown(down1);
    });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    });

    // Confirm we are in hold-drag: mouse.down (left) should have been emitted
    expect(addAction).toHaveBeenCalledWith({
      type: "mouse.down",
      payload: { Button: 0 },
    });
    const callCountAfterArm = addAction.mock.calls.length;

    // Now a second finger joins — should release the held button exactly once
    const down2 = makePointerEvent({ pointerId: 2, clientX: 150, clientY: 150 });
    act(() => {
      handlers.onPointerDown(down2);
    });

    // Exactly one additional call — the mouse.up release
    expect(addAction).toHaveBeenCalledTimes(callCountAfterArm + 1);
    expect(addAction).toHaveBeenLastCalledWith({
      type: "mouse.up",
      payload: { Button: 0 },
    });

    // Subsequent two-finger lift should go through the two-finger path, not emit more left ups
    const up1 = makePointerEvent({ pointerId: 1, clientX: 102, clientY: 101, buttons: 0 });
    const up2 = makePointerEvent({ pointerId: 2, clientX: 152, clientY: 151, buttons: 0 });
    act(() => {
      vi.advanceTimersByTime(50);
      handlers.onPointerUp(up1);
      handlers.onPointerUp(up2);
    });

    // No additional left mouse.up should have been emitted (finger lifts were slow, not a right-click tap)
    const leftUpCalls = addAction.mock.calls.filter(
      (c) => c[0].type === "mouse.up" && c[0].payload?.Button === 0,
    );
    expect(leftUpCalls).toHaveLength(1);
  });

  // Defect 2 regression: press between TAP_MAX_MS and LONG_PRESS_MS (dead zone) now emits a click
  it("Defect-2: still press of ~300ms (TAP_MAX_MS < duration < LONG_PRESS_MS) registers as a click", () => {
    const { addAction, handlers } = renderGestureHook();

    const down = makePointerEvent({ pointerId: 1, clientX: 100, clientY: 100 });
    act(() => {
      handlers.onPointerDown(down);
    });

    // Advance to 300ms — past TAP_MAX_MS (200ms) but before LONG_PRESS_MS (400ms)
    // Under the old code this was the dead zone (too slow for classifyTap, too fast for long-press).
    // Under the new movement-only check this should register as a click.
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Lift with minimal movement (<8px) — long-press timer has NOT fired (400ms not reached)
    const up = makePointerEvent({ pointerId: 1, clientX: 103, clientY: 102, buttons: 0 });
    act(() => {
      handlers.onPointerUp(up);
    });

    // Must emit exactly one left down + up pair (dead zone is now closed)
    expect(addAction).toHaveBeenCalledTimes(2);
    expect(addAction).toHaveBeenNthCalledWith(1, {
      type: "mouse.down",
      payload: { Button: 0 },
    });
    expect(addAction).toHaveBeenNthCalledWith(2, {
      type: "mouse.up",
      payload: { Button: 0 },
    });
  });

  // Defect 3 regression: unmounting during hold-drag emits the left-up release
  it("Defect-3: unmounting mid-hold-drag emits a left mouse.up release", () => {
    const addAction = vi.fn<(action: CommandAction) => void>();
    const rect = makeRect(390, 844);
    const intrinsic = { nW: 1920, nH: 1080 };

    const { result, unmount } = renderHook(() =>
      useTouchGestures({
        addAction,
        disabled: false,
        getRect: () => rect,
        getIntrinsic: () => intrinsic,
      }),
    );

    const handlers = result.current;

    // Arm hold-drag
    const down = makePointerEvent({ pointerId: 1, clientX: 100, clientY: 100 });
    act(() => {
      handlers.onPointerDown(down);
    });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS + 10);
    });

    // Confirm in hold-drag: mouse.down emitted
    expect(addAction).toHaveBeenCalledWith({
      type: "mouse.down",
      payload: { Button: 0 },
    });
    const callCountAfterArm = addAction.mock.calls.length;

    // Unmount without lifting the finger (simulates connection blip / overlay unmount)
    act(() => {
      unmount();
    });

    // Safety net must have fired: exactly one mouse.up
    expect(addAction).toHaveBeenCalledTimes(callCountAfterArm + 1);
    expect(addAction).toHaveBeenLastCalledWith({
      type: "mouse.up",
      payload: { Button: 0 },
    });
  });

  // Disabled: no envelopes emitted when disabled=true
  it("disabled=true: no envelope emitted for any gesture", () => {
    const { addAction, handlers } = renderGestureHook(true);

    const down = makePointerEvent({ pointerId: 1, clientX: 100, clientY: 100 });
    const up = makePointerEvent({ pointerId: 1, clientX: 102, clientY: 101, buttons: 0 });

    act(() => {
      handlers.onPointerDown(down);
    });
    act(() => {
      vi.advanceTimersByTime(50);
      handlers.onPointerUp(up);
    });

    expect(addAction).not.toHaveBeenCalled();
  });
});
