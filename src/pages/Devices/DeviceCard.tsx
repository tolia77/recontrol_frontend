import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { SettingsIcon } from "src/components/icons/Icons";
import type { Device } from "src/types";
import Card from "src/components/ui/Card";

function DeviceCard({ device }: { device: Device }) {
  const { t } = useTranslation("devices");
  const navigate = useNavigate();

  const status = (device.status ?? "").toString().toLowerCase();

  const getStatusLabel = () => {
    if (status === "active") return t("table.statusActive");
    if (status === "used") return t("table.statusUsed");
    return t("table.statusInactive");
  };

  const getStatusBg = () => {
    if (status === "active") return "bg-accent";
    if (status === "used") return "bg-amber";
    return "bg-gray-300";
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
    <Card
      padding="md"
      className="cursor-pointer active:opacity-90"
      onClick={handleConnect}
      role="button"
      aria-disabled={status !== "active"}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-3">
          <p className="font-semibold text-text truncate">{device.name}</p>
          <p className="text-sm text-darkgray mt-1">{owner}</p>
          <p className="text-xs text-darkgray mt-1">{lastSeen}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`inline-flex h-[30px] items-center justify-center rounded-lg px-3 text-xs font-medium text-white ${statusBg}`}
          >
            {statusLabel}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSettings();
            }}
            className="p-1 transition-opacity hover:opacity-80"
            aria-label={t("table.settings")}
          >
            <SettingsIcon
              className="h-7 w-7"
              fill="darkgray"
              stroke="darkgray"
              width={28}
              height={28}
            />
          </button>
        </div>
      </div>
    </Card>
  );
}

export default DeviceCard;
