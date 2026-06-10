import { useTranslation } from "react-i18next";
import { Button, Card, LoadingState, EmptyState } from "src/components/ui";
import type { Device } from "src/types";

export interface AdminDevicesTableProps {
  devices: Device[];
  loading: boolean;
  setDeleteTarget: (v: Device | null) => void;
}

export default function AdminDevicesTable({
  devices,
  loading,
  setDeleteTarget,
}: AdminDevicesTableProps) {
  const { t } = useTranslation("adminDevices");

  return (
    <Card>
      <h2 className="mb-4 text-heading font-semibold">{t("title")}</h2>
      {loading ? (
        <LoadingState message={t("messages.loading")} />
      ) : devices.length === 0 ? (
        <EmptyState title={t("messages.empty")} />
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-body">
            <thead className="bg-surface sticky top-0">
              <tr className="text-foreground border-b text-left">
                <th className="px-2 py-2">{t("table.name")}</th>
                <th className="px-2 py-2">{t("table.status")}</th>
                <th className="px-2 py-2">{t("table.owner")}</th>
                <th className="px-2 py-2">{t("table.email")}</th>
                <th className="px-2 py-2">{t("table.lastActive")}</th>
                <th className="px-2 py-2">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr
                  key={device.id}
                  className="hover:bg-surface-muted border-b align-top last:border-b-0"
                >
                  <td className="px-2 py-2">{device.name}</td>
                  <td className="px-2 py-2">
                    <span
                      className={
                        device.status === "active"
                          ? "text-primary font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {device.status}
                    </span>
                  </td>
                  <td className="px-2 py-2">{device.user.username}</td>
                  <td className="px-2 py-2">{device.user.email}</td>
                  <td className="text-muted-foreground px-2 py-2 text-caption">
                    {device.last_active_at
                      ? new Date(device.last_active_at).toLocaleString()
                      : "-"}
                  </td>
                  <td className="space-y-1 px-2 py-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteTarget(device)}
                    >
                      {t("messages.deleteConfirm.confirm")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
