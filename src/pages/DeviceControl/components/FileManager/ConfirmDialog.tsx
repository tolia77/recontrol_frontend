import { useEffect, useRef } from 'react';
import type { ConfirmDialogProps } from './types';

/**
 * Destructive-styled confirmation modal used by the file manager panel for
 * delete confirmation (plan 10-05). Keeps the same visual language as
 * `ProcessesModal` (fixed-inset overlay + centered card + z-50).
 *
 * Cancel-by-default: when `dangerous` is true, the Cancel button receives
 * focus on open and is rendered LEFT of Confirm so the destructive action
 * stays away from the default focus / Enter key. CONTEXT-locked decision.
 *
 * In-flight safety (`isBusy`): once Confirm has been clicked and the panel
 * starts firing wire calls, the panel passes `isBusy={true}` back through.
 * Both buttons go disabled, the Confirm button shows a spinner, AND Esc /
 * overlay-click cancellation are suppressed so the user can't dismiss the
 * dialog while wire calls are still resolving sequentially. The panel
 * unwinds `isBusy` in a `finally` block so the dialog always becomes
 * dismissable again, even on uncaught rejection.
 *
 * Esc-to-cancel: only fires when `!isBusy && open`. Avoids the race where
 * the user pressed Esc just after Confirm dispatched the loop.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  dangerous,
  checkbox,
  isBusy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus Cancel on open transition so the destructive action isn't the
  // default-focused button (CONTEXT decision).
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  // Esc cancels only when not busy; document-level so it works regardless of
  // which button currently has focus (matches ContextMenu's pattern).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, isBusy, onCancel]);

  if (!open) return null;

  const handleOverlayClick = () => {
    // Suppress overlay-click cancel while a destructive op is in flight.
    if (isBusy) return;
    onCancel();
  };

  const confirmClass =
    (dangerous
      ? 'px-4 py-2 bg-error text-white rounded-md hover:opacity-90'
      : 'px-4 py-2 bg-accent text-white rounded-md hover:opacity-90') +
    ' disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="bg-background border border-lightgray rounded-lg shadow-xl max-w-md w-[90%] p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="text-lg font-semibold mb-3 text-text">{title}</h2>
        <div className="text-sm text-text/80 mb-4">{body}</div>

        {checkbox && (
          <label className="flex items-center gap-2 text-sm mb-4 text-text cursor-pointer select-none">
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

        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={!!isBusy}
            className="px-4 py-2 border border-lightgray rounded-md text-text hover:bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel ?? 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!!isBusy}
            className={confirmClass}
          >
            {isBusy && (
              <span
                className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            {confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
