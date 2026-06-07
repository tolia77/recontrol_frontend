import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { devicesService } from "src/services/backend/devicesService";
import Card from "src/components/ui/Card";
import CardHeader from "src/components/ui/CardHeader";
import Button from "src/components/ui/Button";
import { LoadingState, EmptyState, PageHeader } from "src/components/ui";
import type { Device } from "src/types";
import { useGate } from "src/hooks/useGate";
import UpgradeModal from "src/components/ui/UpgradeModal";

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  at: string;
}

function Dashboard() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const deviceGate = useGate("device_limit");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [activity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    setLoadingDevices(true);
    devicesService.list()
      .then(({ devices }) => {
        setDevices(devices);
        setLastUpdated(new Date().toLocaleTimeString());
      })
      .catch(() => {
        setDevices([]);
      })
      .finally(() => setLoadingDevices(false));
  }, []);

  const firstDeviceId = devices.length ? devices[0].id : null;

  const handleControlDevice = () => {
    if (firstDeviceId) {
      navigate(
        `/device-control?device_id=${encodeURIComponent(firstDeviceId)}`,
      );
    }
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        actions={
          lastUpdated ? (
            <p className="text-caption text-muted-foreground">
              {t("dashboard.lastUpdated", { time: lastUpdated })}
            </p>
          ) : undefined
        }
      />

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Devices Summary */}
        <Card className="flex flex-col">
          <CardHeader title={t("dashboard.devicesSectionTitle")} />

          {loadingDevices ? (
            <LoadingState message={t("dashboard.loading")} />
          ) : devices.length ? (
            <>
              <p className="mb-2 text-4xl font-bold">
                {t("dashboard.devicesCount", { count: devices.length })}
              </p>
              <ul className="mb-4 max-h-40 overflow-auto pr-1 text-body">
                {devices.slice(0, 6).map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between border-b py-1 last:border-b-0"
                  >
                    <span className="max-w-[60%] truncate" title={d.name}>
                      {d.name}
                    </span>
                    <Link
                      to={`/devices/${d.id}/settings`}
                      className="text-primary text-caption hover:underline"
                    >
                      {t("nav.settings")}
                    </Link>
                  </li>
                ))}
                {devices.length > 6 && (
                  <li className="mt-1 text-caption text-muted-foreground">
                    + {devices.length - 6} more...
                  </li>
                )}
              </ul>
              <div className="mt-auto grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate("/devices")}
                >
                  {t("dashboard.manageDevices")}
                </Button>
                {firstDeviceId ? (
                  <Button size="sm" onClick={handleControlDevice}>
                    {t("dashboard.controlFirstDevice")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!deviceGate.allowed) {
                        setShowUpgradeModal(true);
                        return;
                      }
                      navigate("/devices");
                    }}
                  >
                    {t("dashboard.addDevice")}
                  </Button>
                )}
                {showUpgradeModal && (
                  <UpgradeModal
                    feature="device_limit"
                    current={deviceGate.current}
                    limit={deviceGate.limit}
                    requiredPlan={deviceGate.requiredPlan}
                    onClose={() => setShowUpgradeModal(false)}
                  />
                )}
              </div>
            </>
          ) : (
            <EmptyState title={t("dashboard.noDevices")} />
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="flex flex-col">
          <CardHeader title={t("dashboard.quickActions")} />
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              size="sm"
              className="py-3"
              onClick={() => navigate("/devices")}
            >
              {t("dashboard.manageDevices")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="py-3"
              onClick={() => navigate("/settings")}
            >
              {t("dashboard.openSettings")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="py-3"
              onClick={() => navigate("/help")}
            >
              {t("dashboard.getHelp")}
            </Button>
            {firstDeviceId && (
              <Button size="sm" className="py-3" onClick={handleControlDevice}>
                {t("dashboard.startScreenStream")}
              </Button>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="flex flex-col">
          <CardHeader title={t("dashboard.recentActivity")} />
          {activity.length === 0 ? (
            <p className="text-body text-muted-foreground">—</p>
          ) : (
            <ul className="space-y-2 text-body">
              {activity.map((item) => (
                <li key={item.id} className="flex items-start gap-2">
                  <span className="min-w-[70px] text-caption text-muted-foreground">
                    {new Date(item.at).toLocaleTimeString()}
                  </span>
                  <p className="flex-1 truncate" title={item.description}>
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
