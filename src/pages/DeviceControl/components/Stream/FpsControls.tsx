const FPS_OPTIONS = [15, 24, 30] as const;

interface FpsControlsProps {
  currentFps: number;
  onFpsChange: (fps: number) => void;
  disabled?: boolean;
}

function FpsControls({
  currentFps,
  onFpsChange,
  disabled,
}: FpsControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-caption font-medium text-[#9ca3af]">FPS</span>
      {FPS_OPTIONS.map((fps) => (
        <button
          key={fps}
          onClick={() => onFpsChange(fps)}
          disabled={disabled}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            currentFps === fps
              ? "bg-primary text-white"
              : "bg-white/10 text-[#d1d5db] hover:bg-white/20"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {fps}
        </button>
      ))}
    </div>
  );
}

export default FpsControls;
