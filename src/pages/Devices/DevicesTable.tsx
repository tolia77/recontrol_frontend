import DeviceRow from 'src/pages/Devices/DeviceRow';
import type { Device } from 'src/types/global';
import { useTranslation } from 'react-i18next';

interface DeviceTableProps {
  devices: Device[];
}

function DevicesTable({ devices }: DeviceTableProps) {
  const { t } = useTranslation('devices');

  return (
    <div className="overflow-x-auto rounded-xl border border-lightgray bg-white shadow-sm">
      <table className="w-full min-w-[700px] md:min-w-0 table-auto border-collapse">
        <thead>
          <tr>
            <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
              {t('table.name')}
            </th>
            <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
              {t('table.status')}
            </th>
            <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
              {t('table.lastSeen')}
            </th>
            <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
              {t('table.owner')}
            </th>
            <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
              {t('table.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <DeviceRow key={device.id} device={device} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DevicesTable;
