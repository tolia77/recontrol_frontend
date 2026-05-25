import { useCallback, useEffect, useRef, useState } from 'react';

interface SplitterProps {
  /** 0..1 initial width ratio for the left pane. */
  initialRatio: number;
  /** Called once on pointer-up with the final ratio. */
  onRatioChange: (ratio: number) => void;
  left: React.ReactNode;
  /**
   * Right pane content, or null/undefined to collapse the right pane. When
   * absent the left pane fills the full width and the divider is hidden.
   * Callers keep routing the same `left` subtree through this component
   * regardless of whether a panel is open so the left pane's DOM (e.g. a live
   * <video> element) keeps a stable tree position and is never remounted.
   */
  right: React.ReactNode;
}

/**
 * Vertical two-pane splitter with a drag-to-resize divider. The ratio is
 * clamped to [0.1, 0.9] during drag and persisted on pointer-up (not on every
 * frame) so callers don't thrash localStorage. Internal `ratio` state tracks
 * the visual during-drag value; on pointer-up we hand the final value to the
 * parent, which may re-render with the stored ratio.
 *
 * When `right` is null/undefined the left pane spans the full width and the
 * divider + right pane are omitted. The left pane stays the container's first
 * child in both layouts, so toggling the right pane does not remount `left`.
 */
export function Splitter({ initialRatio, onRatioChange, left, right }: SplitterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<number>(() => clamp(initialRatio));
  const draggingRef = useRef(false);

  // Re-sync internal state if the parent's initialRatio changes (e.g., another
  // setter wrote to localStorage on reload).
  useEffect(() => {
    setRatio(clamp(initialRatio));
  }, [initialRatio]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // pointer capture may fail in some environments; not fatal
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = clamp((e.clientX - rect.left) / rect.width);
    setRatio(next);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // no-op
      }
      onRatioChange(ratio);
    },
    [onRatioChange, ratio],
  );

  const hasRight = right != null;

  return (
    <div ref={containerRef} className="flex h-full w-full">
      <div
        style={{ width: hasRight ? `${ratio * 100}%` : '100%' }}
        className="h-full min-w-0 overflow-hidden"
      >
        {left}
      </div>
      {hasRight && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="w-1 bg-lightgray hover:bg-primary cursor-col-resize transition-colors flex-shrink-0"
          />
          <div style={{ width: `${(1 - ratio) * 100}%` }} className="h-full min-w-0 overflow-hidden">
            {right}
          </div>
        </>
      )}
    </div>
  );
}

function clamp(r: number): number {
  if (!Number.isFinite(r)) return 0.5;
  return Math.min(0.9, Math.max(0.1, r));
}
