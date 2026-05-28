import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "src/components/ui";
import type { NameConflictMode } from "src/pages/DeviceControl/services/files";

interface NameConflictDialogProps {
  open: boolean;
  operation: "upload" | "move" | "copy";
  fileName: string;
  destinationPath: string;
  onDecide: (mode: NameConflictMode, applyToAll: boolean) => void;
}

function NameConflictDialog({
  open,
  operation,
  fileName,
  destinationPath,
  onDecide,
}: NameConflictDialogProps) {
  const { t } = useTranslation("fileManager");
  const skipRef = useRef<HTMLButtonElement>(null);
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApplyToAll(false);
  }, [open]);

  const operationLabel = t(`dialogs.nameConflict.${operation}`);

  return (
    <Modal
      open={open}
      onClose={() => onDecide("skip", applyToAll)}
      size="md"
      initialFocusRef={skipRef as React.RefObject<HTMLElement | null>}
    >
      <Modal.Header>{t("dialogs.nameConflict.title")}</Modal.Header>
      <Modal.Body>
        <p className="text-text/80 text-sm">
          {t("dialogs.nameConflict.bodyPrefix")}{" "}
          <span className="font-medium">&quot;{fileName}&quot;</span>{" "}
          {t("dialogs.nameConflict.bodySuffix", { operationLabel })}
        </p>
        <p className="text-text/70 mt-1 text-xs break-all">{destinationPath}</p>

        <label className="text-text mt-4 flex cursor-pointer items-center gap-2 text-sm select-none">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="accent-primary"
          />
          {t("dialogs.nameConflict.applyToAll")}
        </label>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={() => onDecide("replace", applyToAll)}
          className="bg-accent rounded-md px-3 py-2 text-white hover:opacity-90"
        >
          {t("dialogs.nameConflict.replace")}
        </button>
        <button
          ref={skipRef}
          type="button"
          onClick={() => onDecide("skip", applyToAll)}
          className="border-lightgray text-text hover:bg-tertiary rounded-md border px-3 py-2"
        >
          {t("dialogs.nameConflict.skip")}
        </button>
        <button
          type="button"
          onClick={() => onDecide("keepBoth", applyToAll)}
          className="bg-primary rounded-md px-3 py-2 text-white hover:opacity-90"
        >
          {t("dialogs.nameConflict.keepBoth")}
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default NameConflictDialog;
