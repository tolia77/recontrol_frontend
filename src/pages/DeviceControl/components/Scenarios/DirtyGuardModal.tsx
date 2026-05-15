import { useTranslation } from 'react-i18next';

export interface DirtyGuardModalProps {
  open: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

// D-04: dirty-state confirm modal intercepts Cancel / [← Back to library]
// when the editor has unsaved changes. Renders nothing when closed.
export default function DirtyGuardModal({
  open,
  onDiscard,
  onKeepEditing,
}: DirtyGuardModalProps) {
  const { t } = useTranslation('scenarios');
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      data-testid="dirty-guard-modal"
    >
      <div className="w-full max-w-sm rounded bg-white p-4 shadow-lg">
        <h2 className="text-base font-semibold text-primary">
          {t('editor.dirtyModal.title')}
        </h2>
        <p className="mt-2 text-sm text-gray-700">
          {t('editor.dirtyModal.body')}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-3 py-1 text-sm hover:bg-gray-100"
            onClick={onKeepEditing}
            data-testid="dirty-guard-keep"
          >
            {t('editor.dirtyModal.keepEditing')}
          </button>
          <button
            type="button"
            className="rounded bg-error px-3 py-1 text-sm text-white hover:opacity-90"
            onClick={onDiscard}
            data-testid="dirty-guard-discard"
          >
            {t('editor.dirtyModal.discard')}
          </button>
        </div>
      </div>
    </div>
  );
}
