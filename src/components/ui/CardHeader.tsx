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
        <h2 className="text-foreground text-heading font-semibold">{title}</h2>
        {subtitle && <p className="text-muted-foreground mt-0.5 text-body">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export default CardHeader;
