import { ConfirmModal } from "src/components/ui";
import { useTranslation } from "react-i18next";

/**
 * Per-file >100 MiB warning gate (TRANSFER-06).
 *
 * Shown sequentially BEFORE enqueueing each large file. The panel walks the
 * dropped/picked batch one entry at a time; small files (<= 100 MiB) skip the
 * dialog and enqueue directly. Cancel removes the file from upload candidates
 * (no enqueue, no state-failed entry); Confirm flips the per-file approval
 * and the panel proceeds to enqueue.
 *
 * Display unit: decimal MB (size / 1_000_000) per CONTEXT discretion -- matches
 * the user's mental model (1 MB = 1 million bytes in marketing copy). The
 * underlying threshold check is binary MiB (`size > 100 * 1024 * 1024`).
 *
 * Reuses the existing ConfirmDialog primitive with `dangerous={false}` so the
 * primary button is the safe-coloured Confirm and Esc does not terminate the
 * sequential walk through the batch.
 */
interface LargeFileWarningDialogProps {
  open: boolean;
  fileName: string;
  sizeBytes: number;
  direction: "upload" | "download";
  onConfirm: () => void;
  onCancel: () => void;
}

function LargeFileWarningDialog({
  open,
  fileName,
  sizeBytes,
  direction,
  onConfirm,
  onCancel,
}: LargeFileWarningDialogProps) {
  const { t } = useTranslation("fileManager");
  const sizeMb = Math.round(sizeBytes / 1_000_000);
  const action =
    direction === "upload"
      ? t("dialogs.largeFileWarning.upload")
      : t("dialogs.largeFileWarning.download");
  return (
    <ConfirmModal
      open={open}
      title={t("dialogs.largeFileWarning.title", { direction })}
      body={
        <p>
          {t("dialogs.largeFileWarning.body", { sizeMb, fileName, action })}
        </p>
      }
      confirmLabel={action}
      cancelLabel={t("dialogs.cancel")}
      dangerous={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export default LargeFileWarningDialog;
