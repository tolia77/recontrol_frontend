import React, {useEffect, useState} from 'react';
import DevicesTable from "src/components/DevicesTable.tsx";
import type {Device} from "src/types/global";
import {getMyDevicesRequest} from "src/services/backend/devicesRequests.ts";

function Devices() {
    const [devices, setDevices] = useState<Device[]>([]);
    useEffect(() => {
        getMyDevicesRequest().then(res => {
            setDevices(res.data);
        })
    }, []);
    return (
        <div className="ml-20 mt-6">
            <h1 className="mb-6">Devices</h1>
            <DevicesTable devices={devices}/>
        </div>
    );
}

export default Devices;
