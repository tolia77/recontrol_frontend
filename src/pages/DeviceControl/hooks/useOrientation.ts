import { useState, useEffect } from "react";

const LANDSCAPE_QUERY = "(orientation: landscape)";

/**
 * Returns `true` when the viewport is in landscape orientation.
 *
 * Driven off `matchMedia('(orientation: landscape)')` — NOT Tailwind
 * `md:`/`lg:`/`touch-screen:` width breakpoints, which desync from true
 * orientation on landscape phones (a narrow landscape phone can stay below the
 * `md:` width and report the wrong layout).
 *
 * Used by DeviceControlBottomSheet to switch between half-height (portrait)
 * and full-screen (landscape).
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
