/**
 * AUDIT ONLY — temporary render-count instrument for Phase 42.2 frontend audit.
 * REMOVE THIS FILE after the audit is complete (tracked in Plan 42.2-04, D-04).
 *
 * Wraps a JSX subtree in a React <Profiler> that:
 *   1. Increments a per-id counter on every commit.
 *   2. Emits the count into the frontendLogger ring buffer (silent, no console).
 *
 * IMPORTANT — StrictMode correction:
 *   main.tsx wraps the app in <StrictMode>. In dev, React 19 StrictMode
 *   double-invokes render functions, so Profiler onRender fires twice per
 *   logical mount. Divide raw mount counts by 2 when interpreting audit data.
 *   Filter `phase === 'nested-update'` when counting user-driven re-renders.
 *
 * NOTE: React strips Profiler callbacks in production builds (no-op), so this
 * instrument cannot leak audit logging to production. Removal is still required
 * to keep the codebase clean after the audit.
 *
 * Usage:
 *   import { RenderTracker, getRenderCounts } from 'src/utils/renderCounter';
 *   <RenderTracker id="MyComponent"><MyComponent /></RenderTracker>
 *
 * Download evidence from DevTools console:
 *   window.frontendLogger.download('render-audit.jsonl')
 *   // Then filter: grep '"area":"profiler"' render-audit.jsonl
 */
import { Profiler, type ReactNode } from "react";
import { frontendLogger } from "src/utils/logger";

const renderCounts: Record<string, number> = {};

function onRender(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
): void {
  renderCounts[id] = (renderCounts[id] ?? 0) + 1;
  frontendLogger.timing("profiler", "render", {
    id,
    phase,
    actualDurationMs: actualDuration,
    count: renderCounts[id],
  });
}

/** Wrap any JSX subtree to count renders. Remove entirely after audit. */
export function RenderTracker({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}

/** Return a snapshot of all accumulated render counts (keyed by id). */
export function getRenderCounts(): Record<string, number> {
  return { ...renderCounts };
}
