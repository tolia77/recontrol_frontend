import { useTranslation } from 'react-i18next';

import { Button, Modal } from '../../../../components/ui';

export interface DirtyGuardModalProps {
  open: boolean;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

// D-04: dirty-state confirm modal intercepts Cancel / [← Back to library]
// when the editor has unsaved changes. suppressEsc + suppressOverlayClick keep
// the intentional non-dismissable behavior (Pitfall 3 in 25-RESEARCH).
export default function DirtyGuardModal({
  open,
  onDiscard,
  onKeepEditing,
}: DirtyGuardModalProps) {
  const { t } = useTranslation('scenarios');
  return (
    <Modal
      open={open}
      onClose={onKeepEditing}
      size="sm"
      suppressEsc
      suppressOverlayClick
    >
      <Modal.Header>
        {t('editor.dirtyModal.title')}
      </Modal.Header>
      <Modal.Body>
        {t('editor.dirtyModal.body')}
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          className="rounded px-3 py-1 text-sm hover:bg-gray-100"
          onClick={onKeepEditing}
          data-testid="dirty-guard-keep"
        >
          {t('editor.dirtyModal.keepEditing')}
        </button>
        <Button
          variant="danger"
          size="sm"
          onClick={onDiscard}
          data-testid="dirty-guard-discard"
        >
          {t('editor.dirtyModal.discard')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
