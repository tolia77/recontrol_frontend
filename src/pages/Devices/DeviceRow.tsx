import { LinkIcon, SettingsIcon } from "src/components/icons/Icons";
import type { Device } from "src/types";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

interface DeviceRowProps {
  device: Device;
}

function DeviceRow({ device }: DeviceRowProps) {
  const { t } = useTranslation("devices");
  const navigate = useNavigate();

  const status = (device.status ?? "").toString().toLowerCase();

  const getStatusLabel = () => {
    if (status === "active") return t("table.statusActive");
    if (status === "used") return t("table.statusUsed");
    return t("table.statusInactive");
  };

  const getStatusBg = () => {
    if (status === "active") return "bg-success";
    if (status === "used") return "bg-warning";
    return "bg-muted-foreground";
  };

  const statusLabel = getStatusLabel();
  const statusBg = getStatusBg();

  const lastSeen = device.last_active_at
    ? new Date(device.last_active_at).toLocaleString()
    : t("table.never");

  const owner =
    device.user?.username ?? device.user?.email ?? t("table.unknown");

  const handleConnect = () => {
    navigate(`/device-control?device_id=${encodeURIComponent(device.id)}`);
  };

  const handleSettings = () => {
    navigate(`/devices/${device.id}/settings`);
  };

  return (
    <tr className="transition-colors hover:bg-surface-muted">
      <td className="text-foreground p-4 text-left text-body leading-5 font-normal">
        <span>{device.name}</span>
      </td>
      <td className="text-foreground p-4 text-left text-body leading-5 font-normal">
        <span
          className={`inline-flex h-[30px] items-center justify-center rounded-md px-3 text-caption font-medium text-white ${statusBg}`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="text-foreground p-4 text-left text-body leading-5 font-normal">
        {lastSeen}
      </td>
      <td className="text-foreground p-4 text-left text-body leading-5 font-normal">
        {owner}
      </td>
      <td className="text-foreground p-4 text-left text-body leading-5 font-normal">
        <div className="flex items-center justify-start gap-2">
          <button
            onClick={handleConnect}
            className="bg-primary flex h-[35px] items-center gap-2 rounded-md px-3 text-body font-medium text-white transition-colors duration-150 hover:bg-primary-hover active:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={status !== "active"}
          >
            <LinkIcon className="h-5 w-5" />
            {t("table.connect")}
          </button>
          <button
            onClick={handleSettings}
            className="rounded p-1 transition-colors duration-150 hover:bg-surface-muted"
            aria-label={t("table.settings")}
          >
            <SettingsIcon
              className="h-8 w-8"
              fill="darkgray"
              stroke="darkgray"
              width={32}
              height={32}
            />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default DeviceRow;
