import { useMemo, useState } from "react";

export interface UseStreamControlsReturn {
  showStats: boolean;
  setShowStats: (v: boolean) => void;
  currentFps: number;
  setCurrentFps: (v: number) => void;
  currentResolution: number;
  setCurrentResolution: (v: number) => void;
}

/**
 * Owns stream display controls: stats overlay visibility, FPS, and resolution.
 *
 * Per D-01: feature sub-hook extracted from DeviceControl's inline state.
 * Per D-02: plain useState (transitions are independent).
 * Per OQ-2 Option A: handleFpsChange / handleResolutionChange stay in
 * DeviceControl where they compose setCurrentFps/setCurrentResolution with
 * sendSingleAction. This hook is state-only.
 */
export function useStreamControls(): UseStreamControlsReturn {
  const [showStats, setShowStats] = useState(false);
  const [currentFps, setCurrentFps] = useState(24);
  const [currentResolution, setCurrentResolution] = useState(1080);

  return useMemo(
    () => ({
      showStats,
      setShowStats,
      currentFps,
      setCurrentFps,
      currentResolution,
      setCurrentResolution,
    }),
    [showStats, currentFps, currentResolution],
  );
}
