import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getMyDevicesRequest } from 'src/services/backend/devicesRequests.ts';
import type { Device } from 'src/types/global';

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  at: string; // ISO string
}

function Dashboard() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  // Placeholder recent activity (future: fetch from backend)
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

  return (
    <div className="px-5 lg:px-10 mt-6 mb-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">{t('dashboard.title')}</h1>
          <p className="text-sm text-gray-600">{t('dashboard.subtitle')}</p>
        </div>
        {lastUpdated && (
          <p className="text-xs text-gray-500">{t('dashboard.lastUpdated', { time: lastUpdated })}</p>
        )}
      </div>

      {/* Top summary & quick actions layout */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        {/* Devices summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col">
          <h2 className="text-lg font-semibold mb-3">{t('dashboard.devicesSectionTitle')}</h2>
          {loadingDevices ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-lightgray)', borderTopColor: 'var(--color-primary)' }} />
              {t('dashboard.loading')}
            </div>
          ) : devices.length ? (
            <>
              <p className="text-4xl font-bold mb-2">{t('dashboard.devicesCount', { count: devices.length })}</p>
              <ul className="text-sm max-h-40 overflow-auto pr-1 mb-4">
                {devices.slice(0, 6).map(d => (
                  <li key={d.id} className="flex items-center justify-between py-1 border-b last:border-b-0">
                    <span className="truncate max-w-[60%]" title={d.name}>{d.name}</span>
                    <Link to={`/devices/${d.id}/settings`} className="text-xs text-primary hover:underline">
                      {t('nav.settings')}
                    </Link>
                  </li>
                ))}
                {devices.length > 6 && (
                  <li className="text-xs text-gray-500 mt-1">+ {devices.length - 6} more...</li>
                )}
              </ul>
              <div className="mt-auto grid grid-cols-2 gap-2">
                <Link to="/devices" className="btn-secondary text-center text-sm">{t('dashboard.manageDevices')}</Link>
                {firstDeviceId ? (
                  <button onClick={() => navigate(`/device-control?device_id=${encodeURIComponent(firstDeviceId)}`)} className="btn-primary text-sm">
                    {t('dashboard.controlFirstDevice')}
                  </button>
                ) : (
                  <Link to="/devices" className="btn-primary text-sm text-center">{t('dashboard.addDevice')}</Link>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-600">{t('dashboard.noDevices')}</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col">
          <h2 className="text-lg font-semibold mb-4">{t('dashboard.quickActions')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/devices" className="btn-secondary text-sm text-center py-3">{t('dashboard.manageDevices')}</Link>
            <Link to="/settings" className="btn-secondary text-sm text-center py-3">{t('dashboard.openSettings')}</Link>
            <Link to="/help" className="btn-secondary text-sm text-center py-3">{t('dashboard.getHelp')}</Link>
            {firstDeviceId && (
              <button onClick={() => navigate(`/device-control?device_id=${encodeURIComponent(firstDeviceId)}`)} className="btn-primary text-sm py-3">
                {t('dashboard.startScreenStream')}
              </button>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col">
          <h2 className="text-lg font-semibold mb-3">{t('dashboard.recentActivity')}</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-600">—</p>
          ) : (
            <ul className="text-sm space-y-2">
              {activity.map(item => (
                <li key={item.id} className="flex items-start gap-2">
                  <span className="text-xs text-gray-500 min-w-[70px]">{new Date(item.at).toLocaleTimeString()}</span>
                  <p className="flex-1 truncate" title={item.description}>{item.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
