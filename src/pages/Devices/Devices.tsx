import React, {useEffect, useState} from 'react';
import DevicesTable from "src/pages/Devices/DevicesTable.tsx";
import type {Device} from "src/types/global";
import {getMyDevicesRequest} from "src/services/backend/devicesRequests.ts";
import { useTranslation } from 'react-i18next';

function Devices() {
    const { t } = useTranslation('devices');
    const [devices, setDevices] = useState<Device[]>([]);
    useEffect(() => {
        getMyDevicesRequest().then(res => {
            setDevices(res.data.devices);
        })
    }, []);
    const handleDeviceDeleted = (id: string) => {
        setDevices(prev => prev.filter(d => d.id !== id));
    };
    return (
        <div className="ml-5 mr-5 lg:ml-20 lg:mr-10 mt-6">
            <h1 className="mb-6">{t('title')}</h1>
            <DevicesTable devices={devices} onDeviceDeleted={handleDeviceDeleted} />
        </div>
    );
}

export default Devices;
