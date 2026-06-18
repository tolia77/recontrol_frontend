/**
 * ScenariosAISegment — the AI segment body inside ScenariosPanel. Renders:
 *   - prompt textarea (maxLength=1000)
 *   - [Generate Draft] / [⏹ Cancel generation] CTA with elapsed counter
 *   - quota indicator card (drafts + tokens; turns amber within 10% of cap)
 *   - ephemeral "Last: <prompt>" display (component state only — never persisted)
 *   - inline error card with per-code locale lookup
 *
 * State / lifecycle is delegated to useDraftGeneration; this component is the
 * presentational shell. On state.kind === 'success' it invokes onDraftReady
 * with the inner draft payload so the parent (ScenariosPanel) can open the
 * DraftReviewModal.
 *
 * Security notes:
 *   - lastPrompt lives only in component state — no sessionStorage/localStorage.
 *   - textarea maxLength={1000} clamps at the React layer; the backend has no
 *     further prompt cap (accepted trade-off).
 *   - the error code feeds a locale-key lookup only, never control flow.
 *   - stale in-flight requests are handled in useDraftGeneration via
 *     AbortController + signal.aborted guards on resolve/reject.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import Card from "src/components/ui/Card.tsx";
import Button from "src/components/ui/Button.tsx";
import type {
  DraftQuota,
  DraftResponse,
} from "src/services/backend/scenariosService.ts";
import { useGate } from "src/hooks/useGate";
import UpgradeModal from "src/components/ui/UpgradeModal";

import { useDraftGeneration } from "./useDraftGeneration";
import { i18n } from "src/i18n.ts";

export interface ScenariosAISegmentProps {
  /**
   * Invoked on state.kind === 'success' with the inner draft payload (NOT the
   * envelope — parent doesn't need the quota piggyback, which the segment
   * keeps internally for its quota indicator).
   *
   * Second arg `totalTokens` carries the OpenRouter `usage.total_tokens` for
   * this call. Parent forwards it on [Accept and save] as
   * `created_via_ai_token_count`. May be 0 if the backend could not parse the
   * usage block (frontend simply stamps whatever it received).
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
   * Parent observer for prompt submissions. The panel records the most recent
   * prompt so [Regenerate Draft] can re-send it verbatim. The segment never
   * reads back from the parent; this is a one-way notify.
   */
  onPromptSubmitted?: (prompt: string) => void;
  /**
   * Monotonically-increasing token bumped by the parent when [Regenerate Draft]
   * fires. The segment effect watches this value and, on each change after
   * first mount, re-invokes generate() with `regeneratePrompt`. Same
   * AbortController lifecycle as a manual generate (prior in-flight is
   * cancelled).
   */
  regenerateToken?: number;
  /**
   * Prompt to re-submit when `regenerateToken` changes. Typically the parent's
   * `lastAIPrompt` state.
   */
  regeneratePrompt?: string | null;
  /**
   * Target OS for the generated commands, sourced from the connected device's
   * platform when the panel is opened in a device context. Threaded to the
   * backend so it emits OS-native diagnostics (e.g. systeminfo on Windows
   * instead of free/top). Null/undefined on the device-less /scenarios page,
   * where the backend falls back to portable guidance.
   */
  platform?: string | null;
}

const PROMPT_MAX_LENGTH = 1000;
const LAST_PROMPT_TRUNCATE = 60;

/**
 * Resolve `state.code` → locale key. Every code maps to a localized card body;
 * unknown codes fall back to network copy. This is a pure lookup table — never
 * used as a control-flow gate.
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

function ScenariosAISegment({
  onDraftReady,
  initialQuota,
  onPromptSubmitted,
  regenerateToken,
  regeneratePrompt,
  platform,
}: ScenariosAISegmentProps) {
  const { t } = useTranslation("scenarios");
  const { state, generate, cancel } = useDraftGeneration();
  const gate = useGate("ai_draft_daily_limit");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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

  // Success-branch effect: hand the draft to the parent, refresh quota from the
  // piggybacked snapshot, and forward `usage.total_tokens` so the panel can
  // persist it as `created_via_ai_token_count` on [Accept and save].
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
    // Locale flows through the Accept-Language header from i18n.language at the
    // call-site. Binary names + args stay canonical English; only descriptive
    // prose responds to the locale directive.
    void generate(prompt, i18n.language, platform);
  }, [prompt, generate, onPromptSubmitted, platform]);

  const handleGenerateGated = useCallback(() => {
    if (!gate.allowed) {
      setShowUpgradeModal(true);
      return;
    }
    handleGenerate();
  }, [gate.allowed, handleGenerate]);

  // Parent-driven regenerate. Watches `regenerateToken` and re-fires
  // generate(regeneratePrompt) on each bump (skipping the initial mount value).
  // Uses the hook's existing AbortController lifecycle so any in-flight request
  // is cancelled.
  const lastRegenerateTokenRef = useRef<number | undefined>(regenerateToken);
  useEffect(() => {
    if (regenerateToken === undefined) return;
    if (regenerateToken === lastRegenerateTokenRef.current) return;
    lastRegenerateTokenRef.current = regenerateToken;
    if (!regeneratePrompt || regeneratePrompt.trim().length === 0) return;
    setErrorDismissed(false);
    setLastPrompt({ text: regeneratePrompt, at: Date.now() });
    void generate(regeneratePrompt, i18n.language, platform);
  }, [regenerateToken, regeneratePrompt, generate, platform]);

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
            className="text-body text-foreground font-medium"
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
            className="border-border text-body text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/30 min-h-[80px] w-full resize-y rounded-md border px-4 py-3 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-3">
            {isGenerating ? (
              <span className="text-caption text-muted-foreground">
                ⏳ {t("ai.generatingCounter", { count: elapsedSec })}
              </span>
            ) : showEmptyState ? (
              <span className="text-body text-muted-foreground">
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
                onClick={handleGenerateGated}
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
            className={`text-caption flex flex-col gap-1 ${
              quotaIsAmber ? "text-warning" : "text-muted-foreground"
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
          className="text-caption text-muted-foreground"
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
          className="border-destructive border-l-4"
          role="alert"
          data-testid="ai-error-card"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-body text-foreground">
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

      {showUpgradeModal && (
        <UpgradeModal
          feature="ai_draft_daily_limit"
          current={gate.current}
          limit={gate.limit}
          requiredPlan={gate.requiredPlan}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}

export default ScenariosAISegment;
