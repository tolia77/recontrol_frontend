import { useEffect, useRef } from 'react';

/**
 * Modal shown when a user attempts to download a file > 100 MiB on a browser
 * that does NOT expose `window.showSaveFilePicker` (i.e. Firefox / Safari).
 *
 * CONTEXT-locked verbatim copy:
 *   `This file is too large to download in your browser ({size} MB). Use Chrome
 *    or Edge for files over 100 MB.`
 *
 * Single OK button, no Try Anyway escape hatch -- discoverability of the
 * blocking reason beats silent suppression. The Download menu item stays
 * enabled so the user can re-trigger and see the modal again.
 *
 * Capability detection (NOT user-agent sniffing) lives at the call site in
 * FileManagerPanel. The verifier explicitly greps for navigator.userAgent
 * across DeviceControl/ and would fail this plan if any UA-sniff slipped in.
 */
interface DownloadBlockedDialogProps {
  open: boolean;
  fileName: string;
  sizeBytes: number;
  onClose: () => void;
}

export function DownloadBlockedDialog({
  open,
  fileName,
  sizeBytes,
  onClose,
}: DownloadBlockedDialogProps) {
  const okRef = useRef<HTMLButtonElement>(null);

  // Focus the OK button on open so Enter/Space dismisses without a click.
  useEffect(() => {
    if (open) okRef.current?.focus();
  }, [open]);

  // Esc dismisses; mirrors ConfirmDialog's pattern.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Decimal MB display matches user mental model (1 MB = 1 million bytes in
  // marketing copy). The underlying capability check is binary MiB
  // (size > 100 * 1024 * 1024) at the call site.
  const sizeMb = Math.round(sizeBytes / 1_000_000);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-background border border-lightgray rounded-lg shadow-xl max-w-md w-[90%] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-3 text-text">Download blocked</h2>
        <p className="text-sm text-text/80 mb-2 break-all">{fileName}</p>
        <p className="text-sm text-text/80 mb-4">
          This file is too large to download in your browser ({sizeMb} MB). Use Chrome or Edge for files over 100 MB.
        </p>
        <div className="flex justify-end">
          <button
            ref={okRef}
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-accent text-white rounded-md hover:opacity-90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
