import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  scenariosService,
  type Scenario,
} from 'src/services/backend/scenariosService';
import { getUserId } from 'src/utils/auth';
import ScenariosRow from './ScenariosRow';

export interface ScenariosLibraryProps {
  deviceId: string;
  onEdit: (id: string) => void;
  onNew: () => void;
  // D-22-08: Plan 22.10's panel wiring plugs this into the PolicyPreviewModal
  // opener. Plan 22.07 only requires the prop plumbing reach ScenariosRow.
  onRun: (scenarioId: string) => void;
  // Single-in-flight signal — when an active run is running on this device id,
  // every row pinned to that device disables its [▶ Run] button.
  activeRunDeviceId?: string | null;
}

export default function ScenariosLibrary({
  deviceId,
  onEdit,
  onNew,
  onRun,
  activeRunDeviceId = null,
}: ScenariosLibraryProps) {
  const { t } = useTranslation('scenarios');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  // The library lives inside DeviceControl which is scoped to a single device.
  // The pinned-device filter dropdown therefore offers exactly two values in
  // P21: "" (all visible scenarios) and the currently-controlled device id.
  // Full multi-device picker is a v1.6+ enhancement (CONTEXT "Claude's
  // Discretion": "list devices the operator has access to ...").
  const [pinnedFilter, setPinnedFilter] = useState<string>('');
  const currentUserId = getUserId() ?? '';

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
        if (!cancelled) setError(t('library.empty'));
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
      setError(t('library.empty'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (s: Scenario) => {
    // LIB-06: confirm-then-hard-delete. window.confirm is acceptable v1.5
    // surface; full modal lives behind the editor's dirty-state guard in 21-10.
    const proceed = window.confirm(t('library.deleteConfirm.body', { name: s.name }));
    if (!proceed) return;
    try {
      await scenariosService.destroy(s.id);
      await reload();
    } catch {
      setError(t('library.empty'));
    }
  };

  const handleDuplicate = async (s: Scenario) => {
    // LIB-05: server appends "(copy)" with collision-suffix bumping; UI just
    // calls the endpoint and jumps into the editor for the new row.
    try {
      const result = await scenariosService.duplicate(s.id);
      await reload();
      onEdit(result.scenario.id);
    } catch {
      setError(t('library.empty'));
    }
  };

  const empty = !loading && scenarios.length === 0;

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          onClick={onNew}
          data-testid="scenarios-new-button"
        >
          {t('library.newButton')}
        </button>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('library.searchPlaceholder')}
          className="min-w-[12ch] flex-1 rounded border border-lightgray px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          data-testid="scenarios-search-input"
        />
        <select
          value={pinnedFilter}
          onChange={(e) => setPinnedFilter(e.target.value)}
          className="rounded border border-lightgray px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          data-testid="scenarios-pinned-filter"
        >
          <option value="">{t('library.pinnedDeviceFilter')}</option>
          {deviceId && (
            <option value={deviceId}>
              {t('library.pinnedDeviceChip', { device: deviceId.slice(0, 8) })}
            </option>
          )}
        </select>
      </div>
      {loading && (
        <div className="text-sm text-gray-500" data-testid="scenarios-loading">
          …
        </div>
      )}
      {error && !loading && (
        <div className="text-sm text-error" data-testid="scenarios-error">
          {error}
        </div>
      )}
      {empty && !error && (
        <div
          className="py-4 text-center text-sm text-gray-500"
          data-testid="scenarios-empty"
        >
          {debouncedQ || pinnedFilter
            ? t('library.emptyFiltered')
            : t('library.empty')}
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
            onRun={() => onRun(s.id)}
            runDisabled={
              !!activeRunDeviceId && s.pinned_device_id === activeRunDeviceId
            }
          />
        ))}
      </ul>
    </div>
  );
}
