const FPS_OPTIONS = [15, 24, 30] as const;

interface FpsControlsProps {
    currentFps: number;
    onFpsChange: (fps: number) => void;
    disabled?: boolean;
}

export function FpsControls({ currentFps, onFpsChange, disabled }: FpsControlsProps) {
    return (
        <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 mr-1 font-medium">FPS</span>
            {FPS_OPTIONS.map((fps) => (
                <button
                    key={fps}
                    onClick={() => onFpsChange(fps)}
                    disabled={disabled}
                    className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        currentFps === fps
                            ? 'bg-indigo-500 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {fps}
                </button>
            ))}
        </div>
    );
}
