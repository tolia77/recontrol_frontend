import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional right-aligned content (action buttons, status text). */
  actions?: ReactNode;
}

/**
 * Standard page header for sidebar-tab pages. Keeps the title size, weight,
 * and position consistent as the user navigates between tabs. Pair with a page
 * container of `p-4 md:p-6` so the header also sits in a consistent position.
 */
function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-foreground text-title font-bold">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1 text-body">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export default PageHeader;
