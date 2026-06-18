/**
 * VirtualCursorOverlay.tsx
 *
 * Local virtual cursor dot for touch remote control.
 *
 * A lightweight 16×16 circle that tracks one-finger deltas instantly via
 * direct DOM style mutation — NO React state for x/y position, so there is
 * zero re-render latency per pointermove.
 *
 * The parent (or the useVirtualCursor hook) positions the cursor by writing:
 *   element.style.transform = `translate(${cssX}px, ${cssY}px) translate(-50%, -50%)`
 *
 * Opacity starts at 0 and is flipped to 1 on first touch by the caller setting
 * `element.style.opacity = "1"` imperatively, keeping the same no-re-render
 * philosophy.
 */

import React from "react";

export interface Props {
  /**
   * Ref the caller (useVirtualCursor) uses to mutate the
   * cursor element's `style.transform` and `style.opacity` directly.
   * No React state is involved for positioning — direct DOM mutation only.
   */
  cursorRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * VirtualCursorOverlay
 *
 * Renders a non-interactive cursor dot positioned absolutely inside the stream
 * container. Position is driven imperatively via `cursorRef` — no useState.
 */
export default function VirtualCursorOverlay({ cursorRef }: Props) {
  return (
    <div
      ref={cursorRef}
      className="pointer-events-none absolute z-20 h-4 w-4 rounded-full bg-white/70 border border-primary/40 shadow-sm"
      style={{
        // Invisible until first touch (caller sets opacity:1 imperatively)
        opacity: 0,
        // Initial transform anchors to top-left; caller overwrites with
        // `translate(${x}px, ${y}px) translate(-50%, -50%)` on every move.
        transform: "translate(0px, 0px) translate(-50%, -50%)",
      }}
      aria-hidden="true"
    />
  );
}
