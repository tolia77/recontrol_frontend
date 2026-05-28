/**
 * useDraftGeneration — Phase 23 / Plan 23-08
 *
 * 5-state machine driving the ScenariosAISegment prompt → draft round-trip.
 * Wraps scenariosService.createDraft with an AbortController lifecycle so the
 * operator can cancel an in-flight request (D-05: client-side abort only; the
 * server may still complete and charge — documented trade-off, surfaced in UI
 * copy as "Cancel generation").
 *
 * State machine (UI-SPEC §State Machine, lines 298-310):
 *   idle       → generating (via generate)
 *   generating → success | error | cancelled
 *   success    → idle (via reset)
 *   error      → idle (via reset OR new generate which auto-clears)
 *   cancelled  → idle (via reset; NEVER shows an error card — operator
 *                       initiated the cancel)
 *
 * AbortController semantics:
 *   - cancel() calls controllerRef.current?.abort() → transitions to
 *     'cancelled' (NOT 'error') because the operator chose to bail.
 *   - A new generate() while one is in-flight aborts the prior controller
 *     before creating a new one — prevents racing concurrent responses from
 *     polluting state.
 *   - Unmount cleanup aborts whatever controller is currently in-flight, so
 *     a component that unmounts mid-request doesn't leak a pending promise
 *     resolving into setState on an unmounted component.
 *   - Resolve / reject branches check `signal.aborted` before transitioning
 *     so a late server response after a cancel can't overwrite the
 *     'cancelled' state with a stale 'success' or 'error'.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  scenariosService,
  type DraftResponse,
} from "src/services/backend/scenariosService.ts";

/**
 * Discriminated union — exactly 5 kinds per UI-SPEC State Machine table.
 *
 * `generating.startedAt` is the epoch-ms timestamp captured at the moment
 * generate() was invoked; the segment component derives its elapsed counter
 * from `Date.now() - startedAt`.
 *
 * `error.code` is the backend error envelope's `error` string (e.g.
 * 'draft_unparseable', 'tokens_exceeded') or 'network' when the axios layer
 * fails before a JSON body is parsed. `details` carries the raw response.data
 * so callers can extract per-error specifics (e.g. step_index, reset_at).
 */
export type DraftGenerationState =
  | { kind: "idle" }
  | { kind: "generating"; startedAt: number }
  | { kind: "success"; draft: DraftResponse }
  | { kind: "error"; code: string; details?: unknown }
  | { kind: "cancelled" };

export interface UseDraftGenerationResult {
  state: DraftGenerationState;
  generate: (prompt: string, locale: string) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

/**
 * Extract the backend error code from an axios error shape. Falls back to
 * 'network' when no structured body is present (5xx, transport failure,
 * upstream timeout). Per D-06 the frontend treats the code as a locale-lookup
 * key only — never as a control-flow gate (T-23-32 mitigation).
 */
function extractErrorCode(err: unknown): string {
  const code = (err as { response?: { data?: { error?: unknown } } })?.response
    ?.data?.error;
  return typeof code === "string" && code.length > 0 ? code : "network";
}

export function useDraftGeneration(): UseDraftGenerationResult {
  const [state, setState] = useState<DraftGenerationState>({ kind: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  // Unmount cleanup: abort whatever is in flight so a late resolve doesn't
  // call setState on an unmounted component (also doubles as a leak guard).
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const generate = useCallback(
    async (prompt: string, locale: string): Promise<void> => {
      // Abort any prior in-flight controller — a second generate() while the
      // first is still pending must not race two responses into the reducer.
      controllerRef.current?.abort();

      const controller = new AbortController();
      controllerRef.current = controller;

      setState({ kind: "generating", startedAt: Date.now() });

      try {
        const draft = await scenariosService.createDraft(
          prompt,
          locale,
          controller.signal,
        );
        // Late resolve after cancel: signal.aborted is true → respect the
        // cancelled transition rather than overwriting with a stale success.
        if (controller.signal.aborted) {
          return;
        }
        setState({ kind: "success", draft });
      } catch (err) {
        // If the abort was operator-initiated (cancel() or new generate()),
        // surface as 'cancelled', NOT 'error'. axios surfaces aborts as
        // CanceledError but signal.aborted is the canonical source of truth.
        if (controller.signal.aborted) {
          return;
        }
        const code = extractErrorCode(err);
        setState({ kind: "error", code, details: err });
      }
    },
    [],
  );

  const cancel = useCallback((): void => {
    controllerRef.current?.abort();
    setState({ kind: "cancelled" });
  }, []);

  const reset = useCallback((): void => {
    setState({ kind: "idle" });
  }, []);

  return { state, generate, cancel, reset };
}
