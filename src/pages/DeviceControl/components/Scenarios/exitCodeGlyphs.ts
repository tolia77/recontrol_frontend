import type {
  ScenarioRun,
  ScenarioRunStatus,
  ScenarioRunStep,
  ScenarioRunStepStatus,
} from "src/services/backend/scenarioRunsService";

// GLYPH_CATALOG — single source of truth for the exit-code timeline.

type GlyphCatalogKey =
  | ScenarioRunStepStatus
  | "user_stopped"
  | "access_revoked";

interface GlyphEntry {
  glyph: string;
  colorClass: string;
}

export const GLYPH_CATALOG: Readonly<Record<GlyphCatalogKey, GlyphEntry>> = {
  success: { glyph: "✓", colorClass: "text-success" },
  failed: { glyph: "✗", colorClass: "text-destructive" },
  skipped: { glyph: "⊘", colorClass: "text-muted-foreground" },
  policy_denied: { glyph: "⛔", colorClass: "text-destructive" },
  timeout: { glyph: "⏱", colorClass: "text-warning" },
  running: { glyph: "⋯", colorClass: "text-primary" },
  user_stopped: { glyph: "⏸", colorClass: "text-warning" },
  access_revoked: { glyph: "⚠", colorClass: "text-warning" },
} as const;

// STATUS_BADGE_CLASS — per-run status badge color mapping.

export const STATUS_BADGE_CLASS: Readonly<Record<ScenarioRunStatus, string>> = {
  running: "bg-primary/8 text-primary",
  completed: "bg-success/10 text-success",
  failed: "bg-destructive/10 text-destructive",
  error: "bg-destructive/10 text-destructive",
  policy_deny: "bg-destructive/10 text-destructive",
  user_stopped: "bg-warning/10 text-warning",
  access_revoked: "bg-warning/10 text-warning",
  tab_closed: "bg-warning/10 text-warning",
  abandoned: "bg-warning/10 text-warning",
} as const;

// buildExitCodeTimeline — pure helper. Maps per-step statuses to glyph entries
// with a 12-cap and synthesizes a trailing ⚠ glyph when run.status is
// 'access_revoked'.

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
      colorClass: "text-muted-foreground",
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
