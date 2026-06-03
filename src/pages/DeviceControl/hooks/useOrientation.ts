import { useState, useEffect } from "react";

const LANDSCAPE_QUERY = "(orientation: landscape)";

/**
 * Returns `true` when the viewport is in landscape orientation.
 *
 * Driven off `matchMedia('(orientation: landscape)')` — NOT Tailwind
 * `md:`/`lg:`/`touch-screen:` breakpoints (those desync in landscape on phones;
 * see MEMORY: landscape-md-breakpoint-desync and Phase 35 35-06).
 *
 * Used by DeviceControlBottomSheet to switch between half-height (portrait)
 * and full-screen (landscape) — D-05.
 */
export function useOrientation(): { isLandscape: boolean } {
  const [isLandscape, setIsLandscape] = useState(
    () => window.matchMedia(LANDSCAPE_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(LANDSCAPE_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return { isLandscape };
}
