import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || props.name;
    
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors
            ${error 
              ? 'border-error focus:border-error focus:ring-2 focus:ring-error/20' 
              : 'border-lightgray focus:border-primary focus:ring-2 focus:ring-primary/20'
            }
            outline-none disabled:bg-gray-50 disabled:cursor-not-allowed
            ${className}`}
          {...props}
        />
        {hint && !error && (
          <span className="text-xs text-gray-500">{hint}</span>
        )}
        {error && (
          <span className="text-xs text-error">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', id, ...props }, ref) => {
    const selectId = id || props.name;
    
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-text">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors
            ${error 
              ? 'border-error focus:border-error' 
              : 'border-lightgray focus:border-primary'
            }
            outline-none disabled:bg-gray-50 disabled:cursor-not-allowed
            ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="text-xs text-error">{error}</span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Input;

