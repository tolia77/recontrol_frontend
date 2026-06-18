import type { KeyboardEvent } from "react";

/**
 * SegmentedControl — generic pill-group view-switcher primitive.
 *
 * Renders a horizontal row of pills inside a `role="tablist"` container.
 * Exactly one pill is active at a time; click / Enter / Space all fire
 * `onChange(option.value)`. Parents own state and decide whether to dedupe
 * same-value clicks.
 *
 * sessionStorage persistence is the consumer's responsibility — the panel
 * that mounts this primitive owns the storage key.
 */
export interface SegmentedControlOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentedControlOption<T>>;
  onChange: (next: T) => void;
  "data-testid"?: string;
  className?: string;
  ariaLabel?: string;
}

const CONTAINER_CLASS = "flex bg-surface-muted rounded-md p-1 gap-1";
const PILL_BASE_CLASS =
  "px-3 py-2 text-body font-medium rounded-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";
const PILL_ACTIVE_CLASS = "bg-success text-white";
const PILL_INACTIVE_CLASS = "bg-transparent text-primary hover:bg-surface-muted";

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = "",
  ariaLabel,
  ...rest
}: SegmentedControlProps<T>) {
  const rootTestId = rest["data-testid"];

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    optionValue: T,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      // Space scrolls by default; prevent that for keyboard activation.
      e.preventDefault();
      onChange(optionValue);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      data-testid={rootTestId}
      className={`${CONTAINER_CLASS} ${className}`.trim()}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={
              rootTestId ? `${rootTestId}-${option.value}` : undefined
            }
            className={`${PILL_BASE_CLASS} ${isActive ? PILL_ACTIVE_CLASS : PILL_INACTIVE_CLASS}`}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
