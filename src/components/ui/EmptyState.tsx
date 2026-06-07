import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

function EmptyState({
  title,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-8 text-center ${className}`}
    >
      {icon}
      <p className="text-muted-foreground text-body">{title}</p>
      {action}
    </div>
  );
}

export default EmptyState;
