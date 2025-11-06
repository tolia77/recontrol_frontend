import React from 'react';
import DeviceRow from "./DeviceRow.tsx";
import type { Device } from "src/types/global";

// --- DEVICE TABLE COMPONENT ---
interface DeviceTableProps {
    devices: Device[];
}

const DeviceTable: React.FC<DeviceTableProps> = ({devices}) => {
    return (
        <div className="overflow-x-auto rounded-xl border border-lightgray bg-white shadow-sm">
            <table className="w-full min-w-[700px] md:min-w-0 table-auto md:table-fixed border-collapse">
                <thead>
                <tr>
                    <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Name
                    </th>
                    <th className="md:w-[200px] border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Status
                    </th>
                    <th className="md:w-[250px] border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Last Seen
                    </th>
                    <th className="md:w-[150px] border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Owner
                    </th>
                    <th className="md:w-[250px] border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Actions
                    </th>
                </tr>
                </thead>
                <tbody>
                {devices.map((device) => (
                    <DeviceRow key={device.id} device={device}/>
                ))}
                </tbody>
            </table>
        </div>
    );
};

export default DeviceTable;