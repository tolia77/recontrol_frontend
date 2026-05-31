import type {
  ScenarioRun,
  ScenarioRunStatus,
  ScenarioRunStep,
  ScenarioRunStepStatus,
} from "src/services/backend/scenarioRunsService";

// ---------------------------------------------------------------------------
// GLYPH_CATALOG — single source of truth for the exit-code timeline.
// Sourced from UI-SPEC §Exit-code glyph catalog (lines 249-259) + 22-CONTEXT.md
// "Claude's Discretion" exit-code glyph row. Reused by Plan 22.10 HistoryDetail.
// ---------------------------------------------------------------------------

type GlyphCatalogKey =
  | ScenarioRunStepStatus
  | "user_stopped"
  | "access_revoked";

interface GlyphEntry {
  glyph: string;
  colorClass: string;
}

export const GLYPH_CATALOG: Readonly<Record<GlyphCatalogKey, GlyphEntry>> = {
  success: { glyph: "✓", colorClass: "text-green-600" },
  failed: { glyph: "✗", colorClass: "text-error" },
  skipped: { glyph: "⊘", colorClass: "text-darkgray" },
  policy_denied: { glyph: "⛔", colorClass: "text-error" },
  timeout: { glyph: "⏱", colorClass: "text-amber-600" },
  running: { glyph: "⋯", colorClass: "text-secondary" },
  user_stopped: { glyph: "⏸", colorClass: "text-amber-600" },
  access_revoked: { glyph: "⚠", colorClass: "text-amber-600" },
} as const;

// ---------------------------------------------------------------------------
// STATUS_BADGE_CLASS — per-run status badge color mapping.
// Sourced from UI-SPEC §History list status badge colors (lines 240-246).
// ---------------------------------------------------------------------------

export const STATUS_BADGE_CLASS: Readonly<Record<ScenarioRunStatus, string>> = {
  running: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  error: "bg-red-50 text-red-700",
  policy_deny: "bg-red-50 text-red-700",
  user_stopped: "bg-amber-50 text-amber-700",
  access_revoked: "bg-amber-50 text-amber-700",
  tab_closed: "bg-amber-50 text-amber-700",
  abandoned: "bg-amber-50 text-amber-700",
} as const;

// ---------------------------------------------------------------------------
// buildExitCodeTimeline — pure helper. Maps per-step statuses to glyph entries
// with a 12-cap and synthesizes a trailing ⚠ glyph when run.status is
// 'access_revoked'.
// ---------------------------------------------------------------------------

export interface ExitCodeGlyphEntry {
  glyph: string;
  colorClass: string;
  key: string;
}

const MAX_VISIBLE = 12;

export function buildExitCodeTimeline(
  run: ScenarioRun,
  steps?: ScenarioRunStep[],
): ExitCodeGlyphEntry[] {
  // Graceful degrade: when steps is not provided (index() responses omit
  // nested steps), render zero glyphs — the parent renders only the badge.
  if (!steps || steps.length === 0) {
    return [];
  }

  const mapped: ExitCodeGlyphEntry[] = steps.map((step, i) => {
    const entry = GLYPH_CATALOG[step.status];
    return {
      glyph: entry.glyph,
      colorClass: entry.colorClass,
      key: step.id ?? `idx-${i}`,
    };
  });

  const accessRevoked = run.status === "access_revoked";

  // 12-cap budget: when run is access_revoked, reserve the last slot for the
  // synthetic ⚠ glyph so the trailing access-revoked marker is always visible.
  const budget = accessRevoked ? MAX_VISIBLE - 1 : MAX_VISIBLE;

  let result: ExitCodeGlyphEntry[];
  if (mapped.length > budget) {
    // Truncation: keep (budget - 1) visible glyphs + 1 overflow chip "+N".
    const visible = budget - 1;
    const overflowCount = mapped.length - visible;
    const head = mapped.slice(0, visible);
    head.push({
      glyph: `+${overflowCount}`,
      colorClass: "text-darkgray",
      key: "overflow",
    });
    result = head;
  } else {
    result = mapped;
  }

  if (accessRevoked) {
    const ar = GLYPH_CATALOG.access_revoked;
    result = [
      ...result,
      { glyph: ar.glyph, colorClass: ar.colorClass, key: "access-revoked" },
    ];
  }

  return result;
}
