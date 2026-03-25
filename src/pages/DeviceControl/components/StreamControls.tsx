import { useState, useCallback } from 'react';
import type { CommandAction, ScalingMode } from '../types';
import { generateUUID } from 'src/utils/uuid';

export type ResolutionPreset = 'native' | '1080p' | '720p' | '480p';

const RESOLUTION_OPTIONS: { value: ResolutionPreset; label: string }[] = [
  { value: 'native', label: 'Native' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
];

interface StreamControlsProps {
  addAction: (action: CommandAction) => void;
  scalingMode: ScalingMode;
  onScalingModeChange: (mode: ScalingMode) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  disabled?: boolean;
}

export function StreamControls({
  addAction,
  scalingMode,
  onScalingModeChange,
  containerRef,
  disabled,
}: StreamControlsProps) {
  const [resolution, setResolution] = useState<ResolutionPreset>('native');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleResolutionChange = useCallback((preset: ResolutionPreset) => {
    setResolution(preset);
    addAction({
      id: generateUUID(),
      type: 'webrtc.set_resolution',
      payload: { preset },
    });
  }, [addAction]);

  const toggleScaling = useCallback(() => {
    onScalingModeChange(scalingMode === 'fit' ? '1:1' : 'fit');
  }, [scalingMode, onScalingModeChange]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  }, [containerRef]);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg">
      {/* Resolution selector */}
      <div className="flex items-center gap-1">
        {RESOLUTION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleResolutionChange(opt.value)}
            disabled={disabled}
            className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
              resolution === opt.value
                ? 'bg-indigo-500 text-white'
                : 'text-gray-300 hover:text-white hover:bg-white/10'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-white/20" />

      {/* Scaling toggle */}
      <button
        onClick={toggleScaling}
        disabled={disabled}
        className="px-2 py-0.5 text-xs rounded font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={scalingMode === 'fit' ? 'Switch to 1:1 native pixels' : 'Switch to fit-to-window'}
      >
        {scalingMode === 'fit' ? 'Fit' : '1:1'}
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-white/20" />

      {/* Fullscreen toggle */}
      <button
        onClick={toggleFullscreen}
        disabled={disabled}
        className="px-2 py-0.5 text-xs rounded font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {isFullscreen ? (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </>
          ) : (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
