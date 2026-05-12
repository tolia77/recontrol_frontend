import type { FC } from 'react';

// Hand-rolled to match the project convention (no `lucide-react`); color comes
// from the caller's `text-*` Tailwind class which drives `stroke="currentColor"`.
// Mirrors recontrol_frontend/src/pages/DeviceControl/components/FileManager/icons.tsx.

export interface IconProps {
  className?: string;
}

/**
 * Sidebar toggle icon for the AssistantPanel (chat bubble shape).
 * Used in Sidebar.tsx; sibling of FilesToggleIcon.
 */
export const AssistantToggleIcon: FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 10h.01" />
    <path d="M12 10h.01" />
    <path d="M16 10h.01" />
  </svg>
);

/**
 * Warning triangle icon for ConfirmationCard zone-tinted accent (D-04).
 * Rendered alongside the zone badge in the confirmation card body.
 */
export const WarningTriangleIcon: FC<IconProps> = ({ className = 'w-4 h-4' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);
