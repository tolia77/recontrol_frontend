import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NameConflictMode } from '../../services/files';

interface NameConflictDialogProps {
  open: boolean;
  operation: 'upload' | 'move' | 'copy';
  fileName: string;
  destinationPath: string;
  onDecide: (mode: NameConflictMode, applyToAll: boolean) => void;
}

export function NameConflictDialog({
  open,
  operation,
  fileName,
  destinationPath,
  onDecide,
}: NameConflictDialogProps) {
  const { t } = useTranslation('fileManager');
  const skipRef = useRef<HTMLButtonElement>(null);
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApplyToAll(false);
    skipRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDecide('skip', applyToAll);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, applyToAll, onDecide]);

  if (!open) return null;

  const operationLabel = t(`dialogs.nameConflict.${operation}`);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div
        className="bg-background border border-lightgray rounded-lg shadow-xl max-w-md w-[90%] p-6"
        role="dialog"
        aria-modal="true"
        aria-label={t('dialogs.nameConflict.ariaLabel')}
      >
        <h2 className="text-lg font-semibold mb-3 text-text">
          {t('dialogs.nameConflict.title')}
        </h2>
        <p className="text-sm text-text/80">
          {t('dialogs.nameConflict.bodyPrefix')}{' '}
          <span className="font-medium">&quot;{fileName}&quot;</span>{' '}
          {t('dialogs.nameConflict.bodySuffix', { operationLabel })}
        </p>
        <p className="text-xs text-text/70 mt-1 break-all">{destinationPath}</p>

        <label className="mt-4 flex items-center gap-2 text-sm text-text cursor-pointer select-none">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="accent-primary"
          />
          {t('dialogs.nameConflict.applyToAll')}
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onDecide('replace', applyToAll)}
            className="px-3 py-2 rounded-md bg-accent text-white hover:opacity-90"
          >
            {t('dialogs.nameConflict.replace')}
          </button>
          <button
            ref={skipRef}
            type="button"
            onClick={() => onDecide('skip', applyToAll)}
            className="px-3 py-2 rounded-md border border-lightgray text-text hover:bg-tertiary"
          >
            {t('dialogs.nameConflict.skip')}
          </button>
          <button
            type="button"
            onClick={() => onDecide('keepBoth', applyToAll)}
            className="px-3 py-2 rounded-md bg-primary text-white hover:opacity-90"
          >
            {t('dialogs.nameConflict.keepBoth')}
          </button>
        </div>
      </div>
    </div>
  );
}
