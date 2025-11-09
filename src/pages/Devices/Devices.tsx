import React, {useEffect, useState, useRef} from 'react';
import DevicesTable from "src/pages/Devices/DevicesTable.tsx";
import type {Device} from "src/types/global";
import type { GetMyDevicesParams } from "src/services/backend/devicesRequests.ts";
import { getMyDevicesRequest } from "src/services/backend/devicesRequests.ts";
import { useTranslation } from 'react-i18next';

function Devices() {
    const { t } = useTranslation('devices');
    const [devices, setDevices] = useState<Device[]>([]);

    // filter state
    const [name, setName] = useState('');
    const [owner, setOwner] = useState<GetMyDevicesParams['owner']>(''); // '', 'me', 'shared'
    const [status, setStatus] = useState<GetMyDevicesParams['status']>(''); // '', 'active', 'inactive'
    const [lastFrom, setLastFrom] = useState(''); // local date-time string -> convert to ISO when sending
    const [lastTo, setLastTo] = useState('');

    // debounce ref
    const debounceRef = useRef<number | null>(null);

    const fetchDevices = (params?: GetMyDevicesParams) => {
        getMyDevicesRequest(params).then(res => {
            setDevices(res.data.devices);
        }).catch(() => {
            setDevices([]);
        });
    };

    // initial load
    useEffect(() => {
        fetchDevices();
    }, []);

    // apply filters with debounce on change
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = window.setTimeout(() => {
            const params: GetMyDevicesParams = {};
            if (name.trim()) params.name = name.trim();
            if (owner) params.owner = owner;
            if (status) params.status = status;
            if (lastFrom) params.last_active_from = new Date(lastFrom).toISOString();
            if (lastTo) params.last_active_to = new Date(lastTo).toISOString();
            fetchDevices(params);
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [name, owner, status, lastFrom, lastTo]);

    const clearFilters = () => {
        setName('');
        setOwner('');
        setStatus('');
        setLastFrom('');
        setLastTo('');
        fetchDevices();
    };

    return (
        <div className="ml-5 mr-5 lg:ml-20 lg:mr-10 mt-6">
            <h1 className="mb-4">{t('title')}</h1>
            <div className="mb-6 flex flex-col gap-4 rounded-xl border border-lightgray bg-white p-4">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                    <div className="flex flex-col w-full md:w-1/4">
                        <label className="mb-1 text-sm" htmlFor="device-search">{t('filters.nameLabel')}</label>
                        <input
                            id="device-search"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={t('filters.namePlaceholder')}
                            className="rounded border border-lightgray px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                    </div>
                    <div className="flex flex-col w-full md:w-1/5">
                        <label className="mb-1 text-sm" htmlFor="device-owner">{t('filters.ownerLabel')}</label>
                        <select
                            id="device-owner"
                            value={owner ?? ''}
                            onChange={e => setOwner((e.target.value || '') as GetMyDevicesParams['owner'])}
                            className="rounded border border-lightgray px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                            <option value="">{t('filters.ownerAny')}</option>
                            <option value="me">{t('filters.ownerMe')}</option>
                            <option value="shared">{t('filters.ownerShared')}</option>
                        </select>
                    </div>
                    <div className="flex flex-col w-full md:w-1/5">
                        <label className="mb-1 text-sm" htmlFor="device-status">{t('filters.statusLabel')}</label>
                        <select
                            id="device-status"
                            value={status ?? ''}
                            onChange={e => setStatus((e.target.value || '') as GetMyDevicesParams['status'])}
                            className="rounded border border-lightgray px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                            <option value="">{t('filters.statusAny')}</option>
                            <option value="active">{t('table.statusActive')}</option>
                            <option value="inactive">{t('table.statusInactive')}</option>
                        </select>
                    </div>
                    <div className="flex flex-col w-full md:w-1/5">
                        <label className="mb-1 text-sm" htmlFor="last-from">{t('filters.lastFrom')}</label>
                        <input
                            id="last-from"
                            type="datetime-local"
                            value={lastFrom}
                            onChange={e => setLastFrom(e.target.value)}
                            className="rounded border border-lightgray px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                    </div>
                    <div className="flex flex-col w-full md:w-1/5">
                        <label className="mb-1 text-sm" htmlFor="last-to">{t('filters.lastTo')}</label>
                        <input
                            id="last-to"
                            type="datetime-local"
                            value={lastTo}
                            onChange={e => setLastTo(e.target.value)}
                            className="rounded border border-lightgray px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                    </div>
                </div>
                <div className="flex flex-row gap-3">
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-text hover:bg-gray-300"
                    >{t('filters.clear')}</button>
                </div>
            </div>
            <DevicesTable devices={devices} />
        </div>
    );
}

export default Devices;
