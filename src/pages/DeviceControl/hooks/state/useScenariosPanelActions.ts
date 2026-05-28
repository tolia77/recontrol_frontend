import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "../../../../components/ui";
import {
  scenariosService,
  type DraftResponse,
  type PolicyPreviewResponse,
  type Scenario,
} from "../../../../services/backend/scenariosService";
import { useScenarioRunChannel } from "../realtime/useScenarioRunChannel";
import type {
  ScenarioRunBroadcast,
  ScenarioRunDispatchAction,
} from "../realtime/useScenarioRunChannel";
import {
  initialScenariosState,
  scenariosReducer,
  type ScenariosSegment,
  type ScenariosState,
} from "../../components/Scenarios/scenariosReducer";

// ---------------------------------------------------------------------------
// PanelMode — duplicated here so the hook does not need to import from the
// component file (avoids a circular dep). Kept identical to ScenariosPanel.tsx.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Modal state types — kept co-located with the hook that owns them.
// ---------------------------------------------------------------------------

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

// Run-mode back targets are always library or history (not 'ai').
function backTargetForRun(segment: ScenariosSegment): "library" | "history" {
  return segment === "history" ? "history" : "library";
}

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface UseScenariosPanelActionsArgs {
  deviceId: string;
  ws: WebSocket | null;
  deviceName: string;
  /** Current segment value from the component — read by handleBack, handleApprove. */
  segment: ScenariosSegment;
  setMode: React.Dispatch<React.SetStateAction<PanelMode>>;
  setSegment: React.Dispatch<React.SetStateAction<ScenariosSegment>>;
}

export interface UseScenariosPanelActionsReturn {
  // reducer pair
  scenariosState: ScenariosState;
  // modal state
  modalState: ModalState;
  // draft modal state
  draftModal: DraftModalState;
  // AI ephemeral state
  lastAIPrompt: string | null;
  regenerateToken: number;
  // channel send side
  dispatchChannel: (action: ScenarioRunDispatchAction, payload?: object) => void;
  // handlers
  handleRunClick: (scenario: Scenario) => Promise<void>;
  handleApprove: () => void;
  handleCancel: () => void;
  handleStop: () => void;
  handleBack: () => void;
  handleSelectRun: (runId: string) => void;
  handleHistoryDetailBack: () => void;
  handleHistoryDetailDeleted: () => void;
  handleDraftReady: (
    draft: DraftResponse["draft"],
    totalTokens: number,
  ) => void;
  handlePromptSubmitted: (prompt: string) => void;
  handleAcceptDraft: () => Promise<void>;
  handleEditDraft: () => void;
  handleRegenerateDraft: () => void;
  handleDiscardDraft: () => void;
}

/**
 * Owns the ScenariosPanel channel, modal, AI draft, and all action handlers.
 * Moves the scenariosReducer pair, policy-preview modal state, draft-review
 * modal state, AI ephemeral state (lastAIPrompt, regenerateToken),
 * modalOpenRef + its sync effect, the useScenarioRunChannel subscription, and
 * all panel action handlers out of ScenariosPanel into this hook.
 *
 * Per D-06: mechanical behavior-preserving extraction — no logic rewrites,
 * protocol, or UX changes.
 * Per D-03: genuine cohesion seam — reducer + run channel + AI-draft handlers
 * extract cleanly, leaving the component with only segment/mode state + JSX.
 */
export function useScenariosPanelActions(
  args: UseScenariosPanelActionsArgs,
): UseScenariosPanelActionsReturn {
  const { deviceId, ws, deviceName, segment, setMode, setSegment } = args;

  const { t } = useTranslation("scenarios");
  const toast = useToast();

  // Scenarios outer reducer (composes transcriptReducer for live run state).
  // segment passed in args equals readSegmentFromStorage() on mount (the
  // component initialises it from storage before calling this hook).
  const [scenariosState, dispatchScenarios] = useReducer(scenariosReducer, {
    ...initialScenariosState,
    segment,
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

  // Keep a stable ref to the active modal state so the broadcast handler does
  // not need to re-mount on every modal mutation. (RESEARCH Risk/A1: these
  // must stay co-located with modalState to prevent stale closure in onBroadcast.)
  const modalOpenRef = useRef<boolean>(false);
  useEffect(() => {
    modalOpenRef.current = modalState.open;
  }, [modalState.open]);

  // Channel broadcast handler. Dispatches into the reducer; surfaces the
  // single-in-flight rejection as a Toast (D-22-11).
  // useCallback wrapping preserved from the original to avoid re-subscribe
  // on every render (RESEARCH Pitfall 2).
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

  // Mount the ScenarioRunChannel subscription. The hook owns the channel
  // and exposes dispatchChannel — it does NOT receive dispatchChannel as a prop.
  const { dispatch: dispatchChannel } = useScenarioRunChannel({
    socket: ws,
    onBroadcast,
  });

  // ---------------------------------------------------------------------------
  // Library → modal opener flow per D-22-07 + RUN-01.
  // The library row already holds the full Scenario from the index payload, so
  // we hand it straight to the modal and only the policy preview round-trips.
  // ---------------------------------------------------------------------------
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
  }, [modalState, deviceId, dispatchChannel, segment, setMode]);

  const handleCancel = useCallback(() => {
    setModalState(initialModalState);
  }, []);

  // Run-mode handlers.
  const handleStop = useCallback(() => {
    dispatchChannel("stop_run");
    dispatchScenarios({ type: "run_stop_requested" });
  }, [dispatchChannel]);

  const handleBack = useCallback(() => {
    const backTo = backTargetForRun(segment);
    dispatchScenarios({ type: "run_clear" });
    setMode({ kind: backTo });
    setSegment(backTo);
  }, [segment, setMode, setSegment]);

  // History detail navigation.
  const handleSelectRun = useCallback((runId: string) => {
    setMode({ kind: "history_detail", runId });
  }, [setMode]);

  const handleHistoryDetailBack = useCallback(() => {
    setMode({ kind: "history" });
    setSegment("history");
  }, [setMode, setSegment]);

  const handleHistoryDetailDeleted = useCallback(() => {
    setMode({ kind: "history" });
    setSegment("history");
  }, [setMode, setSegment]);

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
  }, [draftModal.draft, draftModal.totalTokens, toast, t, setMode, setSegment]);

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
  }, [draftModal.draft, setMode]);

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

  return useMemo(
    () => ({
      scenariosState,
      modalState,
      draftModal,
      lastAIPrompt,
      regenerateToken,
      dispatchChannel,
      handleRunClick,
      handleApprove,
      handleCancel,
      handleStop,
      handleBack,
      handleSelectRun,
      handleHistoryDetailBack,
      handleHistoryDetailDeleted,
      handleDraftReady,
      handlePromptSubmitted,
      handleAcceptDraft,
      handleEditDraft,
      handleRegenerateDraft,
      handleDiscardDraft,
    }),
    [
      scenariosState,
      modalState,
      draftModal,
      lastAIPrompt,
      regenerateToken,
      dispatchChannel,
      handleRunClick,
      handleApprove,
      handleCancel,
      handleStop,
      handleBack,
      handleSelectRun,
      handleHistoryDetailBack,
      handleHistoryDetailDeleted,
      handleDraftReady,
      handlePromptSubmitted,
      handleAcceptDraft,
      handleEditDraft,
      handleRegenerateDraft,
      handleDiscardDraft,
    ],
  );
}
