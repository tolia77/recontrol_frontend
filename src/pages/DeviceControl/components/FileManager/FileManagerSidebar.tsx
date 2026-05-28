import type { FileEntry } from "src/pages/DeviceControl/services/files";
import { LockIcon, FolderIcon } from "./icons";
import { isAncestor } from "./utils/pathUtils";
import { useTranslation } from "react-i18next";
import { ErrorState } from "src/components/ui";

interface FileManagerSidebarProps {
  roots: FileEntry[] | null;
  isLoading: boolean;
  error: string | null;
  currentPath: string | null;
  onSelectRoot: (path: string) => void;
}

/**
 * Left sidebar showing allowlisted roots. Phase-10 minimum: no tree
 * expansion (clicking a root opens it in the listing). Tree expansion is
 * noted as a follow-up (Research Pitfall 6) and can ship later without
 * changing this signature.
 */
function FileManagerSidebar({
  roots,
  isLoading,
  error,
  currentPath,
  onSelectRoot,
}: FileManagerSidebarProps) {
  const { t } = useTranslation("fileManager");
  return (
    <aside className="border-lightgray bg-background w-60 flex-shrink-0 overflow-y-auto border-r">
      <div className="border-lightgray border-b px-3 py-2">
        <span className="text-darkgray text-xs font-bold tracking-wide uppercase">
          {t("sidebar.sharedFolders")}
        </span>
      </div>

      {isLoading && (
        <div className="space-y-2 p-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-lightgray/60 h-8 animate-pulse rounded"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {error && !isLoading && <ErrorState message={error} />}

      {!isLoading && !error && roots && roots.length > 0 && (
        <ul className="py-1">
          {roots.map((root) => {
            const active =
              currentPath !== null &&
              (currentPath === root.path || isAncestor(root.path, currentPath));
            return (
              <li key={root.path}>
                <button
                  type="button"
                  onClick={() => onSelectRoot(root.path)}
                  title={root.path}
                  className={[
                    "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
                    active
                      ? "bg-tertiary text-primary font-medium"
                      : "text-text hover:bg-tertiary/60",
                  ].join(" ")}
                >
                  <FolderIcon className="text-primary h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{root.name}</span>
                  <span
                    title={t("sidebar.sharedByDesktopUser")}
                    aria-label={t("sidebar.sharedByDesktopUser")}
                    className="flex-shrink-0"
                  >
                    <LockIcon className="text-darkgray h-3 w-3 flex-shrink-0" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export default FileManagerSidebar;
