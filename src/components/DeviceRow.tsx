import React from 'react';
import { LinkIcon, SettingsIcon } from './icons/Icons';

interface Device {
    id: number;
    name: string;
    status: 'Active' | 'Inactive';
    lastUsed: string;
    owner: string;
}

const DeviceRow: React.FC<{ device: Device }> = ({ device }) => {
    return (
        <tr>
            <td className="p-4 text-left text-sm font-normal leading-5 text-text">
                <a href="#" className="font-medium text-secondary no-underline">
                    <h3>{device.name}</h3>
                </a>
            </td>
            <td className="p-4 text-left text-sm font-normal leading-5 text-text">
                <span className="box-border flex h-[30px] w-[120px] items-center justify-center rounded-lg bg-accent text-xs font-medium text-white">
                  {device.status}
                </span>
            </td>
            <td className="p-4 text-left text-sm font-normal leading-5 text-text">
                {device.lastUsed}
            </td>
            <td className="p-4 text-left text-sm font-normal leading-5 text-text">
                {device.owner}
            </td>
            <td className="p-4 text-left text-sm font-normal leading-5 text-text">
                <div className="flex items-center justify-start gap-2">
                    <button className="box-border pl-3 flex h-[35px] w-[135px] items-center gap-2 rounded-lg bg-primary text-sm font-medium text-white">
                        <LinkIcon className="h-6 w-6" />
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

