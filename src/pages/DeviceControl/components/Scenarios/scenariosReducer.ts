/**
 * scenariosReducer — outer reducer for the ScenariosPanel run + history state.
 *
 * Composes `transcriptReducer` (from ../Assistant/transcriptReducer) for the
 * per-step transcript sub-state per UI-04. Handles the two new envelope types
 * `run_started` + `scenario_step_skipped` at this outer layer; delegates
 * `tool_call_start` / `tool_call_result` / `done` to the inner reducer.
 *
 * session_token convention (Pitfall 3, 22-RESEARCH.md):
 *   The ScenarioRunner emits `session_token: scenario_run.id` on every
 *   envelope. The outer reducer initializes `transcript.sessionToken` to the
 *   active run's `runId` (i.e. `scenario_run.id`) inside `run_launch` so that
 *   the inner transcriptReducer's STREAM-04 session_token filter passes our
 *   broadcasts through.
 *
 * Cross-run defense (T-22-22):
 *   When a broadcast carries `run_id`, the outer reducer compares it to
 *   `activeRun.runId` and ignores mismatches. This guards against late-
 *   arriving envelopes from a previous run polluting the new run's state.
 *
 * Idempotent terminal status (T-22 idempotent-done invariant):
 *   Once `activeRun.status` is in the terminal set, subsequent `done`
 *   broadcasts are no-ops. Matches the transcriptReducer's "first done event
 *   wins" pattern.
 */

import {
  transcriptReducer,
  initialTranscriptState,
  type TranscriptState,
} from '../Assistant/transcriptReducer';
import type { AssistantBroadcast } from '../../hooks/useAssistantChannel';
import type { ScenarioRunBroadcast } from '../../hooks/useScenarioRunChannel';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ActiveRunStatus =
  | 'idle'
  | 'pre_approving'
  | 'running'
  | 'stopping'
  | 'completed'
  | 'failed'
  | 'user_stopped'
  | 'policy_deny'
  | 'access_revoked'
  | 'tab_closed'
  | 'abandoned'
  | 'error';

const TERMINAL_STATUSES: ReadonlyArray<ActiveRunStatus> = [
  'completed',
  'failed',
  'user_stopped',
  'policy_deny',
  'access_revoked',
  'tab_closed',
  'abandoned',
  'error',
];

function isTerminal(status: ActiveRunStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export interface ActiveRun {
  runId: string;
  scenarioId: string;
  scenarioName: string;
  deviceId: string;
  startedAt: number;
  stepCount: number;
  status: ActiveRunStatus;
  failedStepIndex?: number;
  skipped: ReadonlyArray<{ stepIndex: number; reason: string }>;
  transcript: TranscriptState;
}

export type ScenariosSegment = 'library' | 'history';

export interface ScenariosState {
  activeRun: ActiveRun | null;
  segment: ScenariosSegment;
}

export const initialScenariosState: ScenariosState = {
  activeRun: null,
  segment: 'library',
};

export type ScenariosAction =
  | { type: 'segment_set'; segment: ScenariosSegment }
  | {
      type: 'run_launch';
      runId: string;
      scenarioId: string;
      scenarioName: string;
      deviceId: string;
      stepCount: number;
      startedAt?: number;
    }
  | { type: 'broadcast'; broadcast: ScenarioRunBroadcast }
  | { type: 'run_stop_requested' }
  | { type: 'run_clear' };

// ----------------------------------------------------------------------------
// mapStopReasonToStatus — exported so the test can target it directly.
// ----------------------------------------------------------------------------

export function mapStopReasonToStatus(reason: string): ActiveRunStatus {
  switch (reason) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'user_stopped':
      return 'user_stopped';
    case 'policy_deny':
      return 'policy_deny';
    case 'access_revoked':
      return 'access_revoked';
    case 'tab_closed':
      return 'tab_closed';
    case 'abandoned':
      return 'abandoned';
    case 'error':
      return 'error';
    default:
      return 'error';
  }
}

// ----------------------------------------------------------------------------
// Reducer
// ----------------------------------------------------------------------------

/**
 * Adapt a ScenarioRunBroadcast into the AssistantBroadcast shape the inner
 * transcriptReducer expects. The relevant subset of envelopes
 * (`tool_call_start` / `tool_call_result` / `done`) is a strict superset of
 * the AssistantBroadcast variants of the same names — every field the inner
 * reducer touches is present on the ScenarioRun envelope verbatim. The cast
 * is therefore safe; we go through `unknown` so TS does not complain.
 */
function toAssistantBroadcast(msg: ScenarioRunBroadcast): AssistantBroadcast {
  return msg as unknown as AssistantBroadcast;
}

function delegateToTranscript(
  state: ScenariosState,
  msg: ScenarioRunBroadcast,
): ScenariosState {
  if (!state.activeRun) return state;
  const nextTranscript = transcriptReducer(state.activeRun.transcript, {
    type: 'broadcast',
    broadcast: toAssistantBroadcast(msg),
  });
  if (nextTranscript === state.activeRun.transcript) return state;
  return {
    ...state,
    activeRun: { ...state.activeRun, transcript: nextTranscript },
  };
}

export function scenariosReducer(
  state: ScenariosState,
  action: ScenariosAction,
): ScenariosState {
  switch (action.type) {
    case 'segment_set': {
      if (state.segment === action.segment) return state;
      return { ...state, segment: action.segment };
    }

    case 'run_launch': {
      const run: ActiveRun = {
        runId: action.runId,
        scenarioId: action.scenarioId,
        scenarioName: action.scenarioName,
        deviceId: action.deviceId,
        startedAt: action.startedAt ?? Date.now(),
        stepCount: action.stepCount,
        status: 'running',
        skipped: [],
        // Initialize transcript.sessionToken to runId so the inner reducer's
        // STREAM-04 filter passes our broadcasts (Pitfall 3). The runner emits
        // `session_token: scenario_run.id` on every envelope.
        transcript: { ...initialTranscriptState, sessionToken: action.runId },
      };
      return { ...state, activeRun: run };
    }

    case 'broadcast': {
      const msg = action.broadcast;
      const activeRun = state.activeRun;

      // Cross-run defense (T-22-22): if the broadcast carries a run_id that
      // disagrees with the current activeRun.runId, ignore. This protects
      // against late-arriving envelopes from a previous run polluting the
      // new run's state.
      //
      // `run_started` is exempt: it IS the reconciliation envelope that swaps
      // the placeholder runId minted by run_launch (`pending-<ts>`) for the
      // real scenario_run.id. The run_started case handles the mismatch
      // explicitly below; blocking it here strands the placeholder forever
      // and every subsequent tool_call_* gets filtered by the inner
      // transcriptReducer's session_token check.
      if (
        activeRun &&
        msg.type !== 'run_started' &&
        'run_id' in msg &&
        typeof msg.run_id === 'string' &&
        msg.run_id !== activeRun.runId
      ) {
        return state;
      }

      switch (msg.type) {
        case 'run_started': {
          // If we have an activeRun that matches the broadcast's run_id, this
          // is the in-band marker after run_launch already set things up —
          // no-op. Otherwise initialize activeRun from the broadcast (used by
          // observers / tabs that did not issue start_run themselves).
          if (activeRun && activeRun.runId === msg.run_id) return state;
          const run: ActiveRun = {
            runId: msg.run_id,
            scenarioId: msg.scenario_id,
            scenarioName: '',
            deviceId: '',
            startedAt: Date.parse(msg.started_at) || Date.now(),
            stepCount: msg.step_count,
            status: 'running',
            skipped: [],
            transcript: { ...initialTranscriptState, sessionToken: msg.run_id },
          };
          return { ...state, activeRun: run };
        }

        case 'scenario_step_skipped': {
          if (!activeRun) return state;
          return {
            ...state,
            activeRun: {
              ...activeRun,
              skipped: [
                ...activeRun.skipped,
                { stepIndex: msg.step_index, reason: msg.reason },
              ],
            },
          };
        }

        case 'tool_call_start':
        case 'tool_call_result': {
          // Delegate to transcriptReducer for the live-step transcript sub-state.
          return delegateToTranscript(state, msg);
        }

        case 'done': {
          if (!activeRun) return state;
          // Idempotent terminal — once we hit a terminal status, ignore
          // further done broadcasts.
          if (isTerminal(activeRun.status)) return state;
          const nextStatus = mapStopReasonToStatus(msg.stop_reason);
          // Forward to the inner reducer too so it can finalize streaming
          // assistant rows (idempotent there as well per its own pattern).
          const delegated = delegateToTranscript(state, msg);
          const base = delegated.activeRun ?? activeRun;
          return {
            ...delegated,
            activeRun: {
              ...base,
              status: nextStatus,
              failedStepIndex: msg.failed_step_index,
            },
          };
        }

        case 'error': {
          // Single-in-flight rejection (no run_id, no seq) is consumed by the
          // PolicyPreviewModal / Toast layer directly — the reducer only
          // tracks errors that bear on the active run.
          if (!activeRun) return state;
          if (isTerminal(activeRun.status)) return state;
          return {
            ...state,
            activeRun: { ...activeRun, status: 'error' },
          };
        }

        default:
          // Forward-compat: unknown broadcast types are ignored.
          return state;
      }
    }

    case 'run_stop_requested': {
      if (!state.activeRun) return state;
      if (state.activeRun.status !== 'running') return state;
      return {
        ...state,
        activeRun: { ...state.activeRun, status: 'stopping' },
      };
    }

    case 'run_clear': {
      if (state.activeRun === null) return state;
      return { ...state, activeRun: null };
    }

    default:
      return state;
  }
}
