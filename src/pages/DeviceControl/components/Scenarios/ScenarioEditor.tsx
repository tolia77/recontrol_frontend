// PLACEHOLDER -- Plan 21-10 replaces with the real ScenarioEditor.
// Kept here so ScenariosPanel.tsx (Plan 21-09) builds in isolation.
// Plans 21-09 and 21-10 can be executed in any order within Wave 3;
// the executor overwrites this file when Plan 21-10 runs.

export interface ScenarioEditorProps {
  deviceId: string;
  editingId: string | 'new';
  onClose: () => void;
}

export default function ScenarioEditor(_props: ScenarioEditorProps) {
  return <div data-testid="scenario-editor-placeholder" />;
}
