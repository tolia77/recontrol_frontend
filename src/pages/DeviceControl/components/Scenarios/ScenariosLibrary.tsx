import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  scenariosService,
  type Scenario,
} from "src/services/backend/scenariosService";
import { getUserId } from "src/utils/auth";
import {
  ConfirmModal,
  LoadingState,
  ErrorState,
  EmptyState,
  useToast,
} from "src/components/ui";
import ScenariosRow from "./ScenariosRow";
import { useGate } from "src/hooks/useGate";
import UpgradeModal from "src/components/ui/UpgradeModal";

export interface ScenariosLibraryProps {
  deviceId: string;
  onEdit: (id: string) => void;
  onNew: () => void;
  // D-22-08: Plan 22.10's panel wiring plugs this into the PolicyPreviewModal
  // opener. Plan 22.07 only requires the prop plumbing reach ScenariosRow.
  onRun: (scenario: Scenario) => void;
  // Single-in-flight signal — when an active run is running on this device id,
  // every row pinned to that device disables its [▶ Run] button.
  activeRunDeviceId?: string | null;
  // Device-less hosting (standalone /scenarios dashboard page): no live device
  // socket exists, so running is impossible. When false, every row's [▶ Run]
  // is hidden and a hint explains that running requires a device session.
  runEnabled?: boolean;
}

export default function ScenariosLibrary({
  deviceId,
  onEdit,
  onNew,
  onRun,
  activeRunDeviceId = null,
  runEnabled = true,
}: ScenariosLibraryProps) {
  const { t } = useTranslation("scenarios");
  const toast = useToast();
  const gate = useGate("scenario_limit");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleNew = () => {
    if (!gate.allowed) {
      setShowUpgradeModal(true);
      return;
    }
    onNew();
  };

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  // The library lives inside DeviceControl which is scoped to a single device.
  // The pinned-device filter dropdown therefore offers exactly two values in
  // P21: "" (all visible scenarios) and the currently-controlled device id.
  // Full multi-device picker is a v1.6+ enhancement (CONTEXT "Claude's
  // Discretion": "list devices the operator has access to ...").
  const [pinnedFilter, setPinnedFilter] = useState<string>("");
  // Pending-delete target: null means no dialog open; non-null means confirm modal open.
  const [deleteTarget, setDeleteTarget] = useState<Scenario | null>(null);
  // In-flight delete lock — mirrors AdminUsers deleting pattern (WR-05).
  const [deleting, setDeleting] = useState(false);
  const currentUserId = getUserId() ?? "";

  // LIB-03: 200ms debounce per CONTEXT "Claude's Discretion".
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 200);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    scenariosService
      .index({
        q: debouncedQ || undefined,
        pinned_device_id: pinnedFilter || undefined,
      })
      .then((data) => {
        if (!cancelled) setScenarios(data);
      })
      .catch(() => {
        if (!cancelled) setError(t("library.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, pinnedFilter, t]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await scenariosService.index({
        q: debouncedQ || undefined,
        pinned_device_id: pinnedFilter || undefined,
      });
      setScenarios(data);
    } catch {
      setError(t("library.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      await scenariosService.destroy(target.id);
      await reload();
    } catch {
      // A delete failure is an action error — surface it via toast so it does
      // not masquerade as an empty library in the list-level error banner.
      toast.error(t("library.deleteError"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDelete = (s: Scenario) => {
    setDeleteTarget(s);
  };

  const handleDuplicate = async (s: Scenario) => {
    // LIB-05: server appends "(copy)" with collision-suffix bumping; UI just
    // calls the endpoint and jumps into the editor for the new row.
    try {
      const result = await scenariosService.duplicate(s.id);
      await reload();
      onEdit(result.scenario.id);
    } catch {
      // Duplicate failure was previously silent — surface it via toast so the
      // user is not left believing a copy was created.
      toast.error(t("library.duplicateError"));
    }
  };

  const empty = !loading && scenarios.length === 0;

  return (
    <div className="flex max-w-full flex-col gap-2 overflow-x-hidden p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="bg-primary rounded-md px-3 py-1.5 text-body font-medium text-white hover:bg-primary-hover active:bg-primary-active transition-colors duration-150"
          onClick={handleNew}
          data-testid="scenarios-new-button"
        >
          {t("library.newButton")}
        </button>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("library.searchPlaceholder")}
          className="border-border focus-visible:ring-primary/30 min-w-[12ch] flex-1 rounded-sm border px-2 py-1.5 text-body focus-visible:ring-2 focus-visible:outline-none"
          data-testid="scenarios-search-input"
        />
        <select
          value={pinnedFilter}
          onChange={(e) => setPinnedFilter(e.target.value)}
          className="border-border focus-visible:ring-primary/30 rounded-sm border px-2 py-1.5 text-body focus-visible:ring-2 focus-visible:outline-none"
          data-testid="scenarios-pinned-filter"
        >
          <option value="">{t("library.pinnedDeviceFilter")}</option>
          {deviceId && (
            <option value={deviceId}>
              {t("library.pinnedDeviceChip", { device: deviceId.slice(0, 8) })}
            </option>
          )}
        </select>
      </div>
      {!runEnabled && (
        <div
          className="border-primary/20 bg-primary/8 text-muted-foreground rounded-sm border px-3 py-2 text-caption"
          data-testid="scenarios-run-disabled-hint"
        >
          {t("library.runDisabledHint")}
        </div>
      )}
      {loading && (
        <div data-testid="scenarios-loading">
          <LoadingState />
        </div>
      )}
      {error && !loading && (
        <div data-testid="scenarios-error">
          <ErrorState
            message={error}
            onRetry={reload}
            retryLabel={t("common:retry")}
          />
        </div>
      )}
      {empty && !error && (
        <div data-testid="scenarios-empty">
          <EmptyState
            title={
              debouncedQ || pinnedFilter
                ? t("library.emptyFiltered")
                : t("library.empty")
            }
          />
        </div>
      )}
      <ul className="flex flex-col gap-1" data-testid="scenarios-list">
        {scenarios.map((s) => (
          <ScenariosRow
            key={s.id}
            scenario={s}
            currentUserId={currentUserId}
            onEdit={() => onEdit(s.id)}
            onDuplicate={() => handleDuplicate(s)}
            onDelete={() => handleDelete(s)}
            onRun={() => onRun(s)}
            showRun={runEnabled}
            runDisabled={
              !!activeRunDeviceId && s.pinned_device_id === activeRunDeviceId
            }
          />
        ))}
      </ul>
      <ConfirmModal
        open={deleteTarget !== null}
        dangerous
        isBusy={deleting}
        title={t("library.deleteConfirm.title")}
        body={t("library.deleteConfirm.body", { name: deleteTarget?.name })}
        confirmLabel={t("library.deleteConfirm.confirm")}
        cancelLabel={t("library.deleteConfirm.cancel")}
        onConfirm={performDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      {showUpgradeModal && (
        <UpgradeModal
          feature="scenario_limit"
          current={gate.current}
          limit={gate.limit}
          requiredPlan={gate.requiredPlan}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}
