import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Input, Modal } from "src/components/ui";

// Highest-friction destructive confirm for deleting all runs. Operator must
// type the literal "DELETE" (case-sensitive, identical in every locale — never
// transliterated) before [Delete all] enables. The Modal shell owns scroll-lock
// and focus management; Esc is handled at window level (suppressEsc on the shell
// prevents double-firing).

export interface MassDeleteConfirmModalProps {
  open: boolean;
  count: number;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// The required phrase is identical across EN and UK. Defined as a const so the
// equality check stays a single grep-able choke point.
const REQUIRED_PHRASE = "DELETE";

export default function MassDeleteConfirmModal({
  open,
  count,
  onConfirm,
  onCancel,
  loading = false,
}: MassDeleteConfirmModalProps) {
  const { t } = useTranslation("scenarios");
  const [typedPhrase, setTypedPhrase] = useState<string>("");

  // Reset the typed phrase when the modal transitions closed -> open so a
  // re-open doesn't leak the previous attempt's input.
  useEffect(() => {
    if (open) setTypedPhrase("");
  }, [open]);

  // Escape dismiss via window-level listener. Modal shell receives suppressEsc
  // so only this handler fires (avoids double-calling onCancel). Gated on
  // !loading so a mid-delete Esc cannot abandon the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  const phraseMatches = typedPhrase === REQUIRED_PHRASE;
  const confirmDisabled = !phraseMatches || loading;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="md"
      suppressEsc
      suppressOverlayClick
      ariaLabel={t("history.deleteAllConfirm.title")}
    >
      {/* Inner wrapper carries the testids and a mouseDown-based backdrop
          dismiss: the outer div is the "backdrop area" (mouseDown on it cancels)
          and the inner card div stops mouseDown propagation. The Modal shell
          owns the only dialog role/boundary. */}
      <div
        data-testid="mass-delete-modal"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <div
          data-testid="mass-delete-card"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h2 className="text-primary text-base font-semibold">
            {t("history.deleteAllConfirm.title")}
          </h2>
          <p
            className="mt-2 text-body text-foreground"
            data-testid="mass-delete-body"
          >
            {t("history.deleteAllConfirm.body", { count })}
          </p>
          <div className="mt-3">
            <Input
              type="text"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
              placeholder={t("history.deleteAllConfirm.typePlaceholder")}
              data-testid="mass-delete-input"
              autoFocus
              disabled={loading}
              aria-label={t("history.deleteAllConfirm.typePlaceholder")}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={loading}
              data-testid="mass-delete-cancel"
            >
              {t("history.deleteAllConfirm.cancel")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={loading}
              disabled={confirmDisabled}
              onClick={() => {
                // The `=== 'DELETE'` gate at the disabled level prevents a
                // synthetic Enter-press from triggering this without the typed
                // phrase. Keep the click handler trusting the disabled gate.
                void onConfirm();
              }}
              data-testid="mass-delete-confirm"
            >
              {t("history.deleteAllConfirm.confirm")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
