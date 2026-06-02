import { useEffect, useState, useRef } from "react";
import DevicesTable from "src/pages/Devices/DevicesTable";
import type { Device } from "src/types";
import {
  devicesService,
  type GetMyDevicesParams,
} from "src/services/backend/devicesService";
import { useTranslation } from "react-i18next";
import Button from "src/components/ui/Button";
import { LoadingState, PageHeader } from "src/components/ui";
import { useMobileDetect } from "src/hooks/useMobileDetect";
import DeviceCard from "src/pages/Devices/DeviceCard";
import Modal from "src/components/ui/Modal";

function Devices() {
  const { t } = useTranslation("devices");
  const isMobile = useMobileDetect();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const requestIdRef = useRef(0);

  // Filter state
  const [name, setName] = useState("");
  const [owner, setOwner] = useState<GetMyDevicesParams["owner"]>("");
  const [status, setStatus] = useState<GetMyDevicesParams["status"]>("");
  const [lastFrom, setLastFrom] = useState("");
  const [lastTo, setLastTo] = useState("");

  const debounceRef = useRef<number | null>(null);

  const fetchDevices = (params?: GetMyDevicesParams) => {
    const currentId = ++requestIdRef.current;
    setLoading(true);
    devicesService.list(params)
      .then(({ devices }) => {
        if (currentId === requestIdRef.current) {
          setDevices(devices);
        }
      })
      .catch(() => {
        if (currentId === requestIdRef.current) {
          setDevices([]);
        }
      })
      .finally(() => {
        if (currentId === requestIdRef.current) {
          setLoading(false);
        }
      });
  };

  // Apply filters with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      const params: GetMyDevicesParams = {};
      if (name.trim()) params.name = name.trim();
      if (owner) params.owner = owner;
      if (status) params.status = status;
      if (lastFrom) params.last_active_from = new Date(lastFrom).toISOString();
      if (lastTo) params.last_active_to = new Date(lastTo).toISOString();
      fetchDevices(params);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, owner, status, lastFrom, lastTo]);

  const clearFilters = () => {
    setName("");
    setOwner("");
    setStatus("");
    setLastFrom("");
    setLastTo("");
    fetchDevices();
  };

  // Filter inputs for owner/status/date (used in both desktop bar and mobile sheet)
  const filterControls = (
    <>
      <div className="flex w-full flex-col md:w-1/5">
        <label className="mb-1 text-sm" htmlFor="device-owner">
          {t("filters.ownerLabel")}
        </label>
        <select
          id="device-owner"
          value={owner ?? ""}
          onChange={(e) =>
            setOwner((e.target.value || "") as GetMyDevicesParams["owner"])
          }
          className="border-lightgray focus:border-primary rounded border px-3 py-2 text-sm outline-none"
        >
          <option value="">{t("filters.ownerAny")}</option>
          <option value="me">{t("filters.ownerMe")}</option>
          <option value="shared">{t("filters.ownerShared")}</option>
        </select>
      </div>

      <div className="flex w-full flex-col md:w-1/5">
        <label className="mb-1 text-sm" htmlFor="device-status">
          {t("filters.statusLabel")}
        </label>
        <select
          id="device-status"
          value={status ?? ""}
          onChange={(e) =>
            setStatus(
              (e.target.value || "") as GetMyDevicesParams["status"],
            )
          }
          className="border-lightgray focus:border-primary rounded border px-3 py-2 text-sm outline-none"
        >
          <option value="">{t("filters.statusAny")}</option>
          <option value="active">{t("table.statusActive")}</option>
          <option value="inactive">{t("table.statusInactive")}</option>
        </select>
      </div>

      <div className="flex w-full flex-col md:w-1/5">
        <label className="mb-1 text-sm" htmlFor="last-from">
          {t("filters.lastFrom")}
        </label>
        <input
          id="last-from"
          type="datetime-local"
          value={lastFrom}
          onChange={(e) => setLastFrom(e.target.value)}
          className="border-lightgray focus:border-primary rounded border px-3 py-2 text-sm outline-none"
        />
      </div>

      <div className="flex w-full flex-col md:w-1/5">
        <label className="mb-1 text-sm" htmlFor="last-to">
          {t("filters.lastTo")}
        </label>
        <input
          id="last-to"
          type="datetime-local"
          value={lastTo}
          onChange={(e) => setLastTo(e.target.value)}
          className="border-lightgray focus:border-primary rounded border px-3 py-2 text-sm outline-none"
        />
      </div>
    </>
  );

  return (
    <div className="p-4 md:p-6">
      <PageHeader title={t("title")} />

      {/* Filters */}
      <div className="border-lightgray mb-6 flex flex-col gap-4 rounded-xl border bg-white p-4">
        {isMobile ? (
          /* Mobile: name search inline + Filters button */
          <div className="flex gap-3 items-end">
            <div className="flex flex-1 flex-col">
              <label className="mb-1 text-sm" htmlFor="device-search">
                {t("filters.nameLabel")}
              </label>
              <input
                id="device-search"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("filters.namePlaceholder")}
                className="border-lightgray focus:border-primary rounded border px-3 py-2 text-sm outline-none"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFiltersOpen(true)}
            >
              {t("filters.filtersButton")}
            </Button>
          </div>
        ) : (
          /* Desktop: full filter bar unchanged */
          <>
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex w-full flex-col md:w-1/4">
                <label className="mb-1 text-sm" htmlFor="device-search">
                  {t("filters.nameLabel")}
                </label>
                <input
                  id="device-search"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("filters.namePlaceholder")}
                  className="border-lightgray focus:border-primary rounded border px-3 py-2 text-sm outline-none"
                />
              </div>
              {filterControls}
            </div>

            <div className="flex flex-row gap-3">
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                {t("filters.clear")}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Filter bottom-sheet (mobile only) */}
      {isMobile && (
        <Modal open={filtersOpen} onClose={() => setFiltersOpen(false)}>
          <div className="p-4 flex flex-col gap-4">
            {filterControls}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  clearFilters();
                  setFiltersOpen(false);
                }}
              >
                {t("filters.clear")}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState />
      ) : isMobile ? (
        <div className="space-y-3">
          {devices.map((d) => (
            <DeviceCard key={d.id} device={d} />
          ))}
        </div>
      ) : (
        <DevicesTable devices={devices} />
      )}
    </div>
  );
}

export default Devices;
