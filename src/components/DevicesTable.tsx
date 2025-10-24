import React from 'react';
import DeviceRow from "./DeviceRow";

// --- DATA DEFINITIONS ---
interface Device {
    id: number;
    name: string;
    status: 'Active' | 'Inactive';
    lastUsed: string;
    owner: string;
}

const mockDevices: Device[] = [
    { id: 1, name: "Device1", status: "Active", lastUsed: "October 12, 2025, 13:00", owner: "You" },
    { id: 2, name: "Device1", status: "Active", lastUsed: "October 12, 2025, 13:00", owner: "You" },
    { id: 3, name: "Device1", status: "Active", lastUsed: "October 12, 2025, 13:00", owner: "You" },
    { id: 4, name: "Device1", status: "Active", lastUsed: "October 12, 2025, 13:00", owner: "You" },
];

// --- DEVICE TABLE COMPONENT ---
interface DeviceTableProps {
    devices: Device[];
}

const DeviceTable: React.FC<DeviceTableProps> = ({ devices }) => {
    return (
        <div className="overflow-hidden rounded-xl border border-lightgray bg-white shadow-sm">
            <table className="w-full max-w-[1200px] table-fixed border-collapse">
                <thead>
                <tr>
                    <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Name
                    </th>
                    <th className="w-[200px] border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Status
                    </th>
                    <th className="w-[250px] border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Last Seen
                    </th>
                    <th className="w-[150px] border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Owner
                    </th>
                    <th className="w-[250px] border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Actions
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
};

export default DeviceTable;