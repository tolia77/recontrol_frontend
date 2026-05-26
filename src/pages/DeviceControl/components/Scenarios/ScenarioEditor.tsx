import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  scenariosService,
  type CommandStep,
  type ScenarioCreatePayload,
  type VerdictAtSave,
} from "src/services/backend/scenariosService";
import StepRow from "./StepRow";
import DirtyGuardModal from "./DirtyGuardModal";
import type { ScenariosSegment } from "./scenariosReducer";

// AI-draft prefill shape (D-12 — no `id` field; UUIDs assigned at save time
// via Scenario#before_validation). Matches DraftResponse['draft'] from
// scenariosService.ts but is repeated here so the editor's public prop
// surface does not require importing the full draft envelope.
export interface ScenarioEditorPrefill {
  name: string;
  description: string;
  command_steps: Array<{
    binary: string;
    args: string[];
    cwd: string;
    description?: string | null;
  }>;
}

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

function blankStep(): CommandStep {
  return {
    id: crypto.randomUUID(),
    binary: "",
    args: [],
    cwd: "/",
    description: "",
  };
}

// LIB-07: server assigns step ids on create. Client-generated ids from
// crypto.randomUUID() are stable in the editor for React keys + @dnd-kit, but
// we omit them from the payload for steps that have not yet been persisted
// (heuristic: no classified_intent_at_save snapshot). Persisted steps keep
// their ids so reorders / edits map to the existing rows.
type PayloadStep = ScenarioCreatePayload["command_steps"][number];

function toPayloadStep(s: CommandStep): PayloadStep {
  const looksClientGenerated = !s.classified_intent_at_save;
  return looksClientGenerated
    ? {
        binary: s.binary,
        args: s.args,
        cwd: s.cwd,
        description: s.description ?? null,
      }
    : {
        id: s.id,
        binary: s.binary,
        args: s.args,
        cwd: s.cwd,
        description: s.description ?? null,
      };
}

function snapshotPayload(
  name: string,
  description: string,
  pinnedDeviceId: string | null,
  isShared: boolean,
  steps: CommandStep[],
): string {
  return JSON.stringify({
    name,
    description: description || null,
    pinned_device_id: pinnedDeviceId,
    is_shared: isShared,
    command_steps: steps.map((s) => ({
      id: s.id,
      binary: s.binary,
      args: s.args,
      cwd: s.cwd,
      description: s.description ?? null,
    })),
  });
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pinnedDeviceId, setPinnedDeviceId] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(false);
  const [steps, setSteps] = useState<CommandStep[]>(() => [blankStep()]);
  const [verdicts, setVerdicts] = useState<Record<string, VerdictAtSave>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showDirtyModal, setShowDirtyModal] = useState(false);
  const initialSnapshotRef = useRef<string>("");

  // Hydrate from server (or seed a blank scenario when creating).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setTopError(null);
      setNameError(null);
      setVerdicts({});
      if (editingId === "new") {
        // Phase 23 / Plan 23-09: AI-draft prefill seeds the initial form
        // state. Each prefilled step is wrapped in a client-side
        // crypto.randomUUID() so the editor's @dnd-kit + dirty-state guard
        // can key off `id`. The UUID is intentionally dropped at save time
        // by toPayloadStep — server's Scenario#before_validation assigns
        // canonical UUIDs (D-12).
        const seedName = prefill?.name ?? "";
        const seedDescription = prefill?.description ?? "";
        const seedSteps: CommandStep[] = prefill
          ? prefill.command_steps.map((s) => ({
              id: crypto.randomUUID(),
              binary: s.binary,
              args: [...s.args],
              cwd: s.cwd,
              description: s.description ?? "",
            }))
          : [blankStep()];
        if (cancelled) return;
        setName(seedName);
        setDescription(seedDescription);
        setPinnedDeviceId(null);
        setIsShared(false);
        setSteps(seedSteps);
        initialSnapshotRef.current = snapshotPayload(
          seedName,
          seedDescription,
          null,
          false,
          seedSteps,
        );
        setDirty(false);
        return;
      }
      setLoading(true);
      try {
        const s = await scenariosService.show(editingId);
        if (cancelled) return;
        setName(s.name);
        setDescription(s.description ?? "");
        setPinnedDeviceId(s.pinned_device_id);
        setIsShared(s.is_shared);
        setSteps(s.command_steps);
        initialSnapshotRef.current = snapshotPayload(
          s.name,
          s.description ?? "",
          s.pinned_device_id,
          s.is_shared,
          s.command_steps,
        );
        setDirty(false);
      } catch {
        if (!cancelled) setTopError(t("editor.errors.policyDenied"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  // D-04: dirty detection — pure derived flag, recomputed on every relevant
  // change. Compared against the snapshot captured at last load/save.
  useEffect(() => {
    const current = snapshotPayload(
      name,
      description,
      pinnedDeviceId,
      isShared,
      steps,
    );
    setDirty(current !== initialSnapshotRef.current);
  }, [name, description, pinnedDeviceId, isShared, steps]);

  // SHARE-03: chained-control — `is_shared` is meaningless without a pin.
  // If the user clears the pin while shared, force `is_shared` back to false.
  useEffect(() => {
    if (!pinnedDeviceId && isShared) setIsShared(false);
  }, [pinnedDeviceId, isShared]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(TouchSensor));

  const sortableIds = useMemo(() => steps.map((s) => s.id), [steps]);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSteps((arr) => {
      const oldIndex = arr.findIndex((s) => s.id === active.id);
      const newIndex = arr.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return arr;
      return arrayMove(arr, oldIndex, newIndex);
    });
  };

  const addStep = () => {
    setTopError(null);
    if (steps.length >= 20) {
      setTopError(t("editor.errors.stepsTooMany"));
      return;
    }
    setSteps([...steps, blankStep()]);
  };

  const updateStep = (i: number, next: CommandStep) =>
    setSteps((arr) => arr.map((s, idx) => (idx === i ? next : s)));

  const duplicateStep = (i: number) => {
    setTopError(null);
    if (steps.length >= 20) {
      setTopError(t("editor.errors.stepsTooMany"));
      return;
    }
    // LIB-07 boundary: drop server-only snapshots from the copy so the
    // duplicate is sent as a fresh step on save (server assigns a new id).
    const src = steps[i];
    const copy: CommandStep = {
      id: crypto.randomUUID(),
      binary: src.binary,
      args: [...src.args],
      cwd: src.cwd,
      description: src.description,
    };
    setSteps([...steps.slice(0, i + 1), copy, ...steps.slice(i + 1)]);
  };

  const removeStep = (i: number) => {
    setTopError(null);
    if (steps.length <= 1) {
      setTopError(t("editor.errors.stepsEmpty"));
      return;
    }
    setSteps(steps.filter((_, idx) => idx !== i));
  };

  const requestClose = () => {
    if (dirty) setShowDirtyModal(true);
    else onClose();
  };

  const handleSave = async () => {
    setTopError(null);
    setNameError(null);
    setVerdicts({});
    // SHARE-03 client-side hint — server validates too.
    if (isShared && !pinnedDeviceId) {
      setTopError(t("editor.errors.policyDenied"));
      return;
    }
    setSaving(true);
    try {
      const payloadSteps = steps.map(toPayloadStep);
      const payload: ScenarioCreatePayload = {
        name,
        description: description || null,
        pinned_device_id: pinnedDeviceId,
        is_shared: isShared,
        command_steps: payloadSteps,
      };
      const result =
        editingId === "new"
          ? await scenariosService.create(payload)
          : await scenariosService.update(editingId, payload);
      // D-10: render verdict badges per step.
      const v: Record<string, VerdictAtSave> = {};
      result.scenario.command_steps.forEach((s) => {
        if (s.verdict_at_save) v[s.id] = s.verdict_at_save;
      });
      setVerdicts(v);
      setSteps(result.scenario.command_steps);
      setName(result.scenario.name);
      setDescription(result.scenario.description ?? "");
      setPinnedDeviceId(result.scenario.pinned_device_id);
      setIsShared(result.scenario.is_shared);
      initialSnapshotRef.current = snapshotPayload(
        result.scenario.name,
        result.scenario.description ?? "",
        result.scenario.pinned_device_id,
        result.scenario.is_shared,
        result.scenario.command_steps,
      );
      setDirty(false);
    } catch (err) {
      // D-10: 422 deny envelope handling. POLICY-04: deny is server-enforced;
      // we render the red borders + top error and KEEP unsaved state so the
      // user can fix the offending step(s) without re-typing.
      const data = (err as { response?: { data?: unknown } } | undefined)
        ?.response?.data as
        | {
            errors?: {
              command_steps?: Array<{ step_index: number; reason: string }>;
              name?: string[];
            };
          }
        | undefined;
      if (data?.errors?.command_steps?.length) {
        const denyMap: Record<string, VerdictAtSave> = {};
        for (const e of data.errors.command_steps) {
          const step = steps[e.step_index];
          if (step) {
            denyMap[step.id] = { decision: "deny", reason: e.reason };
          }
        }
        setVerdicts(denyMap);
        setTopError(t("editor.errors.policyDenied"));
      } else if (data?.errors?.name?.length) {
        // LIB-04 inline rename collision.
        setNameError(t("editor.errors.nameTaken"));
      } else {
        setTopError(t("editor.errors.policyDenied"));
      }
    } finally {
      setSaving(false);
    }
  };

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
