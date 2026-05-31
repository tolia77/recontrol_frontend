import type { ReactNode } from "react";

interface BannerProps {
  variant: "warning" | "error";
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

const variantClasses: Record<BannerProps["variant"], string> = {
  error: "bg-error/10 border-l-4 border-error text-error",
  warning: "bg-amber/10 border-l-4 border-amber text-amber",
};

function Banner({ variant, children, action, className = "" }: BannerProps) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between py-3 px-4 ${variantClasses[variant]} ${className}`}
    >
      <span>{children}</span>
      {action && <span className="ml-4 shrink-0">{action}</span>}
    </div>
  );
}

export default Banner;
