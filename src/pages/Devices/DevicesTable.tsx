import React from 'react';
// FIX: Changing relative path to absolute path to resolve the compilation error.
import DeviceRow from "src/pages/Devices/DeviceRow.tsx";
import type { Device } from "src/types/global";

// --- DEVICE TABLE COMPONENT ---
interface DeviceTableProps {
    devices: Device[];
}

const DeviceTable: React.FC<DeviceTableProps> = ({devices}) => {
    return (
        <div className="overflow-x-auto rounded-xl border border-lightgray bg-white shadow-sm">
            {/* REMOVED md:table-fixed and kept md:table-auto for fluid, content-based column sizing */}
            <table className="w-full min-w-[700px] md:min-w-0 table-auto md:table-auto border-collapse">
                <thead>
                <tr>
                    {/* Width constraints removed for adaptive layout */}
                    <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Name
                    </th>
                    {/* Width constraints removed for adaptive layout */}
                    <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Status
                    </th>
                    {/* Width constraints removed for adaptive layout */}
                    <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Last Seen
                    </th>
                    {/* Width constraints removed for adaptive layout */}
                    <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
                        Owner
                    </th>
                    {/* Width constraints removed for adaptive layout */}
                    <th className="border-b border-lightgray p-4 text-left text-xl font-medium leading-7 text-text">
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