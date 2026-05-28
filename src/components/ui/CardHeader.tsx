import type { ReactNode } from "react";

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between">
      <div>
        <h2 className="text-text text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-darkgray mt-0.5 text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default CardHeader;
