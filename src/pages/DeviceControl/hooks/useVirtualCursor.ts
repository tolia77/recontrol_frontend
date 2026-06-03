import { useRef, useEffect } from "react";
import type { CommandAction } from "src/pages/DeviceControl/types";

export interface VirtualCursorOptions {
  addAction: (action: CommandAction) => void;
  disabled: boolean;
}

/** Clamp v to the inclusive range [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Pure helper: given a current accumulated position, a previous pointer client
 * position, and new pointer client coordinates, compute the next accumulated
 * position (clamped to [0,nW]×[0,nH]) and the new prev value.
 *
 * The delta in CSS pixels is scaled to intrinsic remote pixels by reusing the
 * same factor that computeRealImageCoords uses:
 *   scale = Math.min(rect.width / nW, rect.height / nH)
 *
 * Exported so it can be unit-tested independently of the React hook.
 */
export function accumulate(
  pos: { x: number; y: number },
  prev: { x: number; y: number },
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, "width" | "height">,
  nW: number,
  nH: number,
): { nextPos: { x: number; y: number }; nextPrev: { x: number; y: number } } {
  const scale = Math.min(rect.width / nW, rect.height / nH);
  const dx = clientX - prev.x;
  const dy = clientY - prev.y;
  return {
    nextPos: {
      x: clamp(pos.x + dx * scale, 0, nW),
      y: clamp(pos.y + dy * scale, 0, nH),
    },
    nextPrev: { x: clientX, y: clientY },
  };
}

/**
 * useVirtualCursor
 *
 * Translates one-finger pointer deltas into a clamped absolute remote cursor
 * position and emits rAF-coalesced mouse.move actions through the injected
 * addAction (which enforces the canSend permission gate).
 *
 * The cursor starts at the remote screen center ({nW/2, nH/2}) and accumulates
 * finger deltas scaled by Math.min(rect.width/nW, rect.height/nH) — the same
 * factor used by computeRealImageCoords — so 1 CSS px of finger travel maps
 * exactly to 1 intrinsic remote pixel.
 *
 * Usage:
 *   const cursor = useVirtualCursor({ addAction, disabled });
 *   cursor.begin(e.clientX, e.clientY);      // on pointerdown
 *   cursor.move(e.clientX, e.clientY, rect, nW, nH);  // on pointermove
 *   cursor.end();                            // on pointerup / pointercancel
 *   cursor.getPos();                         // read current absolute position
 */
export function useVirtualCursor({ addAction, disabled }: VirtualCursorOptions) {
  // Accumulated absolute position in intrinsic remote pixels.
  // Initialized lazily to {nW/2, nH/2} on first begin() call or can be reset.
  const posRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Previous pointer client position (null when finger is not down).
  const prevRef = useRef<{ x: number; y: number } | null>(null);

  // rAF coalescing mirrors MainContent's pendingMoveRef/moveRafRef pattern.
  const pendingMoveRef = useRef<{ x: number; y: number } | null>(null);
  const moveRafRef = useRef<number | null>(null);

  // Track whether pos has been seeded (so we can init to center on first begin).
  const seededRef = useRef(false);

  // Cancel any pending rAF on unmount (mirrors MainContent lines 149-154).
  useEffect(
    () => () => {
      if (moveRafRef.current != null) {
        cancelAnimationFrame(moveRafRef.current);
      }
    },
    [],
  );

  /** Call on pointerdown: set the starting reference point. */
  function begin(clientX: number, clientY: number, nW?: number, nH?: number): void {
    if (!seededRef.current && nW != null && nH != null) {
      posRef.current = { x: nW / 2, y: nH / 2 };
      seededRef.current = true;
    }
    prevRef.current = { x: clientX, y: clientY };
  }

  /**
   * Call on pointermove: compute delta, accumulate into pos, clamp,
   * then schedule one rAF-coalesced mouse.move per animation frame.
   */
  function move(
    clientX: number,
    clientY: number,
    rect: Pick<DOMRect, "width" | "height">,
    nW: number,
    nH: number,
  ): void {
    if (!prevRef.current) return;
    const { nextPos, nextPrev } = accumulate(
      posRef.current,
      prevRef.current,
      clientX,
      clientY,
      rect,
      nW,
      nH,
    );
    posRef.current = nextPos;
    prevRef.current = nextPrev;

    // Schedule one rAF-coalesced send (identical pattern to MainContent 122-139).
    pendingMoveRef.current = { x: Math.round(nextPos.x), y: Math.round(nextPos.y) };
    if (moveRafRef.current == null) {
      moveRafRef.current = requestAnimationFrame(() => {
        moveRafRef.current = null;
        const p = pendingMoveRef.current;
        pendingMoveRef.current = null;
        if (p && !disabled) {
          addAction({ type: "mouse.move", payload: { X: p.x, Y: p.y } });
        }
      });
    }
  }

  /** Call on pointerup / pointercancel: clear the reference point. */
  function end(): void {
    prevRef.current = null;
  }

  /** Read the current accumulated position (used by VirtualCursorOverlay). */
  function getPos(): { x: number; y: number } {
    return posRef.current;
  }

  /**
   * Reset the cursor to remote center. Call when the remote dimensions change
   * or when reconnecting.
   */
  function reset(nW: number, nH: number): void {
    posRef.current = { x: nW / 2, y: nH / 2 };
    seededRef.current = true;
    prevRef.current = null;
  }

  return { begin, move, end, getPos, reset };
}
