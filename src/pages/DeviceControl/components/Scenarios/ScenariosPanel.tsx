import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SegmentedControl, useToast } from '../../../../components/ui';
import ScenariosLibrary from './ScenariosLibrary';
import ScenarioEditor from './ScenarioEditor';
import ScenariosHistory from './ScenariosHistory';
import ScenariosHistoryDetail from './ScenariosHistoryDetail';
import ScenariosRunMode from './ScenariosRunMode';
import PolicyPreviewModal from './PolicyPreviewModal';
import {
  scenariosService,
  type PolicyPreviewResponse,
  type Scenario,
} from '../../../../services/backend/scenariosService';
import { useScenarioRunChannel } from '../../hooks/useScenarioRunChannel';
import type { ScenarioRunBroadcast } from '../../hooks/useScenarioRunChannel';
import {
  initialScenariosState,
  scenariosReducer,
  type ScenariosSegment,
} from './scenariosReducer';

// -----------------------------------------------------------------------------
// PanelMode discriminated union — Plan 22.10 extends the P21 shape to add
// 'history' + 'run' + 'history_detail' variants. The 'library' / 'editor'
// variants stay; the integration is mechanical wiring per Plan 22.10 objective.
// -----------------------------------------------------------------------------

type PanelMode =
  | { kind: 'library' }
  | { kind: 'history' }
  | { kind: 'editor'; editingId: string | 'new' }
  | { kind: 'run'; runId: string; scenarioId: string; backTo: ScenariosSegment }
  | { kind: 'history_detail'; runId: string };

// UI-05: sessionStorage key for the active segment. Wrapped in try/catch
// throughout for private-browsing tolerance (matches Plan 22.06 / Pattern 14).
const SEGMENT_KEY = 'scenarios_panel_segment';

function readSegmentFromStorage(): ScenariosSegment {
  try {
    const stored = sessionStorage.getItem(SEGMENT_KEY);
    return stored === 'history' ? 'history' : 'library';
  } catch {
    return 'library';
  }
}

function writeSegmentToStorage(value: ScenariosSegment): void {
  try {
    sessionStorage.setItem(SEGMENT_KEY, value);
  } catch {
    // private browsing — no-op
  }
}

interface ModalState {
  open: boolean;
  scenarioId: string | null;
  scenario: Scenario | null;
  response: PolicyPreviewResponse | null;
  loading: boolean;
  error: string | null;
}

const initialModalState: ModalState = {
  open: false,
  scenarioId: null,
  scenario: null,
  response: null,
  loading: false,
  error: null,
};

export interface ScenariosPanelProps {
  deviceId: string;
  ws: WebSocket | null;
  deviceName: string;
}

export default function ScenariosPanel({
  deviceId,
  ws,
  deviceName,
}: ScenariosPanelProps) {
  const { t } = useTranslation('scenarios');
  const toast = useToast();

  // Segment state — initialized from sessionStorage (UI-05).
  const initialSegment = readSegmentFromStorage();
  const [segment, setSegment] = useState<ScenariosSegment>(initialSegment);

  // Mode router — starts in the initial segment (library or history).
  const [mode, setMode] = useState<PanelMode>({ kind: initialSegment });

  // Scenarios outer reducer (composes transcriptReducer for live run state).
  const [scenariosState, dispatchScenarios] = useReducer(scenariosReducer, {
    ...initialScenariosState,
    segment: initialSegment,
  });

  // Modal state for PolicyPreviewModal.
  const [modalState, setModalState] = useState<ModalState>(initialModalState);

  // Persist segment changes to sessionStorage.
  useEffect(() => {
    writeSegmentToStorage(segment);
  }, [segment]);

  // Keep the mode and segment in sync when the operator clicks a segment pill
  // while in library / history. Editor / run / history_detail are takeovers
  // and do not change the segment.
  const handleSegmentChange = useCallback((next: ScenariosSegment): void => {
    setSegment(next);
    // Only re-route mode if we are currently on a non-takeover view.
    setMode((prev) => {
      if (prev.kind === 'library' || prev.kind === 'history') {
        return { kind: next };
      }
      return prev;
    });
  }, []);

  // Keep a stable ref to the active modal state so the broadcast handler does
  // not need to re-mount on every modal mutation.
  const modalOpenRef = useRef<boolean>(false);
  useEffect(() => {
    modalOpenRef.current = modalState.open;
  }, [modalState.open]);

  // Channel broadcast handler. Dispatches into the reducer; surfaces the
  // single-in-flight rejection as a Toast (D-22-11).
  const onBroadcast = useCallback(
    (msg: ScenarioRunBroadcast): void => {
      // D-22-11: single-in-flight rejection. Seqless error envelopes with the
      // run_in_progress message land here; surface as a Toast and stay in the
      // modal so the operator can [Dismiss] to back out.
      if (msg.type === 'error' && msg.message === 'run_in_progress') {
        toast.error(t('run.inProgressToast', { deviceName }));
        return;
      }
      dispatchScenarios({ type: 'broadcast', broadcast: msg });
    },
    [toast, t, deviceName],
  );

  // Mount the ScenarioRunChannel subscription.
  const { dispatch: dispatchChannel } = useScenarioRunChannel(ws, onBroadcast);

  // Library → modal opener flow per D-22-07 + RUN-01.
  const handleRunClick = useCallback(
    async (scenarioId: string) => {
      setModalState({
        open: true,
        scenarioId,
        scenario: null,
        response: null,
        loading: true,
        error: null,
      });
      try {
        const scenario = await scenariosService.show(scenarioId);
        const targetDeviceId = scenario.pinned_device_id ?? deviceId;
        const preview = await scenariosService.policyPreview(
          scenarioId,
          targetDeviceId,
        );
        setModalState({
          open: true,
          scenarioId,
          scenario,
          response: preview,
          loading: false,
          error: null,
        });
      } catch {
        setModalState((prev) => ({
          ...prev,
          loading: false,
          error: t('library.empty'),
        }));
      }
    },
    [deviceId, t],
  );

  // Modal [Run all] click → dispatch start_run and transition to Run-mode.
  const handleApprove = useCallback(() => {
    const scenario = modalState.scenario;
    if (!scenario || !modalState.scenarioId) return;
    // Synthetic run launch — the actual run_id arrives on the run_started
    // broadcast; the reducer reconciles when the in-band marker comes through.
    const placeholderRunId = `pending-${Date.now()}`;
    dispatchScenarios({
      type: 'run_launch',
      runId: placeholderRunId,
      scenarioId: modalState.scenarioId,
      scenarioName: scenario.name,
      deviceId,
      stepCount: scenario.command_steps.length,
      startedAt: Date.now(),
    });
    dispatchChannel('start_run', {
      scenario_id: modalState.scenarioId,
      device_id: scenario.pinned_device_id ?? deviceId,
    });
    setMode({
      kind: 'run',
      runId: placeholderRunId,
      scenarioId: modalState.scenarioId,
      backTo: segment,
    });
    setModalState(initialModalState);
  }, [modalState, deviceId, dispatchChannel, segment]);

  const handleCancel = useCallback(() => {
    setModalState(initialModalState);
  }, []);

  // Run-mode handlers.
  const handleStop = useCallback(() => {
    dispatchChannel('stop_run');
    dispatchScenarios({ type: 'run_stop_requested' });
  }, [dispatchChannel]);

  const handleBack = useCallback(() => {
    const backTo = mode.kind === 'run' ? mode.backTo : segment;
    dispatchScenarios({ type: 'run_clear' });
    setMode({ kind: backTo });
    setSegment(backTo);
  }, [mode, segment]);

  // History detail navigation.
  const handleSelectRun = useCallback((runId: string) => {
    setMode({ kind: 'history_detail', runId });
  }, []);

  const handleHistoryDetailBack = useCallback(() => {
    setMode({ kind: 'history' });
    setSegment('history');
  }, []);

  const handleHistoryDetailDeleted = useCallback(() => {
    setMode({ kind: 'history' });
    setSegment('history');
  }, []);

  const showSegmentedControl =
    mode.kind === 'library' || mode.kind === 'history';

  // Compute the header title per mode.
  const headerTitle = (() => {
    switch (mode.kind) {
      case 'library':
      case 'history':
        return t('library.title');
      case 'editor':
        return t('editor.newScenarioTitle');
      case 'run':
        return scenariosState.activeRun?.scenarioName ?? t('library.title');
      case 'history_detail':
        return t('history.tabLabel');
    }
  })();

  return (
    <div
      className="flex h-full w-full flex-col bg-white"
      data-testid="scenarios-panel"
    >
      <header className="border-b border-lightgray px-4 py-2 text-sm font-semibold text-primary">
        {headerTitle}
      </header>
      {showSegmentedControl && (
        <div className="px-4 py-2">
          <SegmentedControl<ScenariosSegment>
            value={segment}
            options={[
              { value: 'library', label: t('library.segmentLabel') },
              { value: 'history', label: t('history.tabLabel') },
            ]}
            onChange={handleSegmentChange}
            data-testid="scenarios-panel-segment"
            ariaLabel={t('library.segmentLabel')}
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {mode.kind === 'library' && (
          <ScenariosLibrary
            deviceId={deviceId}
            onEdit={(id) => setMode({ kind: 'editor', editingId: id })}
            onNew={() => setMode({ kind: 'editor', editingId: 'new' })}
            onRun={handleRunClick}
            activeRunDeviceId={scenariosState.activeRun?.deviceId ?? null}
          />
        )}
        {mode.kind === 'history' && (
          <ScenariosHistory onSelectRun={handleSelectRun} />
        )}
        {mode.kind === 'editor' && (
          <ScenarioEditor
            deviceId={deviceId}
            editingId={mode.editingId}
            onClose={() => setMode({ kind: segment })}
          />
        )}
        {mode.kind === 'run' && scenariosState.activeRun && (
          <ScenariosRunMode
            activeRun={scenariosState.activeRun}
            deviceName={deviceName}
            backTo={mode.backTo}
            onStop={handleStop}
            onBack={handleBack}
            commandSteps={
              modalState.scenario?.command_steps.map((cs) => ({
                id: cs.id,
                binary: cs.binary,
                args: cs.args,
                cwd: cs.cwd,
                description: cs.description ?? undefined,
              })) ?? []
            }
          />
        )}
        {mode.kind === 'history_detail' && (
          <ScenariosHistoryDetail
            runId={mode.runId}
            activeRun={scenariosState.activeRun}
            onBack={handleHistoryDetailBack}
            onDeleted={handleHistoryDetailDeleted}
          />
        )}
      </div>

      {/* PolicyPreviewModal mounted at the panel root */}
      <PolicyPreviewModal
        open={modalState.open}
        response={modalState.response}
        loading={modalState.loading}
        error={modalState.error}
        scenarioName={modalState.scenario?.name ?? ''}
        deviceName={deviceName}
        deviceId={deviceId}
        canChangeDevice={false}
        commandSteps={
          modalState.scenario?.command_steps.map((cs) => ({
            id: cs.id,
            binary: cs.binary,
            args: cs.args,
            cwd: cs.cwd,
            description: cs.description ?? undefined,
          })) ?? []
        }
        onApprove={handleApprove}
        onCancel={handleCancel}
      />
    </div>
  );
}
