import type { FileEntry } from '../../services/files';
import { LockIcon, FolderIcon } from './icons';
import { isAncestor } from './utils/pathUtils';

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
export function FileManagerSidebar({
  roots,
  isLoading,
  error,
  currentPath,
  onSelectRoot,
}: FileManagerSidebarProps) {
  return (
    <aside className="w-60 border-r border-lightgray overflow-y-auto bg-background flex-shrink-0">
      <div className="px-3 py-2 border-b border-lightgray">
        <span className="text-xs text-darkgray uppercase font-bold tracking-wide">
          Shared folders
        </span>
      </div>

      {isLoading && (
        <div className="p-2 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-8 rounded bg-lightgray/60 animate-pulse"
              aria-hidden="true"
            />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div className="p-3 text-sm text-error">{error}</div>
      )}

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
                    'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left cursor-pointer transition-colors',
                    active
                      ? 'bg-tertiary text-primary font-medium'
                      : 'text-text hover:bg-tertiary/60',
                  ].join(' ')}
                >
                  <FolderIcon className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="truncate flex-1">{root.name}</span>
                  <span
                    title={root.path}
                    aria-label="Shared from the remote desktop"
                    className="flex-shrink-0"
                  >
                    <LockIcon className="w-3 h-3 text-darkgray flex-shrink-0" />
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
