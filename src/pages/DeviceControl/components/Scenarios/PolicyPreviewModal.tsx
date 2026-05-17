import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Spinner } from '../../../../components/ui';
import { isIrreversible } from '../../../../services/scenarios/irreversibleIntentCatalog';
import type {
  PolicyPreviewResponse,
  PolicyPreviewStep,
} from '../../../../services/backend/scenariosService';

// D-22-04 / D-22-05 / D-22-06: center-screen modal that renders the
// /policy_preview response as a per-step list with shell-like primary line
// + expandable execve structured detail. Deny verdicts hard-block by removing
// the [Run all] CTA entirely (POLICY-04). Irreversible-intent steps get a red
// left-border + amber "Irreversible" badge sourced from the frontend mirror
// catalog (POLICY-03). The POLICY-06 drift banner stacks below the deny banner.

export interface PolicyPreviewModalCommandStep {
  id: string;
  binary: string;
  args: string[];
  cwd: string;
  description?: string;
}

export interface PolicyPreviewModalProps {
  open: boolean;
  response: PolicyPreviewResponse | null;
  loading: boolean;
  error?: string | null;
  scenarioName: string;
  deviceName: string;
  deviceId: string;
  canChangeDevice: boolean;
  onChangeDevice?: () => void;
  commandSteps: PolicyPreviewModalCommandStep[];
  onApprove: () => void;
  onCancel: () => void;
}

// D-22-05: cosmetic shell-like reconstruction of (binary, args). Args
// containing whitespace are wrapped in double quotes; embedded double quotes
// are backslash-escaped. The runtime dispatch path is execve-only (SAFETY-02)
// and never consumes this string — it's view-only. Co-located with the modal
// for testability per Plan 22.07 acceptance criteria.
// eslint-disable-next-line react-refresh/only-export-components
export function formatShellPreview(binary: string, args: readonly string[]): string {
  const tokens = args.map((arg) => {
    if (!/\s/.test(arg)) return arg;
    const escaped = arg.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });
  return tokens.length > 0 ? `${binary} ${tokens.join(' ')}` : binary;
}

// Per UI-SPEC §PolicyPreviewModal "Per-step row" — verdict badge color tokens.
const verdictBadgeClass: Record<'allow' | 'needs_confirm' | 'deny', string> = {
  allow: 'bg-green-50 text-green-700',
  needs_confirm: 'bg-amber-50 text-amber-700',
  deny: 'bg-red-50 text-red-700',
};

function joinClasses(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export default function PolicyPreviewModal({
  open,
  response,
  loading,
  error,
  deviceName,
  canChangeDevice,
  onChangeDevice,
  commandSteps,
  onApprove,
  onCancel,
}: PolicyPreviewModalProps) {
  const { t } = useTranslation('scenarios');

  // Per-step expand state for non-denied rows (denied rows auto-expand via
  // memoized derivation below — D-22-06).
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<number>>(() => new Set());

  // Reset the manual-expand set whenever the response identity changes so a
  // re-opened modal doesn't carry stale per-row toggles.
  useEffect(() => {
    setManuallyExpanded(new Set());
  }, [response]);

  // ESC dismisses while open (per UI-SPEC §PolicyPreviewModal Layout — keyboard
  // accessibility default for modal portals).
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  const denySteps = useMemo<PolicyPreviewStep[]>(
    () => response?.steps.filter((s) => s.decision === 'deny') ?? [],
    [response],
  );
  const hasDeny = denySteps.length > 0;
  const denyOverflow = Math.max(0, denySteps.length - 3);

  // Lookup helper — match the policy verdict step (keyed by step_index) to the
  // operator-authored command step (which carries binary/args/cwd/description
  // — the response doesn't repeat this payload to keep wire size small).
  const commandStepsByIndex = useMemo(() => {
    const map = new Map<number, PolicyPreviewModalCommandStep>();
    commandSteps.forEach((cs, idx) => map.set(idx, cs));
    return map;
  }, [commandSteps]);

  if (!open) return null;

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onCancel();
  };

  const toggleExpand = (stepIndex: number): void => {
    setManuallyExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(stepIndex)) next.delete(stepIndex);
      else next.add(stepIndex);
      return next;
    });
  };

  return (
    <div
      data-testid="policy-preview-backdrop"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        data-testid="policy-preview-card"
        className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-lightgray px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="text-lg font-semibold text-primary">{t('preApprove.title')}</h2>
            <span
              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
              data-testid="policy-preview-target-device"
            >
              {t('preApprove.targetDevice', { deviceName })}
            </span>
          </div>
          {canChangeDevice && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onChangeDevice}
              data-testid="policy-preview-change-device"
            >
              {t('preApprove.changeDevice')}
            </Button>
          )}
        </header>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          {loading && response === null && (
            <div className="flex justify-center py-8" data-testid="policy-preview-loading">
              <Spinner />
            </div>
          )}

          {error && (
            <div
              className="rounded-lg border border-error bg-red-50 px-4 py-3 text-sm text-red-800"
              data-testid="policy-preview-error"
            >
              {error}
            </div>
          )}

          {/* Deny banner — D-22-06 / POLICY-04 */}
          {hasDeny && (
            <div
              data-testid="policy-preview-deny-banner"
              className="rounded-lg border border-error bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              <div className="font-medium">⛔</div>
              {denySteps.slice(0, 3).map((s) => (
                <div
                  key={s.step_index}
                  data-testid={`policy-preview-deny-line-${s.step_index}`}
                >
                  {t('preApprove.denyBanner', { n: s.step_index + 1, reason: s.reason })}
                </div>
              ))}
              {denyOverflow > 0 && (
                <div
                  className="mt-1 text-xs text-red-700"
                  data-testid="policy-preview-deny-overflow"
                >
                  {t('preApprove.denyBannerOverflow', { count: denyOverflow })}
                </div>
              )}
            </div>
          )}

          {/* Drift banner — POLICY-06 / VERIFY-05 */}
          {response?.policy_drift && (
            <div
              data-testid="policy-preview-drift-banner"
              className="rounded-lg border border-amber bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="alert"
            >
              ⚠ {t('preApprove.driftBanner')}
            </div>
          )}

          {/* Per-step rows */}
          {response?.steps.map((step) => {
            const command = commandStepsByIndex.get(step.step_index);
            if (!command) return null;
            const isStepIrreversible = isIrreversible({
              binary: command.binary,
              args: command.args,
            });
            const isDeny = step.decision === 'deny';
            const isExpanded = isDeny || manuallyExpanded.has(step.step_index);
            const oldDecision = step.classified_intent?.decision;
            const showDriftDiff =
              response.policy_drift && oldDecision && oldDecision !== step.decision;
            const rowClasses = joinClasses(
              'rounded-lg border border-lightgray px-3 py-2',
              isStepIrreversible && 'border-l-4 border-error',
              isDeny && 'border-l-4 border-error bg-red-50',
            );
            return (
              <div
                key={step.step_index}
                data-testid={`policy-preview-step-${step.step_index}`}
                className={rowClasses}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xs font-mono text-darkgray">
                    {step.step_index + 1}
                  </span>
                  <span
                    data-testid={`policy-preview-verdict-${step.step_index}`}
                    className={joinClasses(
                      'rounded px-2 py-1 text-xs font-medium',
                      verdictBadgeClass[step.decision],
                    )}
                  >
                    {t(`preApprove.verdict.${step.decision}`)}
                  </span>
                  {isStepIrreversible && (
                    <span
                      data-testid={`policy-preview-irreversible-${step.step_index}`}
                      className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700"
                    >
                      {t('preApprove.irreversibleWarning')}
                    </span>
                  )}
                  <div className="ml-auto">
                    <button
                      type="button"
                      onClick={() => toggleExpand(step.step_index)}
                      aria-label={t('preApprove.expand')}
                      className="cursor-pointer text-xs text-darkgray hover:text-primary"
                      data-testid={`policy-preview-expand-${step.step_index}`}
                    >
                      ▾
                    </button>
                  </div>
                </div>
                <div className="mt-1 font-mono text-sm text-primary">
                  {formatShellPreview(command.binary, command.args)}
                </div>
                <div className="text-xs text-darkgray">cwd: {command.cwd}</div>
                {command.description && (
                  <div className="text-xs italic text-darkgray">
                    {command.description}
                  </div>
                )}
                {showDriftDiff && (
                  <div className="mt-1 text-xs text-darkgray">
                    was: {oldDecision} → now: {step.decision}
                  </div>
                )}
                {isExpanded && (
                  <div
                    data-testid={`policy-preview-structured-${step.step_index}`}
                    className="mt-2 space-y-1 pl-3 font-mono text-xs text-darkgray"
                  >
                    <div>binary: {step.resolved_binary ?? command.binary}</div>
                    {command.args.map((arg, idx) => (
                      <div key={idx}>
                        args[{idx}]: {arg}
                      </div>
                    ))}
                    <div>cwd: {command.cwd}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="flex justify-end gap-3 border-t border-lightgray px-6 py-3">
          <Button
            variant="secondary"
            size="md"
            onClick={onCancel}
            data-testid="policy-preview-dismiss"
          >
            {t('preApprove.dismiss')}
          </Button>
          {!hasDeny && (
            <Button
              variant="primary"
              size="md"
              onClick={onApprove}
              data-testid="policy-preview-run-all"
            >
              {t('preApprove.runAll')}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
