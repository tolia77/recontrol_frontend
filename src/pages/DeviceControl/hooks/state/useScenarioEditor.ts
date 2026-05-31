import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  scenariosService,
  type CommandStep,
  type ScenarioCreatePayload,
  type VerdictAtSave,
} from "src/services/backend/scenariosService";

// AI-draft prefill shape (D-12 — no `id` field; UUIDs assigned at save time
// via Scenario#before_validation). Matches DraftResponse['draft'] from
// scenariosService.ts but is repeated here so the editor's public prop
// surface does not require importing the full draft envelope.
// Re-exported so ScenarioEditor.tsx can import it from here without circular deps.
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

// LIB-07: server assigns step ids on create. Client-generated ids from
// crypto.randomUUID() are stable in the editor for React keys + @dnd-kit, but
// we omit them from the payload for steps that have not yet been persisted
// (heuristic: no classified_intent_at_save snapshot). Persisted steps keep
// their ids so reorders / edits map to the existing rows.
type PayloadStep = ScenarioCreatePayload["command_steps"][number];

function blankStep(): CommandStep {
  return {
    id: crypto.randomUUID(),
    binary: "",
    args: [],
    cwd: "/",
    description: "",
  };
}

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

export interface UseScenarioEditorArgs {
  editingId: string | "new";
  prefill?: ScenarioEditorPrefill;
  onClose: () => void;
}

export interface UseScenarioEditorReturn {
  // form state
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  pinnedDeviceId: string | null;
  setPinnedDeviceId: (v: string | null) => void;
  isShared: boolean;
  setIsShared: (v: boolean) => void;
  steps: CommandStep[];
  verdicts: Record<string, VerdictAtSave>;
  topError: string | null;
  nameError: string | null;
  saving: boolean;
  loading: boolean;
  dirty: boolean;
  showDirtyModal: boolean;
  setShowDirtyModal: (v: boolean) => void;
  sortableIds: string[];
  // handlers
  onDragEnd: (e: DragEndEvent) => void;
  addStep: () => void;
  updateStep: (i: number, next: CommandStep) => void;
  duplicateStep: (i: number) => void;
  removeStep: (i: number) => void;
  requestClose: () => void;
  handleSave: () => Promise<void>;
}

/**
 * Owns all form state for ScenarioEditor: load/save/dirty detection,
 * step CRUD, DnD reorder, and the dirty-guard close flow.
 *
 * Per D-06: mechanical behavior-preserving extraction from ScenarioEditor.tsx.
 * Per D-02: plain useState (transitions are independent, no interrelation).
 * Extracted in Phase 28.1 Plan 01.
 */
export function useScenarioEditor(
  args: UseScenarioEditorArgs,
): UseScenarioEditorReturn {
  const { editingId, prefill, onClose } = args;
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

  const sortableIds = useMemo(() => steps.map((s) => s.id), [steps]);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      setSteps((arr) => {
        const oldIndex = arr.findIndex((s) => s.id === active.id);
        const newIndex = arr.findIndex((s) => s.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return arr;
        return arrayMove(arr, oldIndex, newIndex);
      });
    },
    [],
  );

  const addStep = useCallback(() => {
    setTopError(null);
    if (steps.length >= 20) {
      setTopError(t("editor.errors.stepsTooMany"));
      return;
    }
    setSteps([...steps, blankStep()]);
  }, [steps, t]);

  const updateStep = useCallback(
    (i: number, next: CommandStep) =>
      setSteps((arr) => arr.map((s, idx) => (idx === i ? next : s))),
    [],
  );

  const duplicateStep = useCallback(
    (i: number) => {
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
    },
    [steps, t],
  );

  const removeStep = useCallback(
    (i: number) => {
      setTopError(null);
      if (steps.length <= 1) {
        setTopError(t("editor.errors.stepsEmpty"));
        return;
      }
      setSteps(steps.filter((_, idx) => idx !== i));
    },
    [steps, t],
  );

  const requestClose = useCallback(() => {
    if (dirty) setShowDirtyModal(true);
    else onClose();
  }, [dirty, onClose]);

  const handleSave = useCallback(async () => {
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
  }, [editingId, isShared, pinnedDeviceId, steps, name, description, t]);

  return useMemo(
    () => ({
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
      dirty,
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
    }),
    [
      name,
      description,
      pinnedDeviceId,
      isShared,
      steps,
      verdicts,
      topError,
      nameError,
      saving,
      loading,
      dirty,
      showDirtyModal,
      sortableIds,
      onDragEnd,
      addStep,
      updateStep,
      duplicateStep,
      removeStep,
      requestClose,
      handleSave,
    ],
  );
}
