import React from "react";
import type { IconProps } from "src/pages/DeviceControl/types";

/**
 * Back Arrow Icon (ChevronLeft)
 */
export const ChevronLeftIcon: React.FC<IconProps> = ({
  className = "w-6 h-6",
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m15 18-6-6 6-6" />
  </svg>
);

/**
 * Accordion Arrow Icon (ChevronDown)
 */
export const ChevronDownIcon: React.FC<IconProps> = ({
  className = "w-5 h-5",
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/**
 * Refresh Icon (Rotate)
 */
export const RefreshIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v6h-6" />
  </svg>
);

/**
 * Close Icon (X)
 */
export const CloseIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

/**
 * Power Icon — TopBar system zone trigger (opens PowerPopover).
 */
export const PowerIcon: React.FC<IconProps> = ({ className = "w-5 h-5" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2v10" />
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
  </svg>
);

/**
 * Stop Icon (rounded square) — leads the "Stop Screen Stream" button in the TopBar.
 */
export const StopIcon: React.FC<IconProps> = ({ className = "w-4 h-4" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

/**
 * Scenarios Icon (clipboard with checklist) — sidebar third toggle (Phase 21, UI-01).
 * Sibling of FilesToggleIcon / AssistantToggleIcon, but lives in the top-level
 * DeviceControl icon module so the Scenarios feature module can stay isolated.
 */
export const ScenariosIcon: React.FC<IconProps> = ({
  className = "w-4 h-4",
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="4.5" y="3.5" width="11" height="13" rx="1.5" />
    <path d="M7.5 3.5v-1h5v1" />
    <path d="M7 8h6M7 11h6M7 14h3" />
  </svg>
);
