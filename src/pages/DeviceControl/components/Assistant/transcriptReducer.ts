import type { AssistantBroadcast } from '../../hooks/useAssistantChannel';

/**
 * Transcript reducer (Plan 20-07).
 *
 * Pure state machine that consumes the six wire broadcast types delivered by
 * `useAssistantChannel` (plus the synthetic `connection_lost` /
 * `stream_out_of_order` error events the hook fabricates) and one synthetic
 * `submit_prompt` action dispatched by the InputBox in Plan 20-09.
 *
 * Invariants (cross-reference 20-CONTEXT / 20-RESEARCH):
 *   - Pure function: no side effects, no setTimeout, no Date.now() in
 *     correlation logic. Time stamps used in row metadata are derived from
 *     Date.now() at action-receive time; this is acceptable because the
 *     reducer remains deterministic for any given (state, action) pair (the
 *     timestamp does not influence row identity or ordering).
 *   - Tool rows key on `tool_call_id` (D-05 / D-11). The same tool_call_id
 *     surfaces in `requires_confirmation` and the eventual `tool_call_start`,
 *     so the row mutates in place rather than being duplicated.
 *   - `stepCount` increments ONLY on `tool_call_start` (NOT on
 *     `requires_confirmation`) — RESEARCH §Pitfall 5.
 *   - `stepCount` resets to 0 on `submit_prompt`.
 *   - First `done` event wins; subsequent `done` events are idempotent
 *     (RESEARCH §Pitfall 6).
 *   - Broadcasts whose `session_token` mismatches the current session are
 *     dropped silently (STREAM-04). Synthetic error events that the hook
 *     fabricates carry `session_token: ''`; those bypass the filter so the
 *     reducer can transition to the error state on socket close.
 *   - `denied_by_operator` results transition the row to `'denied'` state
 *     (Phase 19 D-08); the agent loop continues.
 *   - Unknown / forward-compat broadcast types are ignored silently
 *     (STREAM-03).
 */

export type AssistantMsgRow = {
  kind: 'assistant';
  id: string;
  markdown: string;
  isStreaming: boolean;
};

export type OperatorRow = {
  kind: 'operator';
  id: string;
  text: string;
  ts: number;
};

export type ToolRowState =
  | 'awaiting_confirmation'
  | 'pending'
  | 'running'
  | 'done'
  | 'error'
  | 'denied';

export type ToolRow = {
  kind: 'tool';
  toolCallId: string;
  confirmationId?: string;
  label: string;
  command: string;
  args: unknown[];
  cwd?: string;
  zone?: 'deny_list' | 'outside_list';
  reason?: string;
  state: ToolRowState;
  startedAt: number;
  endedAt?: number;
  result?: {
    stdout?: string;
    stderr?: string;
    exit?: number;
    elapsed_seconds?: number;
    error?: string;
  };
};

export type Row = AssistantMsgRow | OperatorRow | ToolRow;

export type PanelStatus =
  | 'idle'
  | 'streaming'
  | 'awaiting_confirmation'
  | 'halted_quota'
  | 'error';

export interface TranscriptState {
  rows: Row[];
  sessionToken: string | null;
  stepCount: number;
  status: PanelStatus;
  /**
   * Set true once the 80% quota_warning broadcast has fired this run; reset
   * on submit_prompt so each new run can fire again. The backend already
   * guarantees once-per-run delivery; this is a UI-side guard so the panel
   * can suppress duplicate Toasts if the reducer is re-played.
   */
  quotaWarningShown: boolean;
}

export const initialTranscriptState: TranscriptState = {
  rows: [],
  sessionToken: null,
  stepCount: 0,
  status: 'idle',
  quotaWarningShown: false,
};

export type TranscriptAction =
  | { type: 'submit_prompt'; text: string; sessionToken: string }
  | { type: 'broadcast'; broadcast: AssistantBroadcast };

// Tiny id generator for client-side row keys. uuid is overkill for ephemeral
// React keys that never leave the browser. Monotonic-enough for our purposes.
let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  return `r-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/**
 * Synthetic error events (connection_lost, stream_out_of_order) are emitted
 * by `useAssistantChannel` outside any session and arrive with
 * `session_token: ''`. They must bypass the session_token filter so the
 * panel can transition to the error state without waiting for a backend
 * broadcast that will never arrive.
 */
function isSyntheticErrorEvent(b: AssistantBroadcast): boolean {
  return b.type === 'error' && b.session_token === '';
}

export function transcriptReducer(
  state: TranscriptState,
  action: TranscriptAction,
): TranscriptState {
  switch (action.type) {
    case 'submit_prompt': {
      const operatorRow: OperatorRow = {
        kind: 'operator',
        id: makeId(),
        text: action.text,
        ts: Date.now(),
      };
      return {
        rows: [...state.rows, operatorRow],
        sessionToken: action.sessionToken,
        stepCount: 0,
        status: 'streaming',
        quotaWarningShown: false,
      };
    }

    case 'broadcast': {
      const msg = action.broadcast;

      // STREAM-04: drop broadcasts whose session_token mismatches the
      // current session. Synthetic hook events bypass this filter.
      if (
        !isSyntheticErrorEvent(msg) &&
        state.sessionToken !== null &&
        msg.session_token !== state.sessionToken
      ) {
        return state;
      }

      switch (msg.type) {
        case 'token': {
          const last = state.rows[state.rows.length - 1];
          if (last && last.kind === 'assistant' && last.isStreaming) {
            const updated: AssistantMsgRow = {
              ...last,
              markdown: last.markdown + msg.content,
            };
            return {
              ...state,
              rows: [...state.rows.slice(0, -1), updated],
            };
          }
          const newRow: AssistantMsgRow = {
            kind: 'assistant',
            id: makeId(),
            markdown: msg.content,
            isStreaming: true,
          };
          return {
            ...state,
            rows: [...state.rows, newRow],
            status: 'streaming',
          };
        }

        case 'requires_confirmation': {
          // D-11: requires_confirmation carries tool_call_id; rows key on it
          // directly so an earlier `tool_call_start` for the same call shares
          // this row. AgentRunner emits tool_call_start before invoking the
          // tool (whose `await_confirmation` then fires this broadcast), so a
          // row already exists in `running` state by the time we get here --
          // mutate it back into `awaiting_confirmation` rather than appending
          // a duplicate row that would never receive its tool_call_result.
          const existingIdx = state.rows.findIndex(
            (r) => r.kind === 'tool' && r.toolCallId === msg.tool_call_id,
          );
          if (existingIdx >= 0) {
            const rows = state.rows.slice();
            const existing = rows[existingIdx] as ToolRow;
            rows[existingIdx] = {
              ...existing,
              confirmationId: msg.confirmation_id,
              label: msg.label,
              command: msg.command,
              args: msg.args,
              cwd: msg.cwd,
              zone: msg.zone,
              reason: msg.reason,
              state: 'awaiting_confirmation',
            };
            return { ...state, rows, status: 'awaiting_confirmation' };
          }
          const newRow: ToolRow = {
            kind: 'tool',
            toolCallId: msg.tool_call_id,
            confirmationId: msg.confirmation_id,
            label: msg.label,
            command: msg.command,
            args: msg.args,
            cwd: msg.cwd,
            zone: msg.zone,
            reason: msg.reason,
            state: 'awaiting_confirmation',
            startedAt: Date.now(),
          };
          return {
            ...state,
            rows: [...state.rows, newRow],
            status: 'awaiting_confirmation',
          };
        }

        case 'tool_call_start': {
          const existingIdx = state.rows.findIndex(
            (r) => r.kind === 'tool' && r.toolCallId === msg.tool_call_id,
          );
          if (existingIdx >= 0) {
            // Operator-allowed confirmation: existing row transitions
            // awaiting_confirmation → running. (D-05 / D-11.)
            const rows = state.rows.slice();
            const existing = rows[existingIdx] as ToolRow;
            rows[existingIdx] = {
              ...existing,
              state: 'running',
              startedAt: Date.now(),
            };
            return {
              ...state,
              rows,
              stepCount: state.stepCount + 1,
              status: 'streaming',
            };
          }
          // Auto-allowed tool: insert a new row in running state. The wire
          // envelope's `args` is an opaque object (`{ binary, args }` for
          // run_command, free-shape for other tools); we surface what we can
          // for the placeholder render and leave deeper extraction for 20-08.
          const argsField = msg.args as
            | { binary?: string; args?: unknown[] }
            | undefined;
          const newRow: ToolRow = {
            kind: 'tool',
            toolCallId: msg.tool_call_id,
            label: msg.label,
            command: argsField?.binary ?? msg.name,
            args: argsField?.args ?? [],
            cwd: msg.cwd,
            state: 'running',
            startedAt: Date.now(),
          };
          return {
            ...state,
            rows: [...state.rows, newRow],
            stepCount: state.stepCount + 1,
            status: 'streaming',
          };
        }

        case 'tool_call_result': {
          const idx = state.rows.findIndex(
            (r) => r.kind === 'tool' && r.toolCallId === msg.tool_call_id,
          );
          if (idx < 0) return state;
          const existing = state.rows[idx] as ToolRow;
          const errorVal = msg.result?.error;
          const isDeny = errorVal === 'denied_by_operator';
          const isError = !!errorVal && !isDeny;
          const nextState: ToolRowState = isDeny
            ? 'denied'
            : isError
              ? 'error'
              : 'done';
          const rows = state.rows.slice();
          rows[idx] = {
            ...existing,
            state: nextState,
            result: msg.result,
            endedAt: Date.now(),
          };
          return { ...state, rows };
        }

        case 'quota_warning': {
          // Side effect (Toast) handled by the panel via useEffect on this
          // flag. The reducer just sets the once-per-cycle flag.
          if (state.quotaWarningShown) return state;
          return { ...state, quotaWarningShown: true };
        }

        case 'done': {
          // First done wins; subsequent done events are idempotent.
          if (
            state.status !== 'streaming' &&
            state.status !== 'awaiting_confirmation'
          ) {
            return state;
          }
          const nextStatus: PanelStatus =
            msg.stop_reason === 'quota' ? 'halted_quota' : 'idle';
          return {
            ...state,
            status: nextStatus,
            rows: state.rows.map((r) =>
              r.kind === 'assistant' && r.isStreaming
                ? { ...r, isStreaming: false }
                : r,
            ),
          };
        }

        case 'error': {
          return {
            ...state,
            status: 'error',
            rows: state.rows.map((r) =>
              r.kind === 'assistant' && r.isStreaming
                ? { ...r, isStreaming: false }
                : r,
            ),
          };
        }

        default:
          // Forward-compat (STREAM-03): unknown broadcast types are ignored.
          return state;
      }
    }

    default:
      return state;
  }
}
