import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ScenariosLibrary from './ScenariosLibrary';
// ScenarioEditor.tsx is a placeholder in Plan 21-09 and is fully replaced by
// Plan 21-10. Both files coexist in the same directory.
import ScenarioEditor from './ScenarioEditor';

export interface ScenariosPanelProps {
  deviceId: string;
}

// D-15: panel sub-mode is internal state; resets to library on every panel
// open (the parent unmounts ScenariosPanel when rightPaneActive flips away
// from 'scenarios').
// D-01: editor is a full-takeover that replaces the library list inside the
// same panel when editingId is non-null. [← Back to library] flips back.
type PanelMode =
  | { kind: 'library' }
  | { kind: 'editor'; editingId: string | 'new' };

export default function ScenariosPanel({ deviceId }: ScenariosPanelProps) {
  const { t } = useTranslation('scenarios');
  const [mode, setMode] = useState<PanelMode>({ kind: 'library' });

  return (
    <div
      className="flex h-full w-full flex-col bg-white"
      data-testid="scenarios-panel"
    >
      <header className="border-b border-lightgray px-4 py-2 text-sm font-semibold text-primary">
        {mode.kind === 'library'
          ? t('library.title')
          : t('editor.newScenarioTitle')}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {mode.kind === 'library' ? (
          <ScenariosLibrary
            deviceId={deviceId}
            onEdit={(id) => setMode({ kind: 'editor', editingId: id })}
            onNew={() => setMode({ kind: 'editor', editingId: 'new' })}
            // Plan 22.10 replaces this no-op with the real PolicyPreviewModal
            // opener that takes (scenarioId) → fetch /policy_preview → mount
            // the modal with the response. Plan 22.07 only ships the prop
            // plumbing reach (row → library → panel) so 22.10's wiring is
            // a one-line change here.
            onRun={() => {}}
          />
        ) : (
          <ScenarioEditor
            deviceId={deviceId}
            editingId={mode.editingId}
            onClose={() => setMode({ kind: 'library' })}
          />
        )}
      </div>
    </div>
  );
}
