import React from 'react';
import {LinkIcon, SettingsIcon} from '../../components/icons/Icons.tsx';
import type {Device} from "src/types/global";
import {useNavigate} from "react-router";


const DeviceRow: React.FC<{ device: Device }> = ({device}) => {
    const status = (device.status ?? '').toString().toLowerCase();
    const statusLabel = status === 'active' ? 'Active' : 'Inactive';
    const statusBg = status === 'active' ? 'bg-accent' : 'bg-gray-300'; // adapt classes as needed
    const navigate = useNavigate()
    const lastSeen = device.last_active_at
        ? new Date(device.last_active_at).toLocaleString()
        : 'Never';

    const owner = device.user?.username ?? device.user?.email ?? 'Unknown';

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
                        // Navigate to CommandWebSocket page and include device_id as URL param
                        onClick={() => {
                            navigate(`/device-control?device_id=${encodeURIComponent(device.id)}`);
                        }}
                        className="box-border pl-3 flex h-[35px] w-[135px] items-center gap-2 rounded-lg bg-primary text-sm font-medium text-white">
                        <LinkIcon className="h-6 w-6"/>
                        Connect
                    </button>
                    <button className="bg-none p-0" aria-label="Settings">
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
};

export default DeviceRow;
