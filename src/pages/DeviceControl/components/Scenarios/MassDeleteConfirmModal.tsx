import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input } from '../../../../components/ui';

// D-22-12 / AUDIT-05 mass-delete arm: highest-friction destructive confirm.
// Operator must type the literal "DELETE" (case-sensitive, no transliteration
// in any locale — per D-22 mandate) before [Delete all] enables. Backdrop +
// Escape dismiss like PolicyPreviewModal.

export interface MassDeleteConfirmModalProps {
  open: boolean;
  count: number;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// The literal phrase is identical across EN+UK by D-22 discretion. Defined as
// a const so the equality check stays a single grep-able choke point.
const REQUIRED_PHRASE = 'DELETE';

export default function MassDeleteConfirmModal({
  open,
  count,
  onConfirm,
  onCancel,
  loading = false,
}: MassDeleteConfirmModalProps) {
  const { t } = useTranslation('scenarios');
  const [typedPhrase, setTypedPhrase] = useState<string>('');

  // Reset the typed phrase when the modal transitions closed -> open so a
  // re-open doesn't leak the previous attempt's input.
  useEffect(() => {
    if (open) setTypedPhrase('');
  }, [open]);

  // Escape dismiss — bind only while open to avoid spurious cancels.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const phraseMatches = typedPhrase === REQUIRED_PHRASE;
  const confirmDisabled = !phraseMatches || loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      data-testid="mass-delete-modal"
      onMouseDown={(e) => {
        // Backdrop dismiss: only when the mousedown's target IS the backdrop
        // (clicks on the inner card bubble up but currentTarget === target
        // only on the outer element itself).
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
        data-testid="mass-delete-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-primary">
          {t('history.deleteAllConfirm.title')}
        </h2>
        <p
          className="mt-2 text-sm text-gray-700"
          data-testid="mass-delete-body"
        >
          {t('history.deleteAllConfirm.body', { count })}
        </p>
        <div className="mt-3">
          <Input
            type="text"
            value={typedPhrase}
            onChange={(e) => setTypedPhrase(e.target.value)}
            placeholder={t('history.deleteAllConfirm.typePlaceholder')}
            data-testid="mass-delete-input"
            autoFocus
            disabled={loading}
            aria-label={t('history.deleteAllConfirm.typePlaceholder')}
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
            {t('history.deleteAllConfirm.cancel')}
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
            {t('history.deleteAllConfirm.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
