/**
 * ScenariosAISegment — Phase 23 / Plan 23-08 Task 2.
 *
 * The AI segment body inside ScenariosPanel (Plan 23-09 mounts it). Renders:
 *   - prompt textarea (maxLength=1000 per AI-SPEC Context Window Strategy)
 *   - [Generate Draft] / [⏹ Cancel generation] CTA with elapsed counter
 *   - quota indicator card (drafts + tokens; turns amber within 10% of cap)
 *   - ephemeral "Last: <prompt>" display (component state ONLY — D-04)
 *   - inline error card with per-code locale lookup (D-06)
 *
 * State / lifecycle is delegated to useDraftGeneration; this component is the
 * presentational shell. On state.kind === 'success' it invokes onDraftReady
 * with the inner draft payload so the parent (ScenariosPanel) can open the
 * DraftReviewModal.
 *
 * Threat-model nots:
 *   - T-23-31 (lastPrompt persistence): lastPrompt lives only in component
 *     state. There are NO setItem calls into sessionStorage or localStorage —
 *     verified by the acceptance grep `sessionStorage|localStorage == 0`.
 *   - T-23-30 (paste-bomb): textarea maxLength={1000} clamps at the React
 *     layer; the backend has no further prompt cap (accepted trade-off).
 *   - T-23-32 (spoofed error code): the error code feeds into a locale-key
 *     lookup only, never into control flow.
 *   - T-23-33 (stale in-flight): handled inside useDraftGeneration via
 *     AbortController + signal.aborted guards on resolve/reject.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "src/components/ui/Card.tsx";
import { Button } from "src/components/ui/Button.tsx";
import type {
  DraftQuota,
  DraftResponse,
} from "src/services/backend/scenariosService.ts";

import { useDraftGeneration } from "./useDraftGeneration";
import { i18n } from "src/i18n.ts";

export interface ScenariosAISegmentProps {
  /**
   * Invoked on state.kind === 'success' with the inner draft payload (NOT the
   * envelope — parent doesn't need the quota piggyback, which the segment
   * keeps internally for its quota indicator).
   *
   * Phase 23 / Plan 23-11 (AI-10): second arg `totalTokens` carries the
   * OpenRouter `usage.total_tokens` for this call. Parent forwards it on
   * [Accept and save] as `created_via_ai_token_count`. May be 0 if the backend
   * could not parse the usage block (graceful — backend nullifies bogus
   * values, frontend simply stamps whatever it received).
   */
  onDraftReady: (draft: DraftResponse["draft"], totalTokens: number) => void;
  /**
   * Optional initial quota snapshot supplied by the parent (typically from a
   * GET /ai_usages/today fetch on segment mount). When omitted, the quota
   * card renders nothing until the first successful draft response brings
   * a piggybacked snapshot.
   */
  initialQuota?: DraftQuota;
  /**
   * Phase 23 / Plan 23-09: parent observer for prompt submissions. The
   * panel records the most recent prompt so [Regenerate Draft] can re-send
   * it verbatim (D-03). The segment never reads back from the parent;
   * this is a one-way notify.
   */
  onPromptSubmitted?: (prompt: string) => void;
  /**
   * Phase 23 / Plan 23-09: monotonically-increasing token bumped by the
   * parent when [Regenerate Draft] fires. The segment effect watches this
   * value and, on each change after first mount, re-invokes generate()
   * with `regeneratePrompt`. Same AbortController lifecycle as a manual
   * generate (prior in-flight is cancelled).
   */
  regenerateToken?: number;
  /**
   * Phase 23 / Plan 23-09: prompt to re-submit when `regenerateToken`
   * changes. Typically the parent's `lastAIPrompt` state.
   */
  regeneratePrompt?: string | null;
}

const PROMPT_MAX_LENGTH = 1000;
const LAST_PROMPT_TRUNCATE = 60;

/**
 * Resolve `state.code` → locale key. Per D-06 every code maps to a localized
 * card body; unknown codes fall back to network copy. This is a pure lookup
 * table — never used as a control-flow gate (T-23-32).
 */
function errorCodeToLocaleKey(code: string): string {
  switch (code) {
    case "draft_unparseable":
      return "ai.errors.unparseable";
    case "draft_unsafe":
      return "ai.errors.unsafe";
    case "draft_attempts_exceeded":
      return "ai.errors.quotaDrafts";
    case "tokens_exceeded":
      return "ai.errors.quotaTokens";
    case "upstream_rate_limited":
      return "ai.errors.rateLimited";
    case "ai_service_unreachable":
    case "network":
    default:
      return "ai.errors.network";
  }
}

function truncatePrompt(text: string): string {
  if (text.length <= LAST_PROMPT_TRUNCATE) return text;
  return `${text.slice(0, LAST_PROMPT_TRUNCATE)}…`;
}

/**
 * Format a "Nm ago" relative-time string for the ephemeral last-prompt
 * display. Kept inline (not a util) because it's tiny and the only consumer.
 */
function formatRelative(ms: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function isAmberQuota(q: DraftQuota): boolean {
  return (
    q.drafts_used >= q.drafts_limit * 0.9 ||
    q.tokens_used >= q.tokens_limit * 0.9
  );
}

export function ScenariosAISegment({
  onDraftReady,
  initialQuota,
  onPromptSubmitted,
  regenerateToken,
  regeneratePrompt,
}: ScenariosAISegmentProps) {
  const { t } = useTranslation("scenarios");
  const { state, generate, cancel } = useDraftGeneration();

  const [prompt, setPrompt] = useState("");
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [lastPrompt, setLastPrompt] = useState<{
    text: string;
    at: number;
  } | null>(null);
  const [quota, setQuota] = useState<DraftQuota | null>(initialQuota ?? null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const isGenerating = state.kind === "generating";

  // Tick the elapsed counter every second while generating; cleared on exit.
  useEffect(() => {
    if (state.kind !== "generating") {
      setElapsedSec(0);
      return;
    }
    const start = state.startedAt;
    setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    const handle = window.setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => window.clearInterval(handle);
  }, [state]);

  // Success-branch effect: hand the draft to the parent, refresh quota from
  // the piggyback (per D-04 Quota indicator data source), and stamp lastPrompt.
  // Phase 23 / Plan 23-11 (AI-10): forward `usage.total_tokens` so the panel
  // can persist it as `created_via_ai_token_count` on [Accept and save].
  useEffect(() => {
    if (state.kind !== "success") return;
    setQuota(state.draft.quota);
    onDraftReady(state.draft.draft, state.draft.usage?.total_tokens ?? 0);
  }, [state, onDraftReady]);

  // Error-branch effect: re-show the error card whenever the hook surfaces a
  // new error (in case the operator had previously dismissed an older one).
  useEffect(() => {
    if (state.kind === "error") {
      setErrorDismissed(false);
    }
  }, [state]);

  const handleGenerate = useCallback(() => {
    const trimmed = prompt.trim();
    if (trimmed.length === 0) return;
    setErrorDismissed(false);
    setLastPrompt({ text: prompt, at: Date.now() });
    onPromptSubmitted?.(prompt);
    // Locale flows through the Accept-Language header from i18n.language at
    // call-site per D-09. Binary names + args stay canonical English; only
    // descriptive prose responds to the locale directive.
    void generate(prompt, i18n.language);
  }, [prompt, generate, onPromptSubmitted]);

  // Phase 23 / Plan 23-09: parent-driven regenerate. Watches `regenerateToken`
  // and re-fires generate(regeneratePrompt) on each bump (skipping the
  // initial mount value). Uses the hook's existing AbortController lifecycle
  // so any in-flight request is cancelled.
  const lastRegenerateTokenRef = useRef<number | undefined>(regenerateToken);
  useEffect(() => {
    if (regenerateToken === undefined) return;
    if (regenerateToken === lastRegenerateTokenRef.current) return;
    lastRegenerateTokenRef.current = regenerateToken;
    if (!regeneratePrompt || regeneratePrompt.trim().length === 0) return;
    setErrorDismissed(false);
    setLastPrompt({ text: regeneratePrompt, at: Date.now() });
    void generate(regeneratePrompt, i18n.language);
  }, [regenerateToken, regeneratePrompt, generate]);

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const handleDismissError = useCallback(() => {
    setErrorDismissed(true);
  }, []);

  const errorCode = state.kind === "error" ? state.code : null;
  const errorDetails =
    state.kind === "error"
      ? (state.details as { response?: { data?: Record<string, unknown> } })
      : null;
  const errorBodyKey = errorCode ? errorCodeToLocaleKey(errorCode) : null;

  // For 'draft_unsafe' the backend carries step_index in the response body.
  const errorInterpolation = useMemo<Record<string, unknown>>(() => {
    if (!errorCode || !errorDetails) return {};
    const data = errorDetails.response?.data;
    if (errorCode === "draft_unsafe" && data && typeof data === "object") {
      const stepIndex = (data as { step_index?: unknown }).step_index;
      return { stepIndex: typeof stepIndex === "number" ? stepIndex + 1 : 1 };
    }
    if (
      (errorCode === "draft_attempts_exceeded" ||
        errorCode === "tokens_exceeded") &&
      data &&
      typeof data === "object"
    ) {
      const reset = data as { reset_at?: unknown; resets_in?: unknown };
      const rel =
        typeof reset.resets_in === "string"
          ? reset.resets_in
          : typeof reset.reset_at === "string"
            ? reset.reset_at
            : "soon";
      return { resetRelative: rel };
    }
    return {};
  }, [errorCode, errorDetails]);

  const showError =
    state.kind === "error" && !errorDismissed && errorBodyKey !== null;

  const submitDisabled = isGenerating || prompt.trim().length === 0;

  const ctaLabel = isGenerating
    ? `⏹ ${t("ai.cancelGenerate")}`
    : t("ai.generate");

  const quotaIsAmber = quota !== null && isAmberQuota(quota);

  const showEmptyState = lastPrompt === null && state.kind !== "generating";

  return (
    <div className="flex h-full flex-col gap-4">
      <Card padding="md">
        <div className="flex flex-col gap-3">
          <label
            htmlFor="scenarios-ai-prompt"
            className="text-body-small text-text font-medium"
          >
            {t("ai.promptLabel")}
          </label>
          <textarea
            id="scenarios-ai-prompt"
            aria-label={t("ai.promptLabel")}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("ai.promptPlaceholder")}
            maxLength={PROMPT_MAX_LENGTH}
            disabled={isGenerating}
            className="border-lightgray text-body text-text placeholder:text-darkgray focus:border-primary focus:ring-primary/20 min-h-[80px] w-full resize-y rounded-lg border px-4 py-3 focus:ring-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-3">
            {isGenerating ? (
              <span className="text-caption-small text-darkgray">
                ⏳ {t("ai.generatingCounter", { count: elapsedSec })}
              </span>
            ) : showEmptyState ? (
              <span className="text-body-small text-darkgray">
                {t("ai.emptyStateBody")}
              </span>
            ) : (
              <span aria-hidden="true" />
            )}
            {isGenerating ? (
              <Button
                variant="secondary"
                size="md"
                onClick={handleCancel}
                type="button"
              >
                {ctaLabel}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleGenerate}
                disabled={submitDisabled}
                type="button"
              >
                {ctaLabel}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {quota !== null && (
        <Card padding="sm" data-testid="ai-quota-card">
          <div
            className={`text-caption-small flex flex-col gap-1 ${
              quotaIsAmber ? "text-amber" : "text-darkgray"
            }`}
          >
            <span>
              {t("ai.quotaDrafts", {
                used: quota.drafts_used,
                limit: quota.drafts_limit,
              })}
            </span>
            <span>
              {t("ai.quotaTokens", {
                used: quota.tokens_used,
                limit: quota.tokens_limit,
              })}
            </span>
          </div>
        </Card>
      )}

      {lastPrompt !== null && (
        <div
          className="text-caption-small text-darkgray"
          data-testid="ai-last-prompt"
        >
          {t("ai.lastPrompt", {
            prompt: truncatePrompt(lastPrompt.text),
            relative: formatRelative(lastPrompt.at, Date.now()),
          })}
        </div>
      )}

      {showError && errorBodyKey && (
        <Card
          padding="sm"
          className="border-error border-l-4"
          role="alert"
          data-testid="ai-error-card"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-body-small text-text">
              {t(errorBodyKey, errorInterpolation)}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismissError}
              type="button"
            >
              {t("ai.dismiss")}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default ScenariosAISegment;
