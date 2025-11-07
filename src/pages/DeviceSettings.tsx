// src/pages/DeviceSettings.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { backendInstance } from 'src/services/backend/config.ts';
import { getAccessToken } from 'src/utils/auth.ts';
import type { Device, DeviceShare, PermissionsGroup, DeviceShareCreatePayload } from 'src/types/global';
import { useTranslation } from 'react-i18next';
import { DeviceInfoForm } from './DeviceSettings/DeviceInfoForm';
import { InviteShareForm } from './DeviceSettings/InviteShareForm';
import { SharesList } from './DeviceSettings/SharesList';
import type { ShareFormState, DeviceInfoFormState } from './DeviceSettings/types';

const DeviceSettings: React.FC = () => {
    const { t } = useTranslation('deviceSettings');
    const { deviceId } = useParams<{ deviceId: string }>();
    const navigate = useNavigate();
    const [device, setDevice] = useState<Device | null>(null);
    const [shares, setShares] = useState<DeviceShare[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    const [deviceForm, setDeviceForm] = useState<DeviceInfoFormState>({ name: '' });

    // New shareForm state without checkbox, always show new group editor
    const [shareForm, setShareForm] = useState<ShareFormState>({
        userEmail: '',
        permissionsGroupId: '',
        expiresAt: '',
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
            setDeviceForm({ name: response.data.name });
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
                device: { name: deviceForm.name }
            }, {
                headers: { Authorization: getAccessToken() }
            });
            setDevice(response.data);
            alert(t('info.updated'));
        } catch (err) {
            setError(t('info.updateError'));
        }
    };

    const handleLoadGroupIntoEditor = () => {
        if (!shareForm.permissionsGroupId) {
            setError(t('form.selectPermissions'));
            return;
        }
        const group = permissionsGroups.find(g => g.id === shareForm.permissionsGroupId);
        if (!group) return;
        setShareForm(prev => ({
            ...prev,
            newGroup: {
                name: `${group.name} ${t('form.cloneSuffix')}`.trim(),
                see_screen: !!group.see_screen,
                see_system_info: !!group.see_system_info,
                access_mouse: !!group.access_mouse,
                access_keyboard: !!group.access_keyboard,
                access_terminal: !!group.access_terminal,
                manage_power: !!group.manage_power,
            }
        }));
        alert(t('form.loadedGroup'));
    };

    const handleSaveCurrentGroup = async () => {
        const { name, see_screen, see_system_info, access_mouse, access_keyboard, access_terminal, manage_power } = shareForm.newGroup;
        if (!name.trim()) {
            setError(t('sharing.nameRequired'));
            return;
        }
        try {
            await backendInstance.post('/permissions_groups', {
                permissions_group: {
                    name: name.trim(),
                    see_screen,
                    see_system_info,
                    access_mouse,
                    access_keyboard,
                    access_terminal,
                    manage_power,
                }
            }, {
                headers: { Authorization: getAccessToken() }
            });
            await loadPermissionsGroups();
            alert(t('form.groupSaved'));
        } catch (e) {
            setError(t('form.groupSaveError'));
        }
    };

    const handleShareSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!shareForm.userEmail) {
            setError(t('sharing.emailRequired'));
            return;
        }

        const payload: DeviceShareCreatePayload = {
            device_id: deviceId!,
            user_email: shareForm.userEmail || undefined,
            expires_at: shareForm.expiresAt || undefined
        };

        if (shareForm.permissionsGroupId) {
            payload.permissions_group_id = shareForm.permissionsGroupId;
        } else {
            // Send inline permissions without requiring a name
            payload.permissions_group_attributes = {
                see_screen: shareForm.newGroup.see_screen,
                see_system_info: shareForm.newGroup.see_system_info,
                access_mouse: shareForm.newGroup.access_mouse,
                access_keyboard: shareForm.newGroup.access_keyboard,
                access_terminal: shareForm.newGroup.access_terminal,
                manage_power: shareForm.newGroup.manage_power
            };
        }

        try {
            await backendInstance.post('/device_shares', { device_share: payload }, {
                headers: { Authorization: getAccessToken() }
            });

            setShareForm({
                userEmail: '',
                permissionsGroupId: '',
                expiresAt: '',
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

            <DeviceInfoForm
              t={t}
              deviceForm={deviceForm}
              onChange={setDeviceForm}
              onSubmit={handleDeviceUpdate}
              onCancel={() => navigate('/devices')}
            />

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
                      <InviteShareForm
                        t={t}
                        shareForm={shareForm}
                        permissionsGroups={permissionsGroups}
                        onChange={setShareForm}
                        onSubmit={handleShareSubmit}
                        onLoadGroup={handleLoadGroupIntoEditor}
                        onSaveGroup={handleSaveCurrentGroup}
                      />
                    )}

                    <SharesList t={t} shares={shares} onDelete={handleDeleteShare} />
                </div>
            </div>
        </div>
    );
};

export default DeviceSettings;
