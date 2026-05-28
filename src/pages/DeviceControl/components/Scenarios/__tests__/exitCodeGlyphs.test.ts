import { describe, expect, it } from "vitest";

import {
  GLYPH_CATALOG,
  STATUS_BADGE_CLASS,
  buildExitCodeTimeline,
} from "../exitCodeGlyphs";
import type {
  ScenarioRun,
  ScenarioRunStep,
  ScenarioRunStepStatus,
} from "src/services/backend/scenarioRunsService";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStep(
  i: number,
  status: ScenarioRunStepStatus,
  overrides: Partial<ScenarioRunStep> = {},
): ScenarioRunStep {
  return {
    id: `step-${i}`,
    scenario_run_id: "run-1",
    step_index: i,
    binary: "/bin/echo",
    status,
    exit_code: status === "success" ? 0 : 1,
    stderr_first_line: null,
    started_at: "2026-05-19T00:00:00Z",
    ended_at: "2026-05-19T00:00:01Z",
    duration_ms: 1000,
    ...overrides,
  };
}

function makeRun(
  status: ScenarioRun["status"] = "completed",
  overrides: Partial<ScenarioRun> = {},
): ScenarioRun {
  return {
    id: "run-1",
    user_id: "user-1",
    device_id: "dev-1",
    scenario_id: "scen-1",
    scenario_name_snapshot: "Diagnose nginx",
    step_count: 3,
    started_at: "2026-05-19T00:00:00Z",
    ended_at: "2026-05-19T00:00:30Z",
    status,
    failed_step_index: null,
    total_ai_gen_tokens: null,
    created_at: "2026-05-19T00:00:00Z",
    updated_at: "2026-05-19T00:00:30Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// GLYPH_CATALOG
// ---------------------------------------------------------------------------

describe("GLYPH_CATALOG", () => {
  const expected: Record<string, string> = {
    success: "✓",
    failed: "✗",
    skipped: "⊘",
    policy_denied: "⛔",
    timeout: "⏱",
    running: "⋯",
    user_stopped: "⏸",
    access_revoked: "⚠",
  };

  for (const [status, glyph] of Object.entries(expected)) {
    it(`maps '${status}' to glyph '${glyph}' with a non-empty colorClass`, () => {
      const entry = (
        GLYPH_CATALOG as Record<string, { glyph: string; colorClass: string }>
      )[status];
      expect(entry).toBeDefined();
      expect(entry.glyph).toBe(glyph);
      expect(entry.colorClass.length).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// STATUS_BADGE_CLASS
// ---------------------------------------------------------------------------

describe("STATUS_BADGE_CLASS", () => {
  const checks: Array<[ScenarioRun["status"], string]> = [
    ["running", "blue"],
    ["completed", "green"],
    ["failed", "red"],
    ["error", "red"],
    ["policy_deny", "red"],
    ["user_stopped", "amber"],
    ["access_revoked", "amber"],
    ["tab_closed", "amber"],
    ["abandoned", "amber"],
  ];

  for (const [status, colorToken] of checks) {
    it(`maps '${status}' badge class to a string containing '${colorToken}'`, () => {
      const cls = STATUS_BADGE_CLASS[status];
      expect(cls).toBeDefined();
      expect(cls).toContain(colorToken);
    });
  }
});

// ---------------------------------------------------------------------------
// buildExitCodeTimeline
// ---------------------------------------------------------------------------

describe("buildExitCodeTimeline", () => {
  it("returns 3 entries in order for [success, success, failed]", () => {
    const steps = [
      makeStep(0, "success"),
      makeStep(1, "success"),
      makeStep(2, "failed"),
    ];
    const result = buildExitCodeTimeline(makeRun("failed"), steps);
    expect(result).toHaveLength(3);
    expect(result[0].glyph).toBe("✓");
    expect(result[1].glyph).toBe("✓");
    expect(result[2].glyph).toBe("✗");
  });

  it('truncates to 11 visible + 1 overflow entry "+2" for 13 success steps', () => {
    const steps = Array.from({ length: 13 }, (_, i) => makeStep(i, "success"));
    const result = buildExitCodeTimeline(makeRun("completed"), steps);
    expect(result).toHaveLength(12);
    // 11 success glyphs + 1 overflow
    for (let i = 0; i < 11; i++) {
      expect(result[i].glyph).toBe("✓");
    }
    expect(result[11].glyph).toBe("+2");
    expect(result[11].key).toBe("overflow");
  });

  it("returns exactly 12 entries (no overflow) for 12 success steps", () => {
    const steps = Array.from({ length: 12 }, (_, i) => makeStep(i, "success"));
    const result = buildExitCodeTimeline(makeRun("completed"), steps);
    expect(result).toHaveLength(12);
    for (const entry of result) {
      expect(entry.glyph).toBe("✓");
    }
  });

  it("appends a synthetic ⚠ glyph at the end when run.status is access_revoked", () => {
    const steps = [makeStep(0, "success"), makeStep(1, "skipped")];
    const result = buildExitCodeTimeline(makeRun("access_revoked"), steps);
    expect(result).toHaveLength(3);
    expect(result[0].glyph).toBe("✓");
    expect(result[1].glyph).toBe("⊘");
    expect(result[2].glyph).toBe("⚠");
  });

  it("does not throw and returns an empty array when steps is undefined", () => {
    const result = buildExitCodeTimeline(makeRun("completed"));
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("produces unique React keys across entries", () => {
    const steps = Array.from({ length: 13 }, (_, i) => makeStep(i, "success"));
    const result = buildExitCodeTimeline(makeRun("completed"), steps);
    const keys = result.map((r) => r.key);
    const uniq = new Set(keys);
    expect(uniq.size).toBe(keys.length);
  });

  it("uses step.id as the key when available", () => {
    const steps = [makeStep(0, "success", { id: "step-aaa" })];
    const result = buildExitCodeTimeline(makeRun("completed"), steps);
    expect(result[0].key).toBe("step-aaa");
  });

  it("does not synthesize the ⚠ glyph for non-access_revoked runs", () => {
    const steps = [makeStep(0, "success")];
    const result = buildExitCodeTimeline(makeRun("completed"), steps);
    expect(result).toHaveLength(1);
    expect(result[0].glyph).toBe("✓");
  });

  it("caps the access_revoked synthetic glyph within the 12-cap (overflow stays last)", () => {
    const steps = Array.from({ length: 13 }, (_, i) => makeStep(i, "success"));
    const result = buildExitCodeTimeline(makeRun("access_revoked"), steps);
    // 11 successes + overflow "+N" + access_revoked ⚠ would exceed 12; the
    // helper guarantees a 12-entry cap with the ⚠ as the trailing entry.
    expect(result).toHaveLength(12);
    expect(result[result.length - 1].glyph).toBe("⚠");
  });

  it("maps each per-step status correctly through GLYPH_CATALOG", () => {
    const steps: ScenarioRunStep[] = [
      makeStep(0, "success"),
      makeStep(1, "failed"),
      makeStep(2, "skipped"),
      makeStep(3, "policy_denied"),
      makeStep(4, "timeout"),
    ];
    const result = buildExitCodeTimeline(makeRun("failed"), steps);
    expect(result.map((r) => r.glyph)).toEqual(["✓", "✗", "⊘", "⛔", "⏱"]);
  });
});
