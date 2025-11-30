import { LinkIcon, SettingsIcon } from 'src/components/icons/Icons';
import type { Device } from 'src/types/global';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';

interface DeviceRowProps {
  device: Device;
}

function DeviceRow({ device }: DeviceRowProps) {
  const { t } = useTranslation('devices');
  const navigate = useNavigate();

  const status = (device.status ?? '').toString().toLowerCase();

  const getStatusLabel = () => {
    if (status === 'active') return t('table.statusActive');
    if (status === 'used') return t('table.statusUsed');
    return t('table.statusInactive');
  };

  const getStatusBg = () => {
    if (status === 'active') return 'bg-accent';
    if (status === 'used') return 'bg-amber';
    return 'bg-gray-300';
  };

  const statusLabel = getStatusLabel();
  const statusBg = getStatusBg();

  const lastSeen = device.last_active_at
    ? new Date(device.last_active_at).toLocaleString()
    : t('table.never');

  const owner = device.user?.username ?? device.user?.email ?? t('table.unknown');

  const handleConnect = () => {
    navigate(`/device-control?device_id=${encodeURIComponent(device.id)}`);
  };

  const handleSettings = () => {
    navigate(`/devices/${device.id}/settings`);
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="p-4 text-left text-sm font-normal leading-5 text-text">
        <span>{device.name}</span>
      </td>
      <td className="p-4 text-left text-sm font-normal leading-5 text-text">
        <span
          className={`inline-flex h-[30px] items-center justify-center rounded-lg px-3 text-xs font-medium text-white ${statusBg}`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="p-4 text-left text-sm font-normal leading-5 text-text">
        {lastSeen}
      </td>
      <td className="p-4 text-left text-sm font-normal leading-5 text-text">
        {owner}
      </td>
      <td className="p-4 text-left text-sm font-normal leading-5 text-text">
        <div className="flex items-center justify-start gap-2">
          <button
            onClick={handleConnect}
            className="flex h-[35px] items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={status !== 'active'}
          >
            <LinkIcon className="h-5 w-5" />
            {t('table.connect')}
          </button>
          <button
            onClick={handleSettings}
            className="p-1 hover:opacity-80 transition-opacity"
            aria-label={t('table.settings')}
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
