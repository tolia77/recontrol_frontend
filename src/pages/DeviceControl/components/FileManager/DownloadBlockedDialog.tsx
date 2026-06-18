import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "src/components/ui";

/**
 * Modal shown when a user attempts to download a file > 100 MiB on a browser
 * that does NOT expose `window.showSaveFilePicker` (i.e. Firefox / Safari).
 *
 * Single OK button, no Try Anyway escape hatch -- discoverability of the
 * blocking reason beats silent suppression. The Download menu item stays
 * enabled so the user can re-trigger and see the modal again.
 *
 * Capability detection (NOT UA sniffing) lives at the call site in
 * FileManagerPanel via `typeof window.showSaveFilePicker === 'function'`.
 */
interface DownloadBlockedDialogProps {
  open: boolean;
  fileName: string;
  sizeBytes: number;
  onClose: () => void;
}

function DownloadBlockedDialog({
  open,
  fileName,
  sizeBytes,
  onClose,
}: DownloadBlockedDialogProps) {
  const { t } = useTranslation("fileManager");
  const okRef = useRef<HTMLButtonElement>(null);

  // Decimal MB display matches user mental model (1 MB = 1 million bytes in
  // marketing copy). The underlying capability check is binary MiB
  // (size > 100 * 1024 * 1024) at the call site.
  const sizeMb = Math.round(sizeBytes / 1_000_000);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      initialFocusRef={okRef as React.RefObject<HTMLElement | null>}
    >
      <Modal.Header>{t("dialogs.downloadBlocked.title")}</Modal.Header>
      <Modal.Body>
        <p className="text-foreground/80 mb-2 text-body break-all">{fileName}</p>
        <p className="text-foreground/80 text-body">
          {t("dialogs.downloadBlocked.body", { sizeMb })}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <button
          ref={okRef}
          type="button"
          onClick={onClose}
          className="bg-primary rounded-md px-4 py-2 text-white hover:bg-primary-hover transition-colors"
        >
          {t("dialogs.ok")}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default DownloadBlockedDialog;
