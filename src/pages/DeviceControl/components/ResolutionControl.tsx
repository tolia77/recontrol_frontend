const RESOLUTION_OPTIONS = [
    { value: 1080, label: '1080p' },
    { value: 720, label: '720p' },
    { value: 480, label: '480p' },
] as const;

interface ResolutionControlProps {
    currentResolution: number;
    onResolutionChange: (resolution: number) => void;
    disabled?: boolean;
}

export function ResolutionControl({ currentResolution, onResolutionChange, disabled }: ResolutionControlProps) {
    return (
        <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 mr-1 font-medium">Res</span>
            <select
                value={currentResolution}
                onChange={(e) => onResolutionChange(Number(e.target.value))}
                disabled={disabled}
                className="bg-white/10 text-gray-300 text-xs font-medium rounded px-2 py-0.5
                           border-none outline-none cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {RESOLUTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}
