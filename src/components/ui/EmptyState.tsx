import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, icon, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-8 gap-3 text-center ${className}`}
    >
      {icon}
      <p className="text-sm text-darkgray">{title}</p>
      {action}
    </div>
  );
}
