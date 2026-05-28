import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRightIcon } from "./icons";
import {
  detectSeparator,
  joinPath,
  splitIntoSegments,
} from "./utils/pathUtils";

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
function FileManagerBreadcrumb({
  currentPath,
  rootPath,
  onNavigate,
}: FileManagerBreadcrumbProps) {
  const { t } = useTranslation("fileManager");
  if (!currentPath) {
    return (
      <nav
        aria-label={t("breadcrumb.ariaLabel")}
        className="border-lightgray text-darkgray bg-background min-h-[36px] flex-shrink-0 border-b px-3 py-2 text-sm"
      >
        {t("breadcrumb.selectFolderPrompt")}
      </nav>
    );
  }

  const sep = detectSeparator(rootPath ?? currentPath);
  const segments = splitIntoSegments(currentPath, sep);
  const isPosixAbsolute = sep === "/" && currentPath.startsWith("/");

  return (
    <nav
      aria-label={t("breadcrumb.ariaLabel")}
      className="border-lightgray bg-background flex min-h-[36px] flex-shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-2 text-sm"
    >
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        // Join everything up to and including this segment. On POSIX, prepend
        // an empty segment so joinPath preserves the leading `/`.
        const partsThroughHere = segments.slice(0, i + 1);
        const fullPrefix = isPosixAbsolute
          ? joinPath(["", ...partsThroughHere], sep)
          : joinPath(partsThroughHere, sep);

        return (
          <Fragment key={`${fullPrefix}-${i}`}>
            {i > 0 && (
              <ChevronRightIcon className="text-darkgray h-3 w-3 flex-shrink-0" />
            )}
            {isLast ? (
              <span className="text-text font-medium whitespace-nowrap">
                {seg}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(fullPrefix)}
                className="hover:text-primary cursor-pointer whitespace-nowrap hover:underline"
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

export default FileManagerBreadcrumb;
