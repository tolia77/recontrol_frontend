/**
 * useTouchGestures.ts
 *
 * Pointer-event gesture classifier → mouse.* envelopes through the injected
 * addAction permission gate (S1 — never accesses the socket directly).
 *
 * Implements the locked gesture map (36-CONTEXT D-08/D-09, 36-UI-SPEC §D,
 * RESEARCH Pattern 3):
 *   - 1-finger drag → useVirtualCursor.move (TOUCH-01)
 *   - 1-finger tap  → left click down/up (TOUCH-02)
 *   - double-tap    → two left down/up sequences (TOUCH-02)
 *   - tap-hold-drag → mouse.down on arm, mouse.move during drag, mouse.up on lift (TOUCH-03)
 *   - 2-finger tap  → right click via mapButtonToBackend(2) (TOUCH-04)
 *   - 2-finger drag → mouse.scroll with natural direction (TOUCH-05, D-09)
 *
 * All envelopes flow exclusively through the injected `addAction` (V4/Elevation
 * control — T-36-03). No `sendMessagePayload` reference exists in this file.
 */

import { useRef, useCallback, useEffect } from "react";
import { mapButtonToBackend } from "src/pages/DeviceControl/utils/mouse";
import type { CommandAction } from "src/pages/DeviceControl/types";
import type { useVirtualCursor } from "./useVirtualCursor";

// Locked threshold constants (36-UI-SPEC §D / RESEARCH Pattern 3)
// These are spec-locked and intentionally named for single-point tuning in UAT.

/** Maximum press duration (ms) for a touch to be classified as a tap. */
export const TAP_MAX_MS = 200;

/** Maximum total movement (px) for a touch to still count as a tap. */
export const TAP_MAX_MOVE_PX = 8;

/** Maximum gap between two taps for the second to be treated as a double-tap. */
export const DOUBLE_TAP_WINDOW_MS = 300;

/** Minimum hold duration (ms, with < 8px move) to enter tap-hold-drag mode. */
export const LONG_PRESS_MS = 400;

/**
 * Scroll direction sign (RESEARCH Pitfall 5 / OQ 1 — D-09 natural scroll).
 *
 * Natural scroll convention: drag fingers UP → remote content scrolls DOWN.
 * Drag up → dy is negative (clientY decreases) → negating gives positive Clicks.
 *
 * SINGLE ON-DEVICE UAT CALIBRATION POINT: if the scroll direction is inverted
 * on the real device, flip this constant between 1 and -1. Do NOT change any
 * other logic — this is the sole scroll-sign control.
 *
 * Formula: Clicks = (-dy * SCROLL_SIGN) / PIXELS_PER_NOTCH
 *   SCROLL_SIGN = 1:  drag up (dy<0) → (-(-120)*1)/120 = +1 → positive Clicks → natural scroll ✓
 *   SCROLL_SIGN = -1: drag up (dy<0) → (-(-120)*-1)/120 = -1 → inverted (non-natural)
 */
const SCROLL_SIGN = 1 as const;

/** Pixels of two-finger vertical travel per one scroll notch (Clicks unit). */
const PIXELS_PER_NOTCH = 120;

// Per-pointer tracking entry

export interface PointerEntry {
  startX: number;
  startY: number;
  startT: number;
  lastX: number;
  lastY: number;
}

// Exported pure helpers (for deterministic unit tests without hook machinery)

/**
 * Returns true if the pointer entry qualifies as a tap candidate:
 * - duration < TAP_MAX_MS
 * - total movement < TAP_MAX_MOVE_PX
 */
export function classifyTap(entry: PointerEntry, nowT: number): boolean {
  const duration = nowT - entry.startT;
  const dx = entry.lastX - entry.startX;
  const dy = entry.lastY - entry.startY;
  const totalMove = Math.sqrt(dx * dx + dy * dy);
  return duration < TAP_MAX_MS && totalMove < TAP_MAX_MOVE_PX;
}

/**
 * Convert a net vertical CSS-pixel delta from a two-finger drag into Clicks.
 *
 * Natural scroll (D-09): drag up → dy negative → positive Clicks (remote
 * content scrolls down). SCROLL_SIGN is the single calibration constant.
 *
 * Returns 0 when dy is less than one notch. Ensures at least ±1 when non-zero.
 */
export function clicksFromDelta(dy: number): number {
  if (dy === 0) return 0;
  // Negate dy (drag up → negative dy → positive) then apply SCROLL_SIGN.
  // SCROLL_SIGN=1 → natural scroll; flip to -1 on device if inverted (single calibration point).
  const raw = (-dy * SCROLL_SIGN) / PIXELS_PER_NOTCH;
  if (raw === 0) return 0;
  return Math.sign(raw) * Math.max(1, Math.round(Math.abs(raw)));
}

// Hook types

type VirtualCursorHandle = ReturnType<typeof useVirtualCursor>;

export interface TouchGesturesOptions {
  /** Permission gate — ALL envelopes flow through this (S1, T-36-03). */
  addAction: (action: CommandAction) => void;
  /** When true, no envelope is emitted and all timers are suppressed. */
  disabled: boolean;
  /**
   * Returns the video container's BoundingClientRect at call time.
   * Threaded from MainContent (S2) so the hook never needs a DOM reference.
   */
  getRect: () => DOMRect | null;
  /**
   * Returns the intrinsic video dimensions {nW, nH} at call time.
   * Threaded from MainContent (S2).
   */
  getIntrinsic: () => { nW: number; nH: number } | null;
  /**
   * The useVirtualCursor instance driving one-finger move (TOUCH-01).
   * Optional so the hook works in tests without a real cursor.
   */
  cursor?: VirtualCursorHandle;
}

export interface TouchGestureHandlers {
  onPointerDown: (e: React.PointerEvent<Element>) => void;
  onPointerMove: (e: React.PointerEvent<Element>) => void;
  onPointerUp: (e: React.PointerEvent<Element>) => void;
  onPointerCancel: (e: React.PointerEvent<Element>) => void;
}

// Internal state

/** Gesture mode for the currently active single finger. */
type SingleFingerMode =
  | "idle"
  | "tap-pending"   // down, waiting to see if it becomes a drag or tap
  | "dragging"      // movement exceeded TAP_MAX_MOVE_PX — one-finger move
  | "hold-drag";    // long-press armed → dragging with button held

// useTouchGestures hook

/**
 * useTouchGestures
 *
 * Classifies pointer events into the locked gesture map and emits the correct
 * mouse.* command envelopes through the injected `addAction` gate.
 *
 * Returns React pointer-event handlers to spread onto the gesture overlay div.
 */
export function useTouchGestures({
  addAction,
  disabled,
  getRect,
  getIntrinsic,
  cursor,
}: TouchGesturesOptions): TouchGestureHandlers {
  // Active pointer entries: Map<pointerId, PointerEntry>
  const pointersRef = useRef<Map<number, PointerEntry>>(new Map());

  // Single-finger gesture state
  const singleModeRef = useRef<SingleFingerMode>("idle");

  // Long-press timer id (setTimeout)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Double-tap tracking: timestamp of the last completed tap
  const lastTapTimeRef = useRef<number>(0);

  // Two-finger scroll: accumulated delta between rAF coalescing
  const pendingScrollDyRef = useRef<number>(0);
  const scrollRafRef = useRef<number | null>(null);

  // Two-finger scroll tracking: last centroid Y
  const twoFingerLastYRef = useRef<number | null>(null);

  // Whether the current (or most recent) interaction involved two fingers.
  // Set to true on the second pointerdown, cleared when all fingers are up.
  // Used to route the last-finger-up through the two-finger path even though
  // pointersRef.size is already 1 by then.
  const twoFingerActiveRef = useRef<boolean>(false);

  // Two-finger tap: snapshot of entries at the moment of the FIRST finger lifting,
  // so we can evaluate both when the SECOND finger lifts.
  const twoFingerFirstLiftRef = useRef<{
    entry: PointerEntry;
    nowT: number;
  } | null>(null);

  // rAF cleanup on unmount (mirrors MainContent 149-154 / S3)
  useEffect(
    () => () => {
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current);
      }
    },
    [],
  );

  // Emission helpers — all go through addAction (S1)

  const emit = useCallback(
    (action: CommandAction) => {
      if (disabled || typeof addAction !== "function") return;
      addAction(action);
    },
    [addAction, disabled],
  );

  const emitLeftDown = useCallback(
    () => emit({ type: "mouse.down", payload: { Button: mapButtonToBackend(0) } }),
    [emit],
  );

  const emitLeftUp = useCallback(
    () => emit({ type: "mouse.up", payload: { Button: mapButtonToBackend(0) } }),
    [emit],
  );

  const emitRightDown = useCallback(
    () => emit({ type: "mouse.down", payload: { Button: mapButtonToBackend(2) } }),
    [emit],
  );

  const emitRightUp = useCallback(
    () => emit({ type: "mouse.up", payload: { Button: mapButtonToBackend(2) } }),
    [emit],
  );

  // Schedule one rAF-coalesced scroll send (S3 — mirrors MainContent pendingMoveRef pattern)
  const scheduleScroll = useCallback(
    (dy: number) => {
      pendingScrollDyRef.current += dy;
      if (scrollRafRef.current == null) {
        scrollRafRef.current = requestAnimationFrame(() => {
          scrollRafRef.current = null;
          const delta = pendingScrollDyRef.current;
          pendingScrollDyRef.current = 0;
          if (delta === 0 || disabled || typeof addAction !== "function") return;
          const clicks = clicksFromDelta(delta);
          if (clicks !== 0) {
            addAction({ type: "mouse.scroll", payload: { Clicks: clicks } });
          }
        });
      }
    },
    [addAction, disabled],
  );

  // Long-press arm: fires after LONG_PRESS_MS if still 1 pointer and < 8px move

  const armLongPress = useCallback(
    (pointerId: number) => {
      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current);
      }
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        if (
          singleModeRef.current !== "tap-pending" ||
          pointersRef.current.size !== 1
        ) {
          return;
        }
        const entry = pointersRef.current.get(pointerId);
        if (!entry) return;
        const dx = entry.lastX - entry.startX;
        const dy = entry.lastY - entry.startY;
        const totalMove = Math.sqrt(dx * dx + dy * dy);
        if (totalMove >= TAP_MAX_MOVE_PX) return;

        singleModeRef.current = "hold-drag";
        emitLeftDown();

        // Tell the virtual cursor to begin from current position
        if (cursor) {
          cursor.begin(entry.lastX, entry.lastY);
        }
      }, LONG_PRESS_MS);
    },
    [cursor, emitLeftDown],
  );

  // onPointerDown

  const onPointerDown = useCallback(
    (e: React.PointerEvent<Element>) => {
      if (disabled) return;

      try {
        (e.target as Element).setPointerCapture(e.pointerId);
      } catch {
        // capture may fail in test env — not fatal
      }
      e.preventDefault?.();

      const now = Date.now();
      const entry: PointerEntry = {
        startX: e.clientX,
        startY: e.clientY,
        startT: now,
        lastX: e.clientX,
        lastY: e.clientY,
      };
      pointersRef.current.set(e.pointerId, entry);

      const count = pointersRef.current.size;

      if (count === 1) {
        if (longPressTimerRef.current != null) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        singleModeRef.current = "tap-pending";
        twoFingerActiveRef.current = false;
        twoFingerFirstLiftRef.current = null;

        if (cursor) {
          const intrinsic = getIntrinsic();
          cursor.begin(e.clientX, e.clientY, intrinsic?.nW, intrinsic?.nH);
        }
        armLongPress(e.pointerId);
      } else if (count === 2) {
        // Cancel single-finger machinery
        singleModeRef.current = "idle";
        if (longPressTimerRef.current != null) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        twoFingerFirstLiftRef.current = null;
        twoFingerActiveRef.current = true;

        // Record centroid Y for scroll tracking
        const entries = Array.from(pointersRef.current.values());
        const centroidY =
          entries.reduce((sum, en) => sum + en.lastY, 0) / entries.length;
        twoFingerLastYRef.current = centroidY;
        pendingScrollDyRef.current = 0;
      }
    },
    [disabled, cursor, getIntrinsic, armLongPress],
  );

  // onPointerMove

  const onPointerMove = useCallback(
    (e: React.PointerEvent<Element>) => {
      if (disabled) return;

      const entry = pointersRef.current.get(e.pointerId);
      if (!entry) return;

      entry.lastX = e.clientX;
      entry.lastY = e.clientY;

      const count = pointersRef.current.size;

      if (count === 1) {
        if (singleModeRef.current === "tap-pending") {
          const dx = e.clientX - entry.startX;
          const dy = e.clientY - entry.startY;
          const totalMove = Math.sqrt(dx * dx + dy * dy);
          if (totalMove >= TAP_MAX_MOVE_PX) {
            if (longPressTimerRef.current != null) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
            singleModeRef.current = "dragging";
          }
        }

        if (
          singleModeRef.current === "dragging" ||
          singleModeRef.current === "hold-drag"
        ) {
          if (cursor) {
            const rect = getRect();
            const intrinsic = getIntrinsic();
            if (rect && intrinsic) {
              cursor.move(e.clientX, e.clientY, rect, intrinsic.nW, intrinsic.nH);
            }
          }
        }
      } else if (count === 2) {
        // Two-finger scroll: compute centroid Y delta
        const entries = Array.from(pointersRef.current.values());
        const centroidY =
          entries.reduce((sum, en) => sum + en.lastY, 0) / entries.length;

        if (twoFingerLastYRef.current != null) {
          const dy = centroidY - twoFingerLastYRef.current;
          if (dy !== 0) {
            scheduleScroll(dy);
          }
        }
        twoFingerLastYRef.current = centroidY;
      }
    },
    [disabled, cursor, getRect, getIntrinsic, scheduleScroll],
  );

  // onPointerUp

  const onPointerUp = useCallback(
    (e: React.PointerEvent<Element>) => {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch {
        // not fatal
      }

      const entry = pointersRef.current.get(e.pointerId);
      const countBefore = pointersRef.current.size;
      pointersRef.current.delete(e.pointerId);

      if (!entry) return;

      // Cancel long-press timer
      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const now = Date.now();

      if (twoFingerActiveRef.current) {
        // Two-finger interaction (first or second finger lifting)
        const remainingAfter = pointersRef.current.size;

        if (remainingAfter === 1) {
          // First of the two fingers lifted — store snapshot
          if (!disabled) {
            twoFingerFirstLiftRef.current = { entry, nowT: now };
          }
        } else {
          // Last finger of the two-finger interaction lifted
          twoFingerActiveRef.current = false;
          twoFingerLastYRef.current = null;

          if (!disabled) {
            const firstLift = twoFingerFirstLiftRef.current;
            twoFingerFirstLiftRef.current = null;

            if (
              firstLift &&
              classifyTap(entry, now) &&
              classifyTap(firstLift.entry, firstLift.nowT)
            ) {
              // Both fingers lifted quickly with small movement → right click
              emitRightDown();
              emitRightUp();
            }
            // else: two-finger scroll, no tap action
          }
        }
      } else if (countBefore === 1) {
        // Single-finger lift
        const mode = singleModeRef.current;
        singleModeRef.current = "idle";

        if (cursor) cursor.end();

        if (disabled) return;

        if (mode === "hold-drag") {
          emitLeftUp();
        } else if (mode === "tap-pending") {
          if (classifyTap(entry, now)) {
            const timeSinceLastTap = now - lastTapTimeRef.current;

            // Every tap emits exactly one down/up pair (including each of a double-tap).
            // Double-tap = two qualifying taps within DOUBLE_TAP_WINDOW_MS → 4 calls total.
            // Track last tap time: reset to 0 on the second of a pair so a third
            // tap won't be counted as a double again.
            if (timeSinceLastTap < DOUBLE_TAP_WINDOW_MS) {
              lastTapTimeRef.current = 0; // consumed the double-tap pair
            } else {
              lastTapTimeRef.current = now; // record for potential second tap
            }

            emitLeftDown();
            emitLeftUp();
          }
        }
        // mode === "dragging": no tap action
      }
    },
    [
      disabled,
      cursor,
      emitLeftDown,
      emitLeftUp,
      emitRightDown,
      emitRightUp,
    ],
  );

  // onPointerCancel

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<Element>) => {
      const countBefore = pointersRef.current.size;
      pointersRef.current.delete(e.pointerId);

      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (!disabled && countBefore === 1 && singleModeRef.current === "hold-drag") {
        emitLeftUp();
      }

      if (cursor) cursor.end();

      singleModeRef.current = "idle";
      twoFingerActiveRef.current = false;
      twoFingerFirstLiftRef.current = null;
      twoFingerLastYRef.current = null;
    },
    [disabled, cursor, emitLeftUp],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
