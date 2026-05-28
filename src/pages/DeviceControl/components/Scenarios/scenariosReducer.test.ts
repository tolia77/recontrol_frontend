// scenariosReducer vitest (Phase 22 Plan 06 Task 3).
//
// Coverage:
//   - mapStopReasonToStatus: all eight terminal reasons + unknown → 'error'
//   - initialScenariosState shape
//   - segment_set toggle
//   - run_launch initializes activeRun + transcript sessionToken=runId
//   - broadcast — run_started: no-op when activeRun matches; bootstraps from-null
//   - broadcast — scenario_step_skipped: appends to skipped; ignored when null;
//     ignored on run_id mismatch
//   - broadcast — tool_call_start delegation: transcript.rows grows
//   - broadcast — tool_call_result delegation: row transitions to done
//   - broadcast — done idempotent: first wins; second is no-op
//   - broadcast — error sets status='error' when activeRun present; no-op when null
//   - run_stop_requested: running → stopping; no-op on terminal
//   - run_clear: full reset
//   - cross-run defense: broadcast with mismatched run_id is ignored entirely

import { describe, expect, it } from "vitest";

import {
  scenariosReducer,
  initialScenariosState,
  mapStopReasonToStatus,
  type ScenariosState,
  type ScenariosAction,
  type ActiveRun,
} from "./scenariosReducer";
import type { ScenarioRunBroadcast } from "src/pages/DeviceControl/hooks/realtime/useScenarioRunChannel";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function launch(
  state: ScenariosState,
  overrides?: Partial<ActiveRun>,
): ScenariosState {
  const action: ScenariosAction = {
    type: "run_launch",
    runId: overrides?.runId ?? "run-1",
    scenarioId: overrides?.scenarioId ?? "s-1",
    scenarioName: overrides?.scenarioName ?? "Test",
    deviceId: overrides?.deviceId ?? "d-1",
    stepCount: overrides?.stepCount ?? 3,
    startedAt: overrides?.startedAt ?? 1_700_000_000_000,
  };
  return scenariosReducer(state, action);
}

function broadcast(
  state: ScenariosState,
  msg: ScenarioRunBroadcast,
): ScenariosState {
  return scenariosReducer(state, { type: "broadcast", broadcast: msg });
}

// ----------------------------------------------------------------------------
// mapStopReasonToStatus
// ----------------------------------------------------------------------------

describe("mapStopReasonToStatus", () => {
  it("maps each of the eight terminal reasons to the matching ActiveRunStatus", () => {
    expect(mapStopReasonToStatus("completed")).toBe("completed");
    expect(mapStopReasonToStatus("failed")).toBe("failed");
    expect(mapStopReasonToStatus("user_stopped")).toBe("user_stopped");
    expect(mapStopReasonToStatus("policy_deny")).toBe("policy_deny");
    expect(mapStopReasonToStatus("access_revoked")).toBe("access_revoked");
    expect(mapStopReasonToStatus("tab_closed")).toBe("tab_closed");
    expect(mapStopReasonToStatus("abandoned")).toBe("abandoned");
    expect(mapStopReasonToStatus("error")).toBe("error");
  });

  it('maps unknown stop_reason to "error" as a fallback', () => {
    expect(mapStopReasonToStatus("garbage")).toBe("error");
    expect(mapStopReasonToStatus("")).toBe("error");
  });
});

// ----------------------------------------------------------------------------
// initialScenariosState
// ----------------------------------------------------------------------------

describe("initialScenariosState", () => {
  it('has activeRun=null and segment="library"', () => {
    expect(initialScenariosState.activeRun).toBeNull();
    expect(initialScenariosState.segment).toBe("library");
  });
});

// ----------------------------------------------------------------------------
// segment_set
// ----------------------------------------------------------------------------

describe("segment_set", () => {
  it("toggles between library and history", () => {
    let s = initialScenariosState;
    s = scenariosReducer(s, { type: "segment_set", segment: "history" });
    expect(s.segment).toBe("history");
    s = scenariosReducer(s, { type: "segment_set", segment: "library" });
    expect(s.segment).toBe("library");
  });

  it("returns the same state object when segment is unchanged", () => {
    const s = initialScenariosState;
    const next = scenariosReducer(s, {
      type: "segment_set",
      segment: "library",
    });
    expect(next).toBe(s);
  });

  it('accepts the "ai" segment (Phase 23 widening)', () => {
    let s: ScenariosState = initialScenariosState;
    s = scenariosReducer(s, { type: "segment_set", segment: "ai" });
    expect(s.segment).toBe("ai");
    // Round-trip through library + history to prove the widened union has
    // no exhaustiveness regressions in the segment_set branch.
    s = scenariosReducer(s, { type: "segment_set", segment: "history" });
    expect(s.segment).toBe("history");
    s = scenariosReducer(s, { type: "segment_set", segment: "ai" });
    expect(s.segment).toBe("ai");
  });
});

// ----------------------------------------------------------------------------
// run_launch
// ----------------------------------------------------------------------------

describe("run_launch", () => {
  it('initializes activeRun with status="running", empty skipped, and transcript sessionToken=runId', () => {
    const s = launch(initialScenariosState, { runId: "r-abc", stepCount: 5 });
    const run = s.activeRun!;
    expect(run.runId).toBe("r-abc");
    expect(run.stepCount).toBe(5);
    expect(run.status).toBe("running");
    expect(run.skipped).toEqual([]);
    expect(run.transcript.sessionToken).toBe("r-abc");
    expect(run.transcript.rows).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// broadcast — run_started
// ----------------------------------------------------------------------------

describe("broadcast — run_started", () => {
  it("is a no-op when activeRun already matches the broadcast run_id", () => {
    const s1 = launch(initialScenariosState, { runId: "r-x" });
    const s2 = broadcast(s1, {
      type: "run_started",
      seq: 1,
      session_token: "r-x",
      run_id: "r-x",
      scenario_id: "s-1",
      started_at: "2026-05-17T00:00:00Z",
      step_count: 3,
    });
    // Same reference — no state change.
    expect(s2).toBe(s1);
  });

  it("initializes activeRun from the broadcast when activeRun is null", () => {
    const s = broadcast(initialScenariosState, {
      type: "run_started",
      seq: 1,
      session_token: "r-y",
      run_id: "r-y",
      scenario_id: "s-y",
      started_at: "2026-05-17T01:00:00Z",
      step_count: 2,
    });
    expect(s.activeRun).not.toBeNull();
    expect(s.activeRun!.runId).toBe("r-y");
    expect(s.activeRun!.stepCount).toBe(2);
    expect(s.activeRun!.status).toBe("running");
    expect(s.activeRun!.transcript.sessionToken).toBe("r-y");
  });
});

// ----------------------------------------------------------------------------
// broadcast — scenario_step_skipped
// ----------------------------------------------------------------------------

describe("broadcast — scenario_step_skipped", () => {
  it("appends to skipped[] preserving order", () => {
    let s = launch(initialScenariosState);
    s = broadcast(s, {
      type: "scenario_step_skipped",
      seq: 5,
      session_token: "run-1",
      run_id: "run-1",
      step_index: 2,
      reason: "previous_step_failed",
    });
    s = broadcast(s, {
      type: "scenario_step_skipped",
      seq: 6,
      session_token: "run-1",
      run_id: "run-1",
      step_index: 3,
      reason: "previous_step_failed",
    });
    expect(s.activeRun!.skipped).toEqual([
      { stepIndex: 2, reason: "previous_step_failed" },
      { stepIndex: 3, reason: "previous_step_failed" },
    ]);
  });

  it("is ignored when activeRun is null", () => {
    const s = broadcast(initialScenariosState, {
      type: "scenario_step_skipped",
      seq: 1,
      session_token: "whatever",
      run_id: "run-stale",
      step_index: 0,
      reason: "user_stopped",
    });
    expect(s).toBe(initialScenariosState);
  });

  it("is ignored when run_id mismatches the current activeRun", () => {
    const before = launch(initialScenariosState, { runId: "run-A" });
    const after = broadcast(before, {
      type: "scenario_step_skipped",
      seq: 1,
      session_token: "run-A",
      run_id: "run-B", // mismatched
      step_index: 0,
      reason: "user_stopped",
    });
    expect(after).toBe(before);
  });
});

// ----------------------------------------------------------------------------
// transcript delegation
// ----------------------------------------------------------------------------

describe("broadcast — tool_call_start delegation", () => {
  it("grows the transcript.rows by one ToolRow in running state", () => {
    let s = launch(initialScenariosState);
    s = broadcast(s, {
      type: "tool_call_start",
      seq: 2,
      session_token: "run-1",
      tool_call_id: "tc-1",
      name: "run_command",
      label: "echo hi",
      args: { binary: "echo", args: ["hi"] },
    });
    expect(s.activeRun!.transcript.rows).toHaveLength(1);
    const row = s.activeRun!.transcript.rows[0];
    expect(row.kind).toBe("tool");
    if (row.kind === "tool") {
      expect(row.state).toBe("running");
      expect(row.toolCallId).toBe("tc-1");
    }
  });
});

describe("broadcast — tool_call_result delegation", () => {
  it("transitions the matching ToolRow to done state with the result populated", () => {
    let s = launch(initialScenariosState);
    s = broadcast(s, {
      type: "tool_call_start",
      seq: 2,
      session_token: "run-1",
      tool_call_id: "tc-1",
      name: "run_command",
      label: "l",
      args: {},
    });
    s = broadcast(s, {
      type: "tool_call_result",
      seq: 3,
      session_token: "run-1",
      tool_call_id: "tc-1",
      result: { exit: 0, stdout: "hi" },
    });
    const row = s.activeRun!.transcript.rows[0];
    expect(row.kind).toBe("tool");
    if (row.kind === "tool") {
      expect(row.state).toBe("done");
      expect(row.result?.exit).toBe(0);
    }
  });
});

// ----------------------------------------------------------------------------
// done idempotent
// ----------------------------------------------------------------------------

describe("broadcast — done idempotent", () => {
  it("first done sets terminal status; second done is ignored", () => {
    let s = launch(initialScenariosState);
    s = broadcast(s, {
      type: "done",
      seq: 9,
      session_token: "run-1",
      stop_reason: "completed",
    });
    expect(s.activeRun!.status).toBe("completed");

    const before = s;
    s = broadcast(s, {
      type: "done",
      seq: 10,
      session_token: "run-1",
      stop_reason: "failed",
    });
    expect(s).toBe(before); // no-op — terminal already
    expect(s.activeRun!.status).toBe("completed");
  });

  it("records failed_step_index when present on done", () => {
    let s = launch(initialScenariosState);
    s = broadcast(s, {
      type: "done",
      seq: 9,
      session_token: "run-1",
      stop_reason: "failed",
      failed_step_index: 2,
    });
    expect(s.activeRun!.status).toBe("failed");
    expect(s.activeRun!.failedStepIndex).toBe(2);
  });
});

// ----------------------------------------------------------------------------
// error broadcast
// ----------------------------------------------------------------------------

describe("broadcast — error sets status to error when activeRun present", () => {
  it("transitions activeRun.status to error", () => {
    let s = launch(initialScenariosState);
    s = broadcast(s, {
      type: "error",
      message: "connection_lost",
      source: "connection_lost",
    });
    expect(s.activeRun!.status).toBe("error");
  });

  it("is a no-op when activeRun is null", () => {
    const s = broadcast(initialScenariosState, {
      type: "error",
      message: "run_in_progress",
    });
    expect(s).toBe(initialScenariosState);
  });

  it("is a no-op when activeRun.status is already terminal", () => {
    let s = launch(initialScenariosState);
    s = broadcast(s, {
      type: "done",
      seq: 9,
      session_token: "run-1",
      stop_reason: "completed",
    });
    const before = s;
    s = broadcast(s, { type: "error", message: "whatever" });
    expect(s).toBe(before);
    expect(s.activeRun!.status).toBe("completed");
  });
});

// ----------------------------------------------------------------------------
// run_stop_requested
// ----------------------------------------------------------------------------

describe("run_stop_requested transitions running -> stopping", () => {
  it("flips running to stopping", () => {
    let s = launch(initialScenariosState);
    s = scenariosReducer(s, { type: "run_stop_requested" });
    expect(s.activeRun!.status).toBe("stopping");
  });

  it("is a no-op on terminal status", () => {
    let s = launch(initialScenariosState);
    s = broadcast(s, {
      type: "done",
      seq: 1,
      session_token: "run-1",
      stop_reason: "completed",
    });
    const before = s;
    s = scenariosReducer(s, { type: "run_stop_requested" });
    expect(s).toBe(before);
  });

  it("is a no-op when activeRun is null", () => {
    const s = scenariosReducer(initialScenariosState, {
      type: "run_stop_requested",
    });
    expect(s).toBe(initialScenariosState);
  });
});

// ----------------------------------------------------------------------------
// run_clear
// ----------------------------------------------------------------------------

describe("run_clear sets activeRun to null", () => {
  it("full reset from a populated activeRun", () => {
    let s = launch(initialScenariosState);
    s = scenariosReducer(s, { type: "run_clear" });
    expect(s.activeRun).toBeNull();
  });

  it("is a no-op when activeRun is already null", () => {
    const s = scenariosReducer(initialScenariosState, { type: "run_clear" });
    expect(s).toBe(initialScenariosState);
  });
});

// ----------------------------------------------------------------------------
// cross-run defense
// ----------------------------------------------------------------------------

describe("cross-run defense", () => {
  it("broadcast with mismatched run_id leaves state untouched (no skipped append, no transcript change)", () => {
    let s = launch(initialScenariosState, { runId: "current-run" });
    s = broadcast(s, {
      type: "tool_call_start",
      seq: 2,
      session_token: "current-run",
      tool_call_id: "tc-1",
      name: "run_command",
      label: "l",
      args: {},
    });
    expect(s.activeRun!.transcript.rows).toHaveLength(1);

    const before = s;
    // Late-arriving broadcast from a previous run.
    s = broadcast(s, {
      type: "scenario_step_skipped",
      seq: 99,
      session_token: "previous-run",
      run_id: "previous-run",
      step_index: 1,
      reason: "user_stopped",
    });
    expect(s).toBe(before);
    expect(s.activeRun!.skipped).toEqual([]);
    expect(s.activeRun!.transcript.rows).toHaveLength(1);
  });
});
