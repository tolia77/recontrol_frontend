import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getMyDevicesRequest } from 'src/services/backend/devicesRequests';
import { Card, CardHeader } from 'src/components/ui/Card';
import { Button } from 'src/components/ui/Button';
import { Spinner } from 'src/components/ui/Spinner';
import type { Device } from 'src/types/global';

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  at: string;
}

function Dashboard() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [activity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    setLoadingDevices(true);
    getMyDevicesRequest()
      .then(res => {
        setDevices(res.data.devices || []);
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
      navigate(`/device-control?device_id=${encodeURIComponent(firstDeviceId)}`);
    }
  };

  return (
    <div className="px-5 lg:px-10 mt-6 mb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t('dashboard.title')}</h1>
          <p className="text-sm text-gray-600">{t('dashboard.subtitle')}</p>
        </div>
        {lastUpdated && (
          <p className="text-xs text-gray-500">
            {t('dashboard.lastUpdated', { time: lastUpdated })}
          </p>
        )}
      </div>

      {/* Dashboard grid */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        {/* Devices Summary */}
        <Card className="flex flex-col">
          <CardHeader title={t('dashboard.devicesSectionTitle')} />

          {loadingDevices ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Spinner size="sm" />
              {t('dashboard.loading')}
            </div>
          ) : devices.length ? (
            <>
              <p className="text-4xl font-bold mb-2">
                {t('dashboard.devicesCount', { count: devices.length })}
              </p>
              <ul className="text-sm max-h-40 overflow-auto pr-1 mb-4">
                {devices.slice(0, 6).map(d => (
                  <li key={d.id} className="flex items-center justify-between py-1 border-b last:border-b-0">
                    <span className="truncate max-w-[60%]" title={d.name}>
                      {d.name}
                    </span>
                    <Link
                      to={`/devices/${d.id}/settings`}
                      className="text-xs text-primary hover:underline"
                    >
                      {t('nav.settings')}
                    </Link>
                  </li>
                ))}
                {devices.length > 6 && (
                  <li className="text-xs text-gray-500 mt-1">
                    + {devices.length - 6} more...
                  </li>
                )}
              </ul>
              <div className="mt-auto grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={() => navigate('/devices')}>
                  {t('dashboard.manageDevices')}
                </Button>
                {firstDeviceId ? (
                  <Button size="sm" onClick={handleControlDevice}>
                    {t('dashboard.controlFirstDevice')}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => navigate('/devices')}>
                    {t('dashboard.addDevice')}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600">{t('dashboard.noDevices')}</p>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="flex flex-col">
          <CardHeader title={t('dashboard.quickActions')} />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="sm" className="py-3" onClick={() => navigate('/devices')}>
              {t('dashboard.manageDevices')}
            </Button>
            <Button variant="secondary" size="sm" className="py-3" onClick={() => navigate('/settings')}>
              {t('dashboard.openSettings')}
            </Button>
            <Button variant="secondary" size="sm" className="py-3" onClick={() => navigate('/help')}>
              {t('dashboard.getHelp')}
            </Button>
            {firstDeviceId && (
              <Button size="sm" className="py-3" onClick={handleControlDevice}>
                {t('dashboard.startScreenStream')}
              </Button>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="flex flex-col">
          <CardHeader title={t('dashboard.recentActivity')} />
          {activity.length === 0 ? (
            <p className="text-sm text-gray-600">—</p>
          ) : (
            <ul className="text-sm space-y-2">
              {activity.map(item => (
                <li key={item.id} className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 min-w-[70px]">
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
