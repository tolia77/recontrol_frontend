const RESOLUTION_OPTIONS = [
  { value: 1080, label: "1080p" },
  { value: 720, label: "720p" },
  { value: 480, label: "480p" },
] as const;

interface ResolutionControlProps {
  currentResolution: number;
  onResolutionChange: (resolution: number) => void;
  disabled?: boolean;
}

function ResolutionControl({
  currentResolution,
  onResolutionChange,
  disabled,
}: ResolutionControlProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-xs font-medium text-gray-400">Res</span>
      <select
        value={currentResolution}
        onChange={(e) => onResolutionChange(Number(e.target.value))}
        disabled={disabled}
        className="cursor-pointer rounded border-none bg-white/10 px-2 py-0.5 text-xs font-medium text-gray-300 outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {RESOLUTION_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ResolutionControl;
