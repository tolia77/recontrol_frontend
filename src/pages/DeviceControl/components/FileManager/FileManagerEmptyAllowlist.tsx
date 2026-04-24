import { FolderIcon } from './icons';

/**
 * ALLOW-05 empty-state. Rendered when `files.listRoots` resolves to an empty
 * array. The CTA button is intentionally a no-op -- the user is in the
 * browser and cannot open the desktop's Settings window. The copy tells them
 * to ask the desktop user (CONTEXT locked).
 */
export function FileManagerEmptyAllowlist() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 bg-background">
      <div className="relative mb-4">
        <FolderIcon className="w-20 h-20 text-lightgray" />
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-error flex items-center justify-center text-white text-lg font-bold shadow">
          !
        </div>
      </div>
      <h3 className="text-lg font-semibold text-text mb-2">
        No shared folders
      </h3>
      <p className="text-sm text-darkgray max-w-md mb-6">
        No folders are currently shared from the remote desktop. Ask the
        desktop user to add folders in ReControl Desktop Settings.
      </p>
      <button
        type="button"
        disabled
        title="This must be done on the remote computer."
        className="px-4 py-2 rounded-lg bg-secondary text-white text-sm font-medium opacity-50 cursor-not-allowed"
      >
        Open ReControl Desktop Settings
      </button>
    </div>
  );
}
