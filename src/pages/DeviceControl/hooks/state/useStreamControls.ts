import { useMemo, useState } from "react";
import type { ScalingMode } from "src/pages/DeviceControl/types";

export interface UseStreamControlsReturn {
  showStats: boolean;
  setShowStats: (v: boolean) => void;
  scalingMode: ScalingMode;
  setScalingMode: (v: ScalingMode) => void;
  currentFps: number;
  setCurrentFps: (v: number) => void;
  currentResolution: number;
  setCurrentResolution: (v: number) => void;
}

/**
 * Owns stream display controls: stats overlay visibility, video scaling mode
 * (fit / 1:1), FPS, and resolution.
 *
 * State-only: handleFpsChange / handleResolutionChange live in DeviceControl
 * where they compose setCurrentFps/setCurrentResolution with sendSingleAction.
 */
export function useStreamControls(): UseStreamControlsReturn {
  const [showStats, setShowStats] = useState(false);
  const [scalingMode, setScalingMode] = useState<ScalingMode>("fit");
  const [currentFps, setCurrentFps] = useState(24);
  const [currentResolution, setCurrentResolution] = useState(1080);

  return useMemo(
    () => ({
      showStats,
      setShowStats,
      scalingMode,
      setScalingMode,
      currentFps,
      setCurrentFps,
      currentResolution,
      setCurrentResolution,
    }),
    [showStats, scalingMode, currentFps, currentResolution],
  );
}
