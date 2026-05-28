import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:opacity-90 disabled:opacity-50",
  secondary:
    "bg-background text-primary border border-lightgray hover:bg-tertiary disabled:opacity-50",
  danger: "bg-error text-white hover:opacity-90 disabled:opacity-50",
  ghost: "bg-transparent text-primary hover:bg-tertiary disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm min-h-[32px]",
  md: "px-4 py-2 text-sm min-h-[40px]",
  lg: "px-6 py-3 text-base min-h-[48px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      icon,
      children,
      className = "",
      disabled,
      ...props
    },
    ref,
  ) => {
    const baseClasses =
      "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/20";

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {!loading && icon}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
