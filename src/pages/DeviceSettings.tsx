// src/pages/DeviceSettings.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { backendInstance } from 'src/services/backend/config.ts';
import { getAccessToken } from 'src/utils/auth.ts';
import type { Device, DeviceShare, PermissionsGroup, DeviceShareCreatePayload } from 'src/types/global';
import { useTranslation } from 'react-i18next';

const DeviceSettings: React.FC = () => {
    const { t } = useTranslation('deviceSettings');
    const { deviceId } = useParams<{ deviceId: string }>();
    const navigate = useNavigate();
    const [device, setDevice] = useState<Device | null>(null);
    const [shares, setShares] = useState<DeviceShare[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    // Single-page: remove tabs and statuses
    const [deviceForm, setDeviceForm] = useState({
        name: ''
    });
    const [shareForm, setShareForm] = useState({
        userEmail: '',
        permissionsGroupId: '',
        expiresAt: '',
        createNewGroup: false,
        newGroup: {
            name: '',
            see_screen: false,
            see_system_info: false,
            access_mouse: false,
            access_keyboard: false,
            access_terminal: false,
            manage_power: false
        }
    });
    const [permissionsGroups, setPermissionsGroups] = useState<PermissionsGroup[]>([]);
    const [showShareForm, setShowShareForm] = useState(false);

    useEffect(() => {
        if (deviceId) {
            loadDeviceData();
            loadShares();
            loadPermissionsGroups();
        }
    }, [deviceId]);

    const loadDeviceData = async () => {
        try {
            const response = await backendInstance.get(`/devices/${deviceId}`, {
                headers: { Authorization: getAccessToken() }
            });
            setDevice(response.data);
            setDeviceForm({
                name: response.data.name
            });
        } catch (err) {
            setError(t('errors.loadDetails'));
        } finally {
            setLoading(false);
        }
    };

    const loadShares = async () => {
        try {
            const response = await backendInstance.get('/device_shares', {
                params: { device_id: deviceId },
                headers: { Authorization: getAccessToken() }
            });
            setShares(response.data.items || []);
        } catch (err) {
            console.error('Failed to load shares:', err);
        }
    };

    const loadPermissionsGroups = async () => {
        try {
            const response = await backendInstance.get('/permissions_groups', {
                headers: { Authorization: getAccessToken() }
            });
            setPermissionsGroups(response.data.items || []);
        } catch (err) {
            console.error('Failed to load permissions groups:', err);
        }
    };

    const handleDeviceUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await backendInstance.patch(`/devices/${deviceId}`, {
                device: { name: deviceForm.name } // status removed
            }, {
                headers: { Authorization: getAccessToken() }
            });
            setDevice(response.data);
            alert(t('info.updated'));
        } catch (err) {
            setError(t('info.updateError'));
        }
    };

    const handleShareSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!shareForm.userEmail) {
            setError(t('sharing.emailRequired'));
            return;
        }

        // Build payload based on selection vs new group
        const payload: DeviceShareCreatePayload = {
            device_id: deviceId!,
            user_email: shareForm.userEmail || undefined,
            expires_at: shareForm.expiresAt || undefined
            // status intentionally not sent
        };

        if (shareForm.createNewGroup) {
            if (!shareForm.newGroup.name.trim()) {
                setError(t('sharing.nameRequired'));
                return;
            }
            payload.permissions_group_attributes = {
                name: shareForm.newGroup.name.trim(),
                see_screen: shareForm.newGroup.see_screen,
                see_system_info: shareForm.newGroup.see_system_info,
                access_mouse: shareForm.newGroup.access_mouse,
                access_keyboard: shareForm.newGroup.access_keyboard,
                access_terminal: shareForm.newGroup.access_terminal,
                manage_power: shareForm.newGroup.manage_power
            };
        } else if (shareForm.permissionsGroupId) {
            payload.permissions_group_id = shareForm.permissionsGroupId;
        }

        try {
            await backendInstance.post('/device_shares', { device_share: payload }, {
                headers: { Authorization: getAccessToken() }
            });

            setShareForm({
                userEmail: '',
                permissionsGroupId: '',
                expiresAt: '',
                createNewGroup: false,
                newGroup: {
                    name: '',
                    see_screen: false,
                    see_system_info: false,
                    access_mouse: false,
                    access_keyboard: false,
                    access_terminal: false,
                    manage_power: false
                }
            });
            setShowShareForm(false);
            loadShares();
            alert(t('sharing.userInvited'));
        } catch (err) {
            setError(t('sharing.inviteError'));
        }
    };

    const handleDeleteShare = async (shareId: string) => {
        if (confirm(t('sharing.removeConfirm'))) {
            try {
                await backendInstance.delete(`/device_shares/${shareId}`, {
                    headers: { Authorization: getAccessToken() }
                });
                loadShares();
            } catch (err) {
                setError(t('sharing.removeError'));
            }
        }
    };

    if (loading) return <div className="p-6">{t('loading')}</div>;
    if (error) return <div className="p-6 text-red-500">{error}</div>;
    if (!device) return <div className="p-6">{t('notFound')}</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-text">{t('title')}</h1>
                <p className="text-gray-600">{t('subtitle')}</p>
            </div>

            {/* Single page (no tabs) - Device Information */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">{t('info.section')}</h2>
                <form onSubmit={handleDeviceUpdate}>
                    <div className="grid grid-cols-1 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('info.nameLabel')}
                            </label>
                            <input
                                type="text"
                                value={deviceForm.name}
                                onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={() => navigate('/devices')}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                        >
                            {t('info.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                        >
                            {t('info.save')}
                        </button>
                    </div>
                </form>
            </div>

            {/* Single page - Sharing */}
            <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">{t('sharing.section')}</h2>
                        <button
                            onClick={() => setShowShareForm(!showShareForm)}
                            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                        >
                            {showShareForm ? t('sharing.cancelInvite') : t('sharing.invite')}
                        </button>
                    </div>

                    {showShareForm && (
                        <form onSubmit={handleShareSubmit} className="mb-6 p-4 border border-gray-200 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('form.userEmail')}
                                    </label>
                                    <input
                                        type="email"
                                        value={shareForm.userEmail}
                                        onChange={(e) => setShareForm({ ...shareForm, userEmail: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        required
                                    />
                                </div>

                                {/* Toggle new permissions group vs select existing */}
                                <div className="flex items-end">
                                    <label className="inline-flex items-center space-x-2 select-none">
                                        <input
                                            type="checkbox"
                                            checked={shareForm.createNewGroup}
                                            onChange={(e) => setShareForm({ ...shareForm, createNewGroup: e.target.checked })}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-sm text-gray-700">{t('form.createNewGroup')}</span>
                                    </label>
                                </div>

                                {!shareForm.createNewGroup && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {t('form.permissionsGroup')}
                                        </label>
                                        <select
                                            value={shareForm.permissionsGroupId}
                                            onChange={(e) => setShareForm({ ...shareForm, permissionsGroupId: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                        >
                                            <option value="">{t('form.selectPermissions')}</option>
                                            {permissionsGroups.map((group) => (
                                                <option key={group.id} value={group.id}>
                                                    {group.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {shareForm.createNewGroup && (
                                    <>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {t('form.newGroupName')}
                                            </label>
                                            <input
                                                type="text"
                                                value={shareForm.newGroup.name}
                                                onChange={(e) => setShareForm({ ...shareForm, newGroup: { ...shareForm.newGroup, name: e.target.value } })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                                required
                                            />
                                        </div>
                                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {[
                                                { key: 'see_screen', label: t('form.perms.see_screen') },
                                                { key: 'see_system_info', label: t('form.perms.see_system_info') },
                                                { key: 'access_mouse', label: t('form.perms.access_mouse') },
                                                { key: 'access_keyboard', label: t('form.perms.access_keyboard') },
                                                { key: 'access_terminal', label: t('form.perms.access_terminal') },
                                                { key: 'manage_power', label: t('form.perms.manage_power') },
                                            ].map((perm) => (
                                                <label key={perm.key} className="inline-flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={(shareForm.newGroup as any)[perm.key]}
                                                        onChange={(e) =>
                                                            setShareForm({
                                                                ...shareForm,
                                                                newGroup: { ...(shareForm.newGroup as any), [perm.key]: e.target.checked }
                                                            })
                                                        }
                                                        className="h-4 w-4"
                                                    />
                                                    <span className="text-sm text-gray-700">{perm.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </>
                                )}

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {t('form.expiresAt')}
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={shareForm.expiresAt}
                                        onChange={(e) => setShareForm({ ...shareForm, expiresAt: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
                                >
                                    {t('form.sendInvitation')}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Shares List */}
                    <div className="space-y-3">
                        {shares.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">{t('sharing.noShares')}</p>
                        ) : (
                            shares.map((share) => (
                                <div key={share.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                                    <div>
                                        <p className="font-medium">{share.user?.username || share.user?.email}</p>
                                        <p className="text-sm text-gray-500">
                                            {t('sharing.permissions')}: {share.permissions_group?.name || t('sharing.defaultGroup')}
                                            {share.expires_at && ` • ${t('sharing.expires')}: ${new Date(share.expires_at).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteShare(share.id)}
                                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-md"
                                    >
                                        {t('sharing.remove')}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeviceSettings;
