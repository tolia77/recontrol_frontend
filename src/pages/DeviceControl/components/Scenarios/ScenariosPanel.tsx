import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { SegmentedControl } from "src/components/ui";
import ScenariosLibrary from "./ScenariosLibrary";
import ScenarioEditor from "./ScenarioEditor";
import ScenariosHistory from "./ScenariosHistory";
import ScenariosHistoryDetail from "./ScenariosHistoryDetail";
import ScenariosRunMode from "./ScenariosRunMode";
import PolicyPreviewModal from "./PolicyPreviewModal";
import ScenariosAISegment from "./ScenariosAISegment";
import DraftReviewModal from "./DraftReviewModal";
import type { DraftResponse } from "src/services/backend/scenariosService";
import type { ScenariosSegment } from "./scenariosReducer";
import { useScenariosPanelActions } from "src/pages/DeviceControl/hooks/state/useScenariosPanelActions";
import type { CableConsumerLike } from "src/pages/DeviceControl/hooks/realtime/useCableConsumer";

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

export interface ScenariosPanelProps {
  deviceId: string;
  consumer: CableConsumerLike | null;
  connected: boolean;
  deviceName: string;
  // When false, the library renders with [▶ Run] disabled (no live device
  // socket to dispatch a run over). Used by the standalone /scenarios page,
  // which hosts the panel device-less for authoring/management only.
  runEnabled?: boolean;
}

export default function ScenariosPanel({
  deviceId,
  consumer,
  connected,
  deviceName,
  runEnabled = true,
}: ScenariosPanelProps) {
  const { t } = useTranslation("scenarios");

  // Segment state — initialized from sessionStorage (UI-05).
  const initialSegment = readSegmentFromStorage();
  const [segment, setSegment] = useState<ScenariosSegment>(initialSegment);

  // Mode router — starts in the initial segment (library / history / ai).
  const [mode, setMode] = useState<PanelMode>({
    kind: initialSegment,
  });

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

  const {
    scenariosState,
    modalState,
    draftModal,
    lastAIPrompt,
    regenerateToken,
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
  } = useScenariosPanelActions({ deviceId, consumer, connected, deviceName, segment, setMode, setSegment });

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
      className="flex h-full w-full flex-col bg-background"
      data-testid="scenarios-panel"
    >
      <header className="border-lightgray text-primary border-b px-4 py-2 text-sm font-semibold">
        {headerTitle}
      </header>
      {showSegmentedControl && (
        <div className="overflow-x-auto px-4 py-2">
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
      <div className="min-h-0 flex-1 overflow-auto overflow-x-hidden">
        {mode.kind === "library" && (
          <ScenariosLibrary
            deviceId={deviceId}
            onEdit={(id) => setMode({ kind: "editor", editingId: id })}
            onNew={() => setMode({ kind: "editor", editingId: "new" })}
            onRun={handleRunClick}
            activeRunDeviceId={scenariosState.activeRun?.deviceId ?? null}
            runEnabled={runEnabled}
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
