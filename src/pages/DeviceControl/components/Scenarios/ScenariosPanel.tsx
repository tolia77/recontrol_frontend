// Phase 21-06: scaffold mount. Library list + editor land in Plans 21-09 / 21-10.
// The component intentionally renders a placeholder so MainContent's Splitter
// right-slot has a non-null node when rightPaneActive === 'scenarios'.

export interface ScenariosPanelProps {
  deviceId: string;
}

export default function ScenariosPanel({ deviceId: _deviceId }: ScenariosPanelProps) {
  return <div data-testid="scenarios-panel" className="h-full w-full" />;
}
