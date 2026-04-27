import { useEffect, useRef, useState } from 'react';
import type { NameConflictMode } from '../../services/files';

interface NameConflictDialogProps {
  open: boolean;
  operation: 'upload' | 'move' | 'copy';
  fileName: string;
  destinationPath: string;
  onDecide: (mode: NameConflictMode, applyToAll: boolean) => void;
}

const OPERATION_LABEL: Record<NameConflictDialogProps['operation'], string> = {
  upload: 'uploading',
  move: 'moving',
  copy: 'copying',
};

export function NameConflictDialog({
  open,
  operation,
  fileName,
  destinationPath,
  onDecide,
}: NameConflictDialogProps) {
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

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div
        className="bg-background border border-lightgray rounded-lg shadow-xl max-w-md w-[90%] p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Name conflict"
      >
        <h2 className="text-lg font-semibold mb-3 text-text">Name conflict</h2>
        <p className="text-sm text-text/80">
          A file named <span className="font-medium">&quot;{fileName}&quot;</span>{' '}
          already exists while {OPERATION_LABEL[operation]} to:
        </p>
        <p className="text-xs text-text/70 mt-1 break-all">{destinationPath}</p>

        <label className="mt-4 flex items-center gap-2 text-sm text-text cursor-pointer select-none">
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
            className="accent-primary"
          />
          Apply to all conflicts in this batch
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onDecide('replace', applyToAll)}
            className="px-3 py-2 rounded-md bg-accent text-white hover:opacity-90"
          >
            Replace
          </button>
          <button
            ref={skipRef}
            type="button"
            onClick={() => onDecide('skip', applyToAll)}
            className="px-3 py-2 rounded-md border border-lightgray text-text hover:bg-tertiary"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onDecide('keepBoth', applyToAll)}
            className="px-3 py-2 rounded-md bg-primary text-white hover:opacity-90"
          >
            Keep Both
          </button>
        </div>
      </div>
    </div>
  );
}
