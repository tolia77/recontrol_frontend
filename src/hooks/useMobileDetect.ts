import { useState, useEffect } from 'react';

// Detect "phone" as a coarse pointer whose SHORT edge is <= 767px, so the
// mobile path holds in BOTH orientations. A width-only test
// (`max-width: 767px`) silently dropped landscape phones (long edge > 767px)
// back to the desktop layout. The comma is media-query OR: the width clause
// matches in portrait, the height clause matches in landscape. `pointer:
// coarse` keeps narrowed desktop windows (fine pointer) on the desktop layout
// (D-03), and the 767px short-edge line still excludes tablets (iPad short
// edge >= 768px stays on the existing wide layout).
const MOBILE_QUERY =
  '(pointer: coarse) and (max-width: 767px), (pointer: coarse) and (max-height: 767px)';

export function useMobileDetect(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
