import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "src/components/ui/Toast";
import { devicesService } from "src/services/backend/devicesService";
import type { Device } from "src/types";

export interface UseAdminDevicesReturn {
  loading: boolean;
  devices: Device[];
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  nameFilter: string;
  setNameFilter: (v: string) => void;
  deleteTarget: Device | null;
  setDeleteTarget: (v: Device | null) => void;
  deleting: boolean;
  loadDevices: () => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;
}

export function useAdminDevices(): UseAdminDevicesReturn {
  const { t } = useTranslation("adminDevices");
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const perPage = 200;
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const result = await devicesService.listAll({
        ...(statusFilter ? { status: statusFilter as "active" | "inactive" } : {}),
        ...(nameFilter ? { name: nameFilter } : {}),
        page: 1,
        per_page: perPage,
      });
      setDevices(result.devices);
    } catch {
      toast.error(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, nameFilter, perPage, t, toast]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const device = deleteTarget;
    setDeleting(true);
    try {
      await devicesService.remove(device.id);
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
      toast.success(t("messages.deleted"));
    } catch {
      toast.error(t("errors.deleteFailed"));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, t, toast]);

  return useMemo(
    () => ({
      loading,
      devices,
      statusFilter,
      setStatusFilter,
      nameFilter,
      setNameFilter,
      deleteTarget,
      setDeleteTarget,
      deleting,
      loadDevices,
      handleDeleteConfirm,
    }),
    [
      loading,
      devices,
      statusFilter,
      nameFilter,
      deleteTarget,
      deleting,
      loadDevices,
      handleDeleteConfirm,
    ],
  );
}
