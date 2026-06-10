import { useTranslation } from "react-i18next";
import { getUserRole } from "src/utils/auth";
import {
  Button,
  Input,
  ConfirmModal,
  PageHeader,
} from "src/components/ui";
import { useAdminDevices } from "./useAdminDevices";
import AdminDevicesTable from "./AdminDevicesTable";

const AdminDevices = () => {
  const { t } = useTranslation("adminDevices");

  const currentRole = getUserRole();

  const {
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
  } = useAdminDevices();

  // NOTE: this gate is cosmetic — it hides admin UI for non-admin users but
  // does not enforce security. All admin API endpoints enforce authorization
  // server-side and return 403 for non-admins. The role value comes from
  // localStorage and can be modified client-side.
  if (currentRole !== "admin") {
    return (
      <div className="p-6">
        <p className="text-body text-muted-foreground">{t("errors.forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Button
            variant="secondary"
            size="sm"
            aria-label={t("refreshLabel")}
            onClick={() => loadDevices()}
          >
            ↻
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-foreground text-body font-medium">
            {t("filters.status")}
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border-border rounded-md border px-3 py-2 text-body"
          >
            <option value="">{t("filters.all")}</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <Input
          label={t("filters.name")}
          type="text"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder={t("filters.name")}
        />
      </div>

      <AdminDevicesTable
        devices={devices}
        loading={loading}
        setDeleteTarget={setDeleteTarget}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        dangerous
        title={t("messages.deleteConfirm.title")}
        body={t("messages.deleteConfirm.body")}
        confirmLabel={t("messages.deleteConfirm.confirm")}
        cancelLabel={t("messages.deleteConfirm.cancel")}
        isBusy={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default AdminDevices;
