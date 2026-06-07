import { useRef, type ReactNode } from "react";

import Button from "./Button";
import Modal from "./Modal";

interface CheckboxSlot {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  dangerous?: boolean;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  checkbox?: CheckboxSlot;
}

function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  dangerous = false,
  isBusy = false,
  onConfirm,
  onCancel,
  checkbox,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="md"
      suppressEsc={!!isBusy}
      suppressOverlayClick={!!isBusy}
      initialFocusRef={cancelRef as React.RefObject<HTMLElement | null>}
    >
      <Modal.Header>{title}</Modal.Header>
      <Modal.Body>
        {body}
        {checkbox && (
          <label className="text-foreground mb-4 flex cursor-pointer items-center gap-2 text-body select-none">
            <input
              type="checkbox"
              checked={checkbox.checked}
              onChange={(e) => checkbox.onChange(e.target.checked)}
              className="accent-primary"
              disabled={!!isBusy}
            />
            {checkbox.label}
          </label>
        )}
      </Modal.Body>
      <Modal.Footer>
        {dangerous ? (
          <>
            <Button
              ref={cancelRef}
              variant="secondary"
              disabled={!!isBusy}
              onClick={onCancel}
            >
              {cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant="danger"
              loading={!!isBusy}
              disabled={!!isBusy}
              onClick={onConfirm}
            >
              {confirmLabel ?? "OK"}
            </Button>
          </>
        ) : (
          <>
            <Button
              ref={cancelRef}
              variant="secondary"
              disabled={!!isBusy}
              onClick={onCancel}
            >
              {cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant="primary"
              loading={!!isBusy}
              disabled={!!isBusy}
              onClick={onConfirm}
            >
              {confirmLabel ?? "OK"}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}

export default ConfirmModal;
