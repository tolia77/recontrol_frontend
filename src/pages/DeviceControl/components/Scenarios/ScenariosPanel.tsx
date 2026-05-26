import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SegmentedControl, useToast } from "../../../../components/ui";
import ScenariosLibrary from "./ScenariosLibrary";
import ScenarioEditor from "./ScenarioEditor";
import ScenariosHistory from "./ScenariosHistory";
import ScenariosHistoryDetail from "./ScenariosHistoryDetail";
import ScenariosRunMode from "./ScenariosRunMode";
import PolicyPreviewModal from "./PolicyPreviewModal";
import ScenariosAISegment from "./ScenariosAISegment";
import DraftReviewModal from "./DraftReviewModal";
import {
  scenariosService,
  type DraftResponse,
  type PolicyPreviewResponse,
  type Scenario,
} from "../../../../services/backend/scenariosService";
import { useScenarioRunChannel } from "../../hooks/useScenarioRunChannel";
import type { ScenarioRunBroadcast } from "../../hooks/useScenarioRunChannel";
import {
  initialScenariosState,
  scenariosReducer,
  type ScenariosSegment,
} from "./scenariosReducer";

// -----------------------------------------------------------------------------
// PanelMode discriminated union — Plan 23-09 extends the P22 shape with a
// real `{ kind: 'ai' }` variant (replacing the Plan 23-07 `toLegacySegment`
// narrowing bridge) and widens the `editor` variant with optional
// `prefill` + `backTarget` fields so the AI flow can hand a draft to the
// manual editor and round-trip via the [← Back] button.
//
// `run.backTo` stays a `'library' | 'history'` literal (run-mode launched
// from AI flow is not a target the v1.5 UI exposes; if a run launches from
// AI it logically goes back to library).
// -----------------------------------------------------------------------------

type PanelMode =
  | { kind: "library" }
  | { kind: "history" }
  | { kind: "ai" }
  | {
      kind: "editor";
      editingId: string | "new";
      prefill?: DraftResponse["draft"];
      backTarget?: ScenariosSegment;
    }
  | {
      kind: "run";
      runId: string;
      scenarioId: string;
      backTo: "library" | "history";
    }
  | { kind: "history_detail"; runId: string };

// UI-05: sessionStorage key for the active segment. Wrapped in try/catch
// throughout for private-browsing tolerance (matches Plan 22.06 / Pattern 14).
const SEGMENT_KEY = "scenarios_panel_segment";

function readSegmentFromStorage(): ScenariosSegment {
  try {
    const stored = sessionStorage.getItem(SEGMENT_KEY);
    if (stored === "history") return "history";
    if (stored === "ai") return "ai";
    return "library";
  } catch {
    return "library";
  }
}

function writeSegmentToStorage(value: ScenariosSegment): void {
  try {
    sessionStorage.setItem(SEGMENT_KEY, value);
  } catch {
    // private browsing — no-op
  }
}

// Run-mode back targets are always library or history (not 'ai').
function backTargetForRun(segment: ScenariosSegment): "library" | "history" {
  return segment === "history" ? "history" : "library";
}

interface ModalState {
  open: boolean;
  scenarioId: string | null;
  scenario: Scenario | null;
  response: PolicyPreviewResponse | null;
  loading: boolean;
  error: string | null;
}

const initialModalState: ModalState = {
  open: false,
  scenarioId: null,
  scenario: null,
  response: null,
  loading: false,
  error: null,
};

// Phase 23 / Plan 23-09 + 23-11: DraftReviewModal state container.
// `totalTokens` is the OpenRouter per-call usage captured at draft generation
// time (Plan 23-11 / AI-10). It rides alongside `draft` so [Accept and save]
// can forward it as `created_via_ai_token_count` in the create payload.
interface DraftModalState {
  open: boolean;
  draft: DraftResponse["draft"] | null;
  totalTokens: number | null;
  loading: boolean;
}

const initialDraftModal: DraftModalState = {
  open: false,
  draft: null,
  totalTokens: null,
  loading: false,
};

export interface ScenariosPanelProps {
  deviceId: string;
  ws: WebSocket | null;
  deviceName: string;
}

export default function ScenariosPanel({
  deviceId,
  ws,
  deviceName,
}: ScenariosPanelProps) {
  const { t } = useTranslation("scenarios");
  const toast = useToast();

  // Segment state — initialized from sessionStorage (UI-05).
  const initialSegment = readSegmentFromStorage();
  const [segment, setSegment] = useState<ScenariosSegment>(initialSegment);

  // Mode router — starts in the initial segment (library / history / ai).
  const [mode, setMode] = useState<PanelMode>({
    kind: initialSegment,
  });

  // Scenarios outer reducer (composes transcriptReducer for live run state).
  const [scenariosState, dispatchScenarios] = useReducer(scenariosReducer, {
    ...initialScenariosState,
    segment: initialSegment,
  });

  // Modal state for PolicyPreviewModal.
  const [modalState, setModalState] = useState<ModalState>(initialModalState);

  // Phase 23 / Plan 23-09: DraftReviewModal state.
  const [draftModal, setDraftModal] =
    useState<DraftModalState>(initialDraftModal);
  // Phase 23 / Plan 23-09: last operator prompt (captured at generate time;
  // re-submitted verbatim by [Regenerate Draft]). Component-state only —
  // never persisted, matches the D-04 ephemerality posture.
  const [lastAIPrompt, setLastAIPrompt] = useState<string | null>(null);
  // Phase 23 / Plan 23-09: regenerate signal — bumping this number causes
  // the mounted ScenariosAISegment to re-fire generate(lastAIPrompt) via its
  // own effect. The segment uses the AbortController inside its hook so any
  // prior in-flight request is cancelled.
  const [regenerateToken, setRegenerateToken] = useState(0);

  // Persist segment changes to sessionStorage.
  useEffect(() => {
    writeSegmentToStorage(segment);
  }, [segment]);

  // Keep the mode and segment in sync when the operator clicks a segment pill
  // while in library / history / ai. Editor / run / history_detail are takeovers
  // and do not change the segment.
  const handleSegmentChange = useCallback((next: ScenariosSegment): void => {
    setSegment(next);
    // Only re-route mode if we are currently on a non-takeover view.
    setMode((prev) => {
      if (
        prev.kind === "library" ||
        prev.kind === "history" ||
        prev.kind === "ai"
      ) {
        return { kind: next };
      }
      return prev;
    });
  }, []);

  // Keep a stable ref to the active modal state so the broadcast handler does
  // not need to re-mount on every modal mutation.
  const modalOpenRef = useRef<boolean>(false);
  useEffect(() => {
    modalOpenRef.current = modalState.open;
  }, [modalState.open]);

  // Channel broadcast handler. Dispatches into the reducer; surfaces the
  // single-in-flight rejection as a Toast (D-22-11).
  const onBroadcast = useCallback(
    (msg: ScenarioRunBroadcast): void => {
      // D-22-11: single-in-flight rejection. Seqless error envelopes with the
      // run_in_progress message land here; surface as a Toast and stay in the
      // modal so the operator can [Dismiss] to back out.
      if (msg.type === "error" && msg.message === "run_in_progress") {
        toast.error(t("run.inProgressToast", { deviceName }));
        return;
      }
      dispatchScenarios({ type: "broadcast", broadcast: msg });
    },
    [toast, t, deviceName],
  );

  // Mount the ScenarioRunChannel subscription.
  const { dispatch: dispatchChannel } = useScenarioRunChannel({ socket: ws, onBroadcast });

  // Library → modal opener flow per D-22-07 + RUN-01.
  // The library row already holds the full Scenario from the index payload, so
  // we hand it straight to the modal and only the policy preview round-trips.
  const handleRunClick = useCallback(
    async (scenario: Scenario) => {
      setModalState({
        open: true,
        scenarioId: scenario.id,
        scenario,
        response: null,
        loading: true,
        error: null,
      });
      try {
        const targetDeviceId = scenario.pinned_device_id ?? deviceId;
        const preview = await scenariosService.policyPreview(
          scenario.id,
          targetDeviceId,
        );
        setModalState({
          open: true,
          scenarioId: scenario.id,
          scenario,
          response: preview,
          loading: false,
          error: null,
        });
      } catch {
        setModalState((prev) => ({
          ...prev,
          loading: false,
          error: t("library.empty"),
        }));
      }
    },
    [deviceId, t],
  );

  // Modal [Run all] click → dispatch start_run and transition to Run-mode.
  const handleApprove = useCallback(() => {
    const scenario = modalState.scenario;
    if (!scenario || !modalState.scenarioId) return;
    // Synthetic run launch — the actual run_id arrives on the run_started
    // broadcast; the reducer reconciles when the in-band marker comes through.
    const placeholderRunId = `pending-${Date.now()}`;
    dispatchScenarios({
      type: "run_launch",
      runId: placeholderRunId,
      scenarioId: modalState.scenarioId,
      scenarioName: scenario.name,
      deviceId,
      stepCount: scenario.command_steps.length,
      startedAt: Date.now(),
    });
    dispatchChannel("start_run", {
      scenario_id: modalState.scenarioId,
      device_id: scenario.pinned_device_id ?? deviceId,
    });
    setMode({
      kind: "run",
      runId: placeholderRunId,
      scenarioId: modalState.scenarioId,
      backTo: backTargetForRun(segment),
    });
    setModalState(initialModalState);
  }, [modalState, deviceId, dispatchChannel, segment]);

  const handleCancel = useCallback(() => {
    setModalState(initialModalState);
  }, []);

  // Run-mode handlers.
  const handleStop = useCallback(() => {
    dispatchChannel("stop_run");
    dispatchScenarios({ type: "run_stop_requested" });
  }, [dispatchChannel]);

  const handleBack = useCallback(() => {
    const backTo =
      mode.kind === "run" ? mode.backTo : backTargetForRun(segment);
    dispatchScenarios({ type: "run_clear" });
    setMode({ kind: backTo });
    setSegment(backTo);
  }, [mode, segment]);

  // History detail navigation.
  const handleSelectRun = useCallback((runId: string) => {
    setMode({ kind: "history_detail", runId });
  }, []);

  const handleHistoryDetailBack = useCallback(() => {
    setMode({ kind: "history" });
    setSegment("history");
  }, []);

  const handleHistoryDetailDeleted = useCallback(() => {
    setMode({ kind: "history" });
    setSegment("history");
  }, []);

  // ---------------------------------------------------------------------------
  // Phase 23 / Plan 23-09 — AI draft flow handlers
  // ---------------------------------------------------------------------------

  // ScenariosAISegment → onDraftReady. Opens DraftReviewModal with the
  // draft payload. Quota piggyback stays internal to the AI segment.
  // Phase 23 / Plan 23-11 (AI-10): `totalTokens` is the OpenRouter per-call
  // usage captured at draft time — stashed on the modal state so
  // [Accept and save] can forward it as `created_via_ai_token_count`.
  const handleDraftReady = useCallback(
    (draft: DraftResponse["draft"], totalTokens: number) => {
      setDraftModal({ open: true, draft, totalTokens, loading: false });
    },
    [],
  );

  // ScenariosAISegment → onPromptSubmit (NOT part of the v1 hook surface —
  // the segment captures the prompt internally; we mirror it via this
  // callback so [Regenerate Draft] can re-send the exact original text).
  const handlePromptSubmitted = useCallback((prompt: string) => {
    setLastAIPrompt(prompt);
  }, []);

  // DraftReviewModal [Accept and save]. D-11: strip `dry_intent_warning`
  // from every step via destructure-rest BEFORE POSTing — guarantees the
  // saved scenario row carries zero AI-draft-time annotations. Mutation-
  // free: the in-memory draft state retains the warning so if the operator
  // re-opens the modal the badge still renders.
  const handleAcceptDraft = useCallback(async () => {
    if (!draftModal.draft) return;
    setDraftModal((prev) => ({ ...prev, loading: true }));
    const draft = draftModal.draft;
    const totalTokens = draftModal.totalTokens;
    const cleanedSteps = draft.command_steps.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ dry_intent_warning, ...rest }) => rest,
    );
    try {
      await scenariosService.create({
        name: draft.name,
        description: draft.description,
        command_steps: cleanedSteps,
        created_via_ai: true,
        // Phase 23 / Plan 23-11 (AI-10): forward the OpenRouter per-call
        // token total so backend persists it on the scenarios row and stamps
        // scenario_runs.total_ai_gen_tokens at run start. Omit entirely when
        // null so the backend default applies (rather than sending 0).
        ...(totalTokens != null
          ? { created_via_ai_token_count: totalTokens }
          : {}),
      });
      setDraftModal(initialDraftModal);
      setMode({ kind: "library" });
      setSegment("library");
      toast.success(t("ai.acceptSuccess"));
    } catch (err) {
      // 422 name collision surfaces a toast + leaves modal open so the
      // operator can hit [Edit Draft] to rename in the manual editor.
      const data = (err as { response?: { data?: unknown } } | undefined)
        ?.response?.data as { errors?: { name?: string[] } } | undefined;
      if (data?.errors?.name?.length) {
        toast.error(t("ai.errors.nameTaken"));
      } else {
        toast.error(t("editor.errors.policyDenied"));
      }
      setDraftModal((prev) => ({ ...prev, loading: false }));
    }
  }, [draftModal.draft, draftModal.totalTokens, toast, t]);

  // DraftReviewModal [Edit Draft]. Closes the modal and transitions panel
  // mode to the manual editor with the draft prefilled + backTarget='ai'
  // so the [← Back] button returns to the AI segment.
  const handleEditDraft = useCallback(() => {
    if (!draftModal.draft) return;
    const draft = draftModal.draft;
    setDraftModal(initialDraftModal);
    setMode({
      kind: "editor",
      editingId: "new",
      prefill: draft,
      backTarget: "ai",
    });
  }, [draftModal.draft]);

  // DraftReviewModal [Regenerate Draft]. Closes the modal + bumps the
  // regenerate token so the ScenariosAISegment effect re-fires generate()
  // with `lastAIPrompt`. If the editor takeover has dirty state (D-03),
  // the dirty-guard fires inside the editor when [← Back] is clicked; the
  // regenerate flow itself does not touch the editor.
  const handleRegenerateDraft = useCallback(() => {
    setDraftModal(initialDraftModal);
    setRegenerateToken((n) => n + 1);
  }, []);

  // DraftReviewModal [Discard draft]. Closes modal, clears draft.
  const handleDiscardDraft = useCallback(() => {
    setDraftModal(initialDraftModal);
  }, []);

  const showSegmentedControl =
    mode.kind === "library" || mode.kind === "history" || mode.kind === "ai";

  // Compute the header title per mode.
  const headerTitle = (() => {
    switch (mode.kind) {
      case "library":
      case "history":
      case "ai":
        return t("library.title");
      case "editor":
        return t("editor.newScenarioTitle");
      case "run":
        return scenariosState.activeRun?.scenarioName ?? t("library.title");
      case "history_detail":
        return t("history.tabLabel");
    }
  })();

  return (
    <div
      className="flex h-full w-full flex-col bg-white"
      data-testid="scenarios-panel"
    >
      <header className="border-lightgray text-primary border-b px-4 py-2 text-sm font-semibold">
        {headerTitle}
      </header>
      {showSegmentedControl && (
        <div className="px-4 py-2">
          <SegmentedControl<ScenariosSegment>
            value={segment}
            options={[
              { value: "library", label: t("library.segmentLabel") },
              { value: "history", label: t("history.tabLabel") },
              { value: "ai", label: t("ai.segmentLabel") },
            ]}
            onChange={handleSegmentChange}
            data-testid="scenarios-panel-segment"
            ariaLabel={t("library.segmentLabel")}
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {mode.kind === "library" && (
          <ScenariosLibrary
            deviceId={deviceId}
            onEdit={(id) => setMode({ kind: "editor", editingId: id })}
            onNew={() => setMode({ kind: "editor", editingId: "new" })}
            onRun={handleRunClick}
            activeRunDeviceId={scenariosState.activeRun?.deviceId ?? null}
          />
        )}
        {mode.kind === "history" && (
          <ScenariosHistory onSelectRun={handleSelectRun} />
        )}
        {mode.kind === "ai" && (
          <div className="p-4" data-testid="scenarios-ai-segment">
            <ScenariosAISegment
              onDraftReady={handleDraftReady}
              onPromptSubmitted={handlePromptSubmitted}
              regenerateToken={regenerateToken}
              regeneratePrompt={lastAIPrompt}
            />
          </div>
        )}
        {mode.kind === "editor" && (
          <ScenarioEditor
            deviceId={deviceId}
            editingId={mode.editingId}
            onClose={() => {
              const target = mode.backTarget ?? segment;
              setMode({ kind: target });
              setSegment(target);
            }}
            prefill={mode.prefill}
            backTarget={mode.backTarget}
          />
        )}
        {mode.kind === "run" && scenariosState.activeRun && (
          <ScenariosRunMode
            activeRun={scenariosState.activeRun}
            deviceName={deviceName}
            backTo={mode.backTo}
            onStop={handleStop}
            onBack={handleBack}
            commandSteps={
              modalState.scenario?.command_steps.map((cs) => ({
                id: cs.id,
                binary: cs.binary,
                args: cs.args,
                cwd: cs.cwd,
                description: cs.description ?? undefined,
              })) ?? []
            }
          />
        )}
        {mode.kind === "history_detail" && (
          <ScenariosHistoryDetail
            runId={mode.runId}
            activeRun={scenariosState.activeRun}
            onBack={handleHistoryDetailBack}
            onDeleted={handleHistoryDetailDeleted}
          />
        )}
      </div>

      {/* PolicyPreviewModal mounted at the panel root */}
      <PolicyPreviewModal
        open={modalState.open}
        response={modalState.response}
        loading={modalState.loading}
        error={modalState.error}
        scenarioName={modalState.scenario?.name ?? ""}
        deviceName={deviceName}
        deviceId={deviceId}
        canChangeDevice={false}
        commandSteps={
          modalState.scenario?.command_steps.map((cs) => ({
            id: cs.id,
            binary: cs.binary,
            args: cs.args,
            cwd: cs.cwd,
            description: cs.description ?? undefined,
          })) ?? []
        }
        onApprove={handleApprove}
        onCancel={handleCancel}
      />

      {/* Phase 23 / Plan 23-09: DraftReviewModal mounted at panel root */}
      <DraftReviewModal
        open={draftModal.open}
        draft={draftModal.draft}
        loading={draftModal.loading}
        onAccept={handleAcceptDraft}
        onEdit={handleEditDraft}
        onRegenerate={handleRegenerateDraft}
        onCancel={handleDiscardDraft}
      />
    </div>
  );
}
