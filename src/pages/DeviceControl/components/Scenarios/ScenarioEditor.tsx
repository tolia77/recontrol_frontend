import { useTranslation } from "react-i18next";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import StepRow from "./StepRow";
import DirtyGuardModal from "./DirtyGuardModal";
import type { ScenariosSegment } from "./scenariosReducer";
import {
  useScenarioEditor,
  type ScenarioEditorPrefill,
} from "src/pages/DeviceControl/hooks/state/useScenarioEditor";
export type { ScenarioEditorPrefill } from "src/pages/DeviceControl/hooks/state/useScenarioEditor";

export interface ScenarioEditorProps {
  // deviceId is plumbed in by ScenariosPanel; reserved for the future
  // policy-preview / pre-approve gate (P22) — the editor itself does not
  // currently call /policy_preview (D-09: save-time evaluate only).
  deviceId: string;
  editingId: string | "new";
  onClose: () => void;
  // Phase 23 / Plan 23-09: optional AI-draft prefill. When present AND
  // `editingId === 'new'`, the initial form state is seeded from `prefill`
  // instead of empty defaults. Steps from prefill have NO id field (D-12);
  // the editor's blankStep-style UUID assignment is applied per-step on
  // hydration so dirty-state + drag-reorder operate on stable keys.
  prefill?: ScenarioEditorPrefill;
  // Phase 23 / Plan 23-09: back-navigation target. When `'ai'`, the
  // [← Back] button label uses `editor.backToAI` ("← Back to AI prompt").
  // The dirty-state guard (DirtyGuardModal) fires regardless of backTarget.
  backTarget?: ScenariosSegment;
}

// D-01: full-takeover editor. ScenariosPanel mounts this when its mode
// flips to `editor`; the header [← Back to library] button flips back via
// onClose (intercepted by DirtyGuardModal when dirty).
export default function ScenarioEditor({
  editingId,
  onClose,
  prefill,
  backTarget,
}: ScenarioEditorProps) {
  const { t } = useTranslation("scenarios");
  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  const {
    name,
    setName,
    description,
    setDescription,
    pinnedDeviceId,
    setPinnedDeviceId,
    isShared,
    setIsShared,
    steps,
    verdicts,
    topError,
    nameError,
    saving,
    loading,
    showDirtyModal,
    setShowDirtyModal,
    sortableIds,
    onDragEnd,
    addStep,
    updateStep,
    duplicateStep,
    removeStep,
    requestClose,
    handleSave,
  } = useScenarioEditor({ editingId, prefill, onClose });

  return (
    <div className="flex h-full flex-col" data-testid="scenario-editor">
      {/* D-01: header with [← Back to library] */}
      <div className="border-lightgray flex items-center gap-2 border-b px-4 py-2">
        <button
          type="button"
          className="hover:bg-tertiary rounded px-2 py-1 text-sm"
          onClick={requestClose}
          data-testid="editor-back"
        >
          {backTarget === "ai"
            ? t("editor.backToAI")
            : t("editor.backToLibrary")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        <label className="text-darkgray block text-xs">
          {t("editor.nameLabel")}
        </label>
        <input
          type="text"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("editor.namePlaceholder")}
          className="border-lightgray w-full rounded border px-2 py-1 text-sm"
          data-testid="editor-name"
          disabled={loading || saving}
        />
        {nameError && (
          <div
            className="text-error mt-1 text-xs"
            data-testid="editor-name-error"
          >
            {nameError}
          </div>
        )}

        <label className="text-darkgray mt-2 block text-xs">
          {t("editor.descriptionLabel")}
        </label>
        <textarea
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("editor.descriptionPlaceholder")}
          rows={2}
          className="border-lightgray w-full rounded border px-2 py-1 text-sm"
          data-testid="editor-description"
          disabled={loading || saving}
        />

        <div className="mt-2 flex items-center gap-2">
          <label className="text-darkgray text-xs">
            {t("editor.pinDeviceLabel")}
          </label>
          <input
            type="text"
            value={pinnedDeviceId ?? ""}
            onChange={(e) => setPinnedDeviceId(e.target.value || null)}
            placeholder={t("editor.pinDevicePlaceholder")}
            className="border-lightgray rounded border px-2 py-1 text-sm"
            data-testid="editor-pin-device"
            disabled={loading || saving}
          />
          <label className="text-darkgray ml-auto inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              disabled={!pinnedDeviceId || loading || saving}
              data-testid="editor-is-shared"
            />
            {t("editor.shareToggleLabel")}
          </label>
        </div>
        {isShared && !pinnedDeviceId && (
          <div className="text-amber text-xs" data-testid="editor-share-hint">
            {t("editor.sharePinRequired")}
          </div>
        )}

        {topError && (
          <div
            className="bg-error/10 text-error mt-2 rounded px-2 py-1 text-sm"
            data-testid="editor-top-error"
          >
            {topError}
          </div>
        )}

        <div className="mt-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {steps.map((s, idx) => (
                  <StepRow
                    key={s.id}
                    step={s}
                    index={idx}
                    verdict={verdicts[s.id]}
                    onChange={(next) => updateStep(idx, next)}
                    onDuplicate={() => duplicateStep(idx)}
                    onRemove={() => removeStep(idx)}
                    disabled={saving || loading}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            className="border-lightgray hover:bg-tertiary mt-2 rounded border border-dashed px-2 py-1 text-sm disabled:opacity-50"
            onClick={addStep}
            disabled={saving || loading}
            data-testid="editor-add-step"
          >
            {t("editor.steps.addStep")}
          </button>
        </div>
      </div>

      {/* D-02: sticky bottom bar */}
      <div className="border-lightgray bg-background sticky bottom-0 flex items-center justify-end gap-2 border-t px-4 py-2">
        <button
          type="button"
          className="hover:bg-tertiary rounded px-3 py-1 text-sm disabled:opacity-50"
          onClick={requestClose}
          data-testid="editor-cancel"
          disabled={saving}
        >
          {t("editor.bottomBar.cancel")}
        </button>
        <button
          type="button"
          className="bg-primary rounded px-3 py-1 text-sm text-white hover:opacity-90 disabled:opacity-50"
          onClick={handleSave}
          disabled={saving || loading}
          data-testid="editor-save"
        >
          {saving ? t("editor.bottomBar.saving") : t("editor.bottomBar.save")}
        </button>
      </div>

      <DirtyGuardModal
        open={showDirtyModal}
        onDiscard={() => {
          setShowDirtyModal(false);
          onClose();
        }}
        onKeepEditing={() => setShowDirtyModal(false)}
      />
    </div>
  );
}
