import React from 'react';
import {LinkIcon, SettingsIcon} from '../../components/icons/Icons.tsx';
import type {Device} from "src/types/global";
import {useNavigate} from "react-router";
import { useTranslation } from 'react-i18next';
import { deleteDeviceRequest } from "src/services/backend/devicesRequests.ts";


const DeviceRow: React.FC<{ device: Device; onDeleted?: (id: string) => void }> = ({device, onDeleted}) => {
    const { t } = useTranslation('devices');
    const status = (device.status ?? '').toString().toLowerCase();
    const statusLabel = status === 'active' ? t('table.statusActive') : t('table.statusInactive');
    const statusBg = status === 'active' ? 'bg-accent' : 'bg-gray-300'; // adapt classes as needed
    const navigate = useNavigate()
    const lastSeen = device.last_active_at
        ? new Date(device.last_active_at).toLocaleString()
        : t('table.never');

    const owner = device.user?.username ?? device.user?.email ?? t('table.unknown');

    return (
        <tr>
            <td className="p-4 text-left text-sm font-normal leading-5 text-text">
                {/* Plain text to match other columns */}
                <span>{device.name}</span>
            </td>
            <td className="p-4 text-left text-sm font-normal leading-5 text-text">
                <span
                    className={`box-border inline-flex h-[30px] items-center justify-center rounded-lg px-2 text-xs font-medium text-white ${statusBg}`}>
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
                        onClick={() => {
                            navigate(`/device-control?device_id=${encodeURIComponent(device.id)}`);
                        }}
                        className="box-border pl-3 flex h-[35px] w-[135px] items-center gap-2 rounded-lg bg-primary text-sm font-medium text-white"
                    >
                        <LinkIcon className="h-6 w-6"/>
                        {t('table.connect')}
                    </button>
                    <button
                        onClick={() => navigate(`/devices/${device.id}/settings`)}
                        className="bg-none p-0"
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
                    <button
                        onClick={async () => {
                            if (confirm(t('table.deleteConfirm'))) {
                                try { await deleteDeviceRequest(device.id); if (onDeleted) { onDeleted(device.id); } } catch { alert(t('table.deleteError')); }
                            }
                        }}
                        className="box-border pl-3 flex h-[35px] items-center gap-2 rounded-lg bg-red-600 text-sm font-medium text-white px-2"
                    >
                        {t('table.delete')}
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default DeviceRow;
