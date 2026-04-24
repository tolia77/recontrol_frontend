import { Fragment } from 'react';
import { ChevronRightIcon } from './icons';
import { detectSeparator, joinPath, splitIntoSegments } from './utils/pathUtils';

interface FileManagerBreadcrumbProps {
  currentPath: string | null;
  rootPath: string | null;
  onNavigate: (path: string) => void;
}

/**
 * Click-to-navigate breadcrumb. Renders nothing when `currentPath` is null
 * (the sidebar root selection is how the user first populates the path).
 *
 * Each segment is a button that navigates to the joined prefix. The final
 * segment is rendered as plain text (you're already there). The separator
 * is detected from the root path so Windows paths render with backslashes
 * and POSIX paths render with slashes.
 */
export function FileManagerBreadcrumb({
  currentPath,
  rootPath,
  onNavigate,
}: FileManagerBreadcrumbProps) {
  if (!currentPath) {
    return (
      <nav
        aria-label="breadcrumb"
        className="px-3 py-2 border-b border-lightgray text-sm text-darkgray bg-background flex-shrink-0 min-h-[36px]"
      >
        Select a folder from the sidebar to start browsing.
      </nav>
    );
  }

  const sep = detectSeparator(rootPath ?? currentPath);
  const segments = splitIntoSegments(currentPath, sep);
  const isPosixAbsolute = sep === '/' && currentPath.startsWith('/');

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-1 px-3 py-2 border-b border-lightgray text-sm bg-background flex-shrink-0 min-h-[36px] overflow-x-auto"
    >
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        // Join everything up to and including this segment. On POSIX, prepend
        // an empty segment so joinPath preserves the leading `/`.
        const partsThroughHere = segments.slice(0, i + 1);
        const fullPrefix = isPosixAbsolute
          ? joinPath(['', ...partsThroughHere], sep)
          : joinPath(partsThroughHere, sep);

        return (
          <Fragment key={`${fullPrefix}-${i}`}>
            {i > 0 && (
              <ChevronRightIcon className="w-3 h-3 text-darkgray flex-shrink-0" />
            )}
            {isLast ? (
              <span className="font-medium text-text whitespace-nowrap">
                {seg}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(fullPrefix)}
                className="whitespace-nowrap hover:text-primary hover:underline cursor-pointer"
                title={fullPrefix}
              >
                {seg}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
