import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from 'src/components/ui';
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
  }, [open]);

  const operationLabel = t(`dialogs.nameConflict.${operation}`);

  return (
    <Modal
      open={open}
      onClose={() => onDecide('skip', applyToAll)}
      size="md"
      initialFocusRef={skipRef as React.RefObject<HTMLElement | null>}
    >
      <Modal.Header>{t('dialogs.nameConflict.title')}</Modal.Header>
      <Modal.Body>
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
      </Modal.Body>
      <Modal.Footer>
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
      </Modal.Footer>
    </Modal>
  );
}
