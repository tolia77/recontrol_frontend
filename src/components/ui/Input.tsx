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
          <label htmlFor={inputId} className="text-foreground text-body font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-sm border px-3 py-2 text-body transition-colors ${
            error
              ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20 focus-visible:ring-2"
              : "border-border focus-visible:border-primary focus-visible:ring-primary/30 focus-visible:ring-2"
          } outline-none disabled:cursor-not-allowed disabled:bg-surface-muted ${className}`}
          {...props}
        />
        {hint && !error && (
          <span className="text-caption text-muted-foreground">{hint}</span>
        )}
        {error && <span className="text-destructive text-caption">{error}</span>}
      </div>
    );
  },
);

Input.displayName = "Input";

export default Input;
