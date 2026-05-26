// Unit coverage for the pure transcriptReducer (Plan 20-07).
//
// Strategy:
//   - Reducer is pure ⇒ no React Testing Library, no fake timers; we build
//     state by chaining reducer calls and assert on the returned shape.
//   - One example per critical invariant (RESEARCH §Pitfall 5, §Pitfall 6,
//     STREAM-04 session_token filter, D-05/D-11 tool row correlation,
//     D-07 halted_quota transition, D-08 denied_by_operator → denied row
//     state, hook-synthesized connection_lost error bypass).
//   - vitest.config.ts has globals:false, so describe/expect/it are explicit
//     imports (mirrors selectPillState.test.ts).
import { describe, expect, it } from "vitest";
import {
  initialTranscriptState,
  transcriptReducer,
  type AssistantMsgRow,
  type ToolRow,
  type TranscriptAction,
  type TranscriptState,
} from "./transcriptReducer";
import type { AssistantBroadcast } from "../../hooks/useAssistantChannel";

function broadcast(b: AssistantBroadcast): TranscriptAction {
  return { type: "broadcast", broadcast: b };
}

function submit(text: string, sessionToken = "sess"): TranscriptAction {
  return { type: "submit_prompt", text, sessionToken };
}

describe("transcriptReducer", () => {
  it("submit_prompt appends operator row, resets stepCount, sets sessionToken, flips to streaming", () => {
    const next = transcriptReducer(
      initialTranscriptState,
      submit("hello", "sess-1"),
    );
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0]).toMatchObject({ kind: "operator", text: "hello" });
    expect(next.sessionToken).toBe("sess-1");
    expect(next.stepCount).toBe(0);
    expect(next.status).toBe("streaming");
    expect(next.quotaWarningShown).toBe(false);
  });

  it("submit_prompt resets stepCount and quotaWarningShown when a new run begins", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q1", "s1"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "tool_call_start",
        seq: 0,
        session_token: "s1",
        tool_call_id: "tc-a",
        name: "run_command",
        label: "echo",
        args: { binary: "echo", args: ["hi"] },
      }),
    );
    s = transcriptReducer(
      s,
      broadcast({
        type: "quota_warning",
        seq: 1,
        session_token: "s1",
        percent: 80,
      }),
    );
    expect(s.stepCount).toBe(1);
    expect(s.quotaWarningShown).toBe(true);

    // New prompt resets per-run counters.
    s = transcriptReducer(s, submit("q2", "s2"));
    expect(s.stepCount).toBe(0);
    expect(s.quotaWarningShown).toBe(false);
    expect(s.sessionToken).toBe("s2");
  });

  it("token broadcasts append to the currently streaming assistant row", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({ type: "token", seq: 0, session_token: "s", content: "Hel" }),
    );
    s = transcriptReducer(
      s,
      broadcast({ type: "token", seq: 1, session_token: "s", content: "lo" }),
    );
    const last = s.rows[s.rows.length - 1] as AssistantMsgRow;
    expect(last.kind).toBe("assistant");
    expect(last.markdown).toBe("Hello");
    expect(last.isStreaming).toBe(true);
    // Operator row + assistant row only.
    expect(s.rows).toHaveLength(2);
  });

  it("starts a new assistant row when the previous one finished streaming (mid-loop assistant message)", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "token",
        seq: 0,
        session_token: "s",
        content: "first",
      }),
    );
    // Done flips isStreaming false on existing assistant row.
    s = transcriptReducer(
      s,
      broadcast({
        type: "done",
        seq: 1,
        session_token: "s",
        stop_reason: "completed",
      }),
    );
    // Hypothetical second prompt and follow-up tokens would not happen in
    // the same run; this test instead asserts that a *new* assistant row is
    // appended if a stray token arrives after done. The reducer should treat
    // it as a new streaming row.
    s = transcriptReducer(
      s,
      broadcast({
        type: "token",
        seq: 2,
        session_token: "s",
        content: "second",
      }),
    );
    const assistantRows = s.rows.filter(
      (r) => r.kind === "assistant",
    ) as AssistantMsgRow[];
    expect(assistantRows).toHaveLength(2);
    expect(assistantRows[0].markdown).toBe("first");
    expect(assistantRows[0].isStreaming).toBe(false);
    expect(assistantRows[1].markdown).toBe("second");
    expect(assistantRows[1].isStreaming).toBe(true);
  });

  it("drops broadcasts whose session_token mismatches the current session (STREAM-04)", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "sess-A"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "token",
        seq: 0,
        session_token: "sess-B",
        content: "stale",
      }),
    );
    // Only the operator row; the stale token did not create an assistant row.
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].kind).toBe("operator");
  });

  it("requires_confirmation + tool_call_start collapse into ONE tool row (D-05 / D-11)", () => {
    let s: TranscriptState = transcriptReducer(
      initialTranscriptState,
      submit("q", "s"),
    );
    s = transcriptReducer(
      s,
      broadcast({
        type: "requires_confirmation",
        seq: 0,
        session_token: "s",
        confirmation_id: "conf-1",
        tool_call_id: "tc-1",
        label: "Run command",
        command: "rm",
        args: ["-rf", "/tmp/x"],
        reason: "deny_list",
        zone: "deny_list",
      }),
    );
    let toolRows = s.rows.filter((r): r is ToolRow => r.kind === "tool");
    expect(toolRows).toHaveLength(1);
    expect(toolRows[0].state).toBe("awaiting_confirmation");
    expect(s.status).toBe("awaiting_confirmation");

    s = transcriptReducer(
      s,
      broadcast({
        type: "tool_call_start",
        seq: 1,
        session_token: "s",
        tool_call_id: "tc-1",
        name: "run_command",
        label: "Run command",
        args: {},
      }),
    );
    toolRows = s.rows.filter((r): r is ToolRow => r.kind === "tool");
    expect(toolRows).toHaveLength(1);
    expect(toolRows[0].state).toBe("running");
    expect(s.stepCount).toBe(1);
    expect(s.status).toBe("streaming");
  });

  it("stepCount increments on tool_call_start only, not on requires_confirmation (RESEARCH §Pitfall 5)", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "requires_confirmation",
        seq: 0,
        session_token: "s",
        confirmation_id: "c1",
        tool_call_id: "t1",
        label: "x",
        command: "rm",
        args: [],
        reason: "deny_list",
        zone: "deny_list",
      }),
    );
    expect(s.stepCount).toBe(0);

    s = transcriptReducer(
      s,
      broadcast({
        type: "tool_call_start",
        seq: 1,
        session_token: "s",
        tool_call_id: "t1",
        name: "run_command",
        label: "x",
        args: {},
      }),
    );
    expect(s.stepCount).toBe(1);
  });

  it("auto-allowed tool_call_start inserts a fresh running row (no preceding confirmation)", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "tool_call_start",
        seq: 0,
        session_token: "s",
        tool_call_id: "auto-1",
        name: "run_command",
        label: "ls",
        args: { binary: "ls", args: ["-la"] },
      }),
    );
    const toolRows = s.rows.filter((r): r is ToolRow => r.kind === "tool");
    expect(toolRows).toHaveLength(1);
    expect(toolRows[0].state).toBe("running");
    expect(toolRows[0].command).toBe("ls");
    expect(toolRows[0].args).toEqual(["-la"]);
    expect(s.stepCount).toBe(1);
  });

  it("tool_call_result with no error transitions row to done", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "tool_call_start",
        seq: 0,
        session_token: "s",
        tool_call_id: "tc-2",
        name: "run_command",
        label: "echo",
        args: { binary: "echo", args: ["ok"] },
      }),
    );
    s = transcriptReducer(
      s,
      broadcast({
        type: "tool_call_result",
        seq: 1,
        session_token: "s",
        tool_call_id: "tc-2",
        result: { stdout: "ok\n", exit: 0, elapsed_seconds: 0.1 },
      }),
    );
    const toolRow = s.rows.find((r): r is ToolRow => r.kind === "tool");
    expect(toolRow?.state).toBe("done");
    expect(toolRow?.result?.stdout).toBe("ok\n");
    expect(toolRow?.endedAt).toBeGreaterThan(0);
  });

  it("tool_call_result with denied_by_operator transitions row to denied, not error (Phase 19 D-08)", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "requires_confirmation",
        seq: 0,
        session_token: "s",
        confirmation_id: "c1",
        tool_call_id: "tc-deny",
        label: "rm",
        command: "rm",
        args: ["-rf", "/"],
        reason: "deny_list",
        zone: "deny_list",
      }),
    );
    s = transcriptReducer(
      s,
      broadcast({
        type: "tool_call_result",
        seq: 1,
        session_token: "s",
        tool_call_id: "tc-deny",
        result: { error: "denied_by_operator" },
      }),
    );
    const toolRow = s.rows.find((r): r is ToolRow => r.kind === "tool");
    expect(toolRow?.state).toBe("denied");
  });

  it("tool_call_result with non-deny error transitions row to error", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "tool_call_start",
        seq: 0,
        session_token: "s",
        tool_call_id: "tc-fail",
        name: "run_command",
        label: "boom",
        args: { binary: "boom", args: [] },
      }),
    );
    s = transcriptReducer(
      s,
      broadcast({
        type: "tool_call_result",
        seq: 1,
        session_token: "s",
        tool_call_id: "tc-fail",
        result: { error: "spawn ENOENT", exit: 127 },
      }),
    );
    const toolRow = s.rows.find((r): r is ToolRow => r.kind === "tool");
    expect(toolRow?.state).toBe("error");
  });

  it("quota_warning flips the once-per-run flag exactly once", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "quota_warning",
        seq: 0,
        session_token: "s",
        percent: 80,
      }),
    );
    expect(s.quotaWarningShown).toBe(true);
    const ref = s;
    // Second quota_warning is a no-op (returns same state reference).
    s = transcriptReducer(
      s,
      broadcast({
        type: "quota_warning",
        seq: 1,
        session_token: "s",
        percent: 80,
      }),
    );
    expect(s).toBe(ref);
  });

  it("first done wins; subsequent done is idempotent (RESEARCH §Pitfall 6)", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "done",
        seq: 0,
        session_token: "s",
        stop_reason: "user_stopped",
      }),
    );
    expect(s.status).toBe("idle");
    const ref = s;
    s = transcriptReducer(
      s,
      broadcast({
        type: "done",
        seq: 1,
        session_token: "s",
        stop_reason: "quota",
      }),
    );
    expect(s.status).toBe("idle");
    // No new state object created — strict idempotence.
    expect(s).toBe(ref);
  });

  it("done(stop_reason: quota) transitions to halted_quota (D-07)", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({
        type: "done",
        seq: 0,
        session_token: "s",
        stop_reason: "quota",
      }),
    );
    expect(s.status).toBe("halted_quota");
  });

  it("error broadcast flips status to error and stops streaming assistant rows", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    s = transcriptReducer(
      s,
      broadcast({ type: "token", seq: 0, session_token: "s", content: "hi" }),
    );
    s = transcriptReducer(
      s,
      broadcast({
        type: "error",
        seq: 1,
        session_token: "s",
        source: "openrouter",
      }),
    );
    expect(s.status).toBe("error");
    const assistantRow = s.rows.find(
      (r): r is AssistantMsgRow => r.kind === "assistant",
    );
    expect(assistantRow?.isStreaming).toBe(false);
  });

  it("synthetic connection_lost error from the hook bypasses the session_token filter", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    // Hook synthesizes session_token: '' on socket close.
    s = transcriptReducer(
      s,
      broadcast({
        type: "error",
        seq: 0,
        session_token: "",
        source: "connection_lost",
      }),
    );
    expect(s.status).toBe("error");
  });

  it("forward-compat: unknown broadcast types are ignored silently (STREAM-03)", () => {
    let s = transcriptReducer(initialTranscriptState, submit("q", "s"));
    const ref = s;
    // Cast through unknown to bypass the discriminated-union check; this
    // simulates a backend rev that ships a new broadcast type the frontend
    // does not know about.
    s = transcriptReducer(
      s,
      broadcast({
        type: "unknown_future_event",
        seq: 99,
        session_token: "s",
      } as unknown as AssistantBroadcast),
    );
    expect(s).toBe(ref);
  });
});
