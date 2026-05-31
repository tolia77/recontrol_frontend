import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-text text-sm font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors ${
            error
              ? "border-error focus:border-error focus:ring-error/20 focus:ring-2"
              : "border-lightgray focus:border-primary focus:ring-primary/20 focus:ring-2"
          } outline-none disabled:cursor-not-allowed disabled:bg-gray-50 ${className}`}
          {...props}
        />
        {hint && !error && (
          <span className="text-xs text-gray-500">{hint}</span>
        )}
        {error && <span className="text-error text-xs">{error}</span>}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
