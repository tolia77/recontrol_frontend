import { forwardRef, type InputHTMLAttributes } from "react";

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = "", id, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-foreground text-body font-medium">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full rounded-sm border px-3 py-2 text-body transition-colors ${
            error
              ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20 focus-visible:ring-2"
              : "border-border focus-visible:border-primary focus-visible:ring-primary/30 focus-visible:ring-2"
          } outline-none disabled:cursor-not-allowed disabled:bg-surface-muted ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-destructive text-caption">{error}</span>}
      </div>
    );
  },
);

Select.displayName = "Select";

export default Select;
