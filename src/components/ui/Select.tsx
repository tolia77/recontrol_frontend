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
          <label htmlFor={selectId} className="text-text text-sm font-medium">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors ${
            error
              ? "border-error focus:border-error"
              : "border-lightgray focus:border-primary"
          } outline-none disabled:cursor-not-allowed disabled:bg-gray-50 ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-error text-xs">{error}</span>}
      </div>
    );
  },
);

Select.displayName = "Select";

export default Select;
