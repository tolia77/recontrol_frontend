import React from 'react';
import DevicesTable from "src/components/DevicesTable.tsx";

function Devices() {
    return (
        <>
            <h1>Devices</h1>
            <DevicesTable devices={[
                {id: 1, name: "Device1", status: "Active", lastUsed: "October 12, 2025, 13:00", owner: "You"},
                {id: 2, name: "Device1", status: "Active", lastUsed: "October 12, 2025, 13:00", owner: "You"},
                {id: 3, name: "Device1", status: "Active", lastUsed: "October 12, 2025, 13:00", owner: "You"},
                {id: 4, name: "Device1", status: "Active", lastUsed: "October 12, 2025, 13:00", owner: "You"},
            ]}/>
        </>
    );
}

export default Devices;
