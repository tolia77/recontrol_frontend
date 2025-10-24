import React from 'react';
// Imports removed to fix compilation error
// import { ReactComponent as LinkIcon } from 'src/assets/img/icons/LinkIcon.svg';
// import { ReactComponent as SettingsIcon } from 'src/assets/img/icons/SettingsIcon.svg';

// --- ICON COMPONENTS ---
// Embedded SVGs to resolve import errors

const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path>
    </svg>
);

const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor" // The className will apply the color
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
);


// --- DATA DEFINITIONS ---
// TypeScript interface for a Device
interface Device {
    id: number;
    name: string;
    status: 'Active' | 'Inactive'; // Using 'Active' as per image
    lastUsed: string;
    owner: string;
}

// Mock data based on your image
;

// --- DEVICE TABLE COMPONENT ---
interface DeviceTableProps {
    devices: Device[];
}

const DevicesTable: React.FC<DeviceTableProps> = ({ devices }) => {
    return (
        // Table Container: white bg, rounded, border, shadow
        <div className="overflow-hidden rounded-xl border border-[#D1D5DB] bg-white shadow-sm">
            <table className="w-full border-collapse">
                <thead>
                <tr>
                    {/* Header Cells: h3 style (20px, 500), left-aligned, padding */}
                    <th className="border-b border-[#D1D5DB] p-4 text-left text-xl font-medium leading-7 text-[#111827]">
                        Name
                    </th>
                    <th className="border-b border-[#D1D5DB] p-4 text-left text-xl font-medium leading-7 text-[#111827]">
                        Status
                    </th>
                    <th className="border-b border-[#D1D5DB] p-4 text-left text-xl font-medium leading-7 text-[#111827]">
                        Last Used
                    </th>
                    <th className="border-b border-[#D1D5DB] p-4 text-left text-xl font-medium leading-7 text-[#111827]">
                        Owner
                    </th>
                    <th className="border-b border-[#D1D5DB] p-4 text-left text-xl font-medium leading-7 text-[#111827]">
                        Actions
                    </th>
                </tr>
                </thead>
                <tbody>
                {devices.map((device, index) => {
                    const isLastRow = index === devices.length - 1;
                    return (
                        <tr key={device.id}>
                            {/* Data Cells: text-body-small (14px, 400), left-aligned, padding */}
                            <td className={`p-4 text-left text-sm font-normal leading-5 text-[#111827] ${isLastRow ? '' : 'border-b border-[#D1D5DB]'}`}>
                                {/* Device Name Link */}
                                <a href="#" className="font-medium text-[#3B82F6] no-underline">
                                    {device.name}
                                </a>
                            </td>
                            <td className={`p-4 text-left text-sm font-normal leading-5 text-[#111827] ${isLastRow ? '' : 'border-b border-[#D1D5DB]'}`}>
                                {/* Status Badge: w-120, h-30, rounded-8, bg-accent */}
                                <span className="box-border flex h-[30px] w-[120px] items-center justify-center rounded-lg bg-[#10B981] text-xs font-medium text-white">
                    {device.status}
                  </span>
                            </td>
                            <td className={`p-4 text-left text-sm font-normal leading-5 text-[#111827] ${isLastRow ? '' : 'border-b border-[#D1D5DB]'}`}>
                                {device.lastUsed}
                            </td>
                            <td className={`p-4 text-left text-sm font-normal leading-5 text-[#111827] ${isLastRow ? '' : 'border-b border-[#D1D5DB]'}`}>
                                {device.owner}
                            </td>
                            <td className={`p-4 text-left text-sm font-normal leading-5 text-[#111827] ${isLastRow ? '' : 'border-b border-[#D1D5DB]'}`}>
                                {/* Actions Cell: flex, left-aligned */}
                                <div className="flex items-center justify-start gap-4">
                                    {/* Connect Button: w-135, h-35, rounded-8, bg-primary */}
                                    <button className="box-border flex h-[35px] w-[135px] items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] text-sm font-medium text-white">
                                        <LinkIcon className="h-4 w-4" />
                                        Connect
                                    </button>
                                    {/* Settings Button: icon */}
                                    <button className="bg-none p-0" aria-label="Settings">
                                        <SettingsIcon className="h-6 w-6 stroke-[#8F8F8F]" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
};

export default DevicesTable;

