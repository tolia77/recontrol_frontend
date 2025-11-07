// src/pages/DeviceSettings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getDeviceRequest, updateDeviceRequest, deleteDeviceRequest } from 'src/services/backend/devicesRequests.ts';
import { listDeviceSharesRequest, createDeviceShareRequest, deleteDeviceShareRequest, updateDeviceShareRequest } from 'src/services/backend/deviceSharesRequests.ts';
import { listPermissionsGroupsRequest, createPermissionsGroupRequest } from 'src/services/backend/permissionsGroupsRequests.ts';
import { useTranslation } from 'react-i18next';
import { DeviceInfoForm } from './DeviceSettings/DeviceInfoForm';
import { InviteShareForm } from './DeviceSettings/InviteShareForm';
import { SharesList } from './DeviceSettings/SharesList';
import { EditShareForm } from './DeviceSettings/EditShareForm';
import type { ShareFormState, DeviceInfoFormState, EditShareFormState } from './DeviceSettings/types';

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
    const [editForm, setEditForm] = useState<EditShareFormState | null>(null);
    const [editOriginalGroup, setEditOriginalGroup] = useState<{ see_screen: boolean; see_system_info: boolean; access_mouse: boolean; access_keyboard: boolean; access_terminal: boolean; manage_power: boolean } | null>(null);

    const loadDeviceData = useCallback(async () => {
        try {
            const response = await getDeviceRequest(deviceId!);
            setDevice(response.data);
            setDeviceForm({ name: response.data.name });
        } catch {
            setError(t('errors.loadDetails'));
        } finally {
            setLoading(false);
        }
    }, [deviceId, t]);

    const loadShares = useCallback(async () => {
        try {
            const response = await listDeviceSharesRequest(deviceId!);
            setShares(response.data.items || []);
        } catch {
            console.error('Failed to load shares');
        }
    }, [deviceId]);

    const loadPermissionsGroups = useCallback(async () => {
        try {
            const response = await listPermissionsGroupsRequest();
            setPermissionsGroups(response.data.items || []);
        } catch {
            console.error('Failed to load permissions groups');
        }
    }, []);

    useEffect(() => {
        if (deviceId) {
            loadDeviceData();
            loadShares();
            loadPermissionsGroups();
        }
    }, [deviceId, loadDeviceData, loadShares, loadPermissionsGroups]);

    const handleDeviceUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await updateDeviceRequest(deviceId!, { name: deviceForm.name });
            setDevice(response.data);
            alert(t('info.updated'));
        } catch {
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
            await createPermissionsGroupRequest({
                name: name.trim(),
                see_screen,
                see_system_info,
                access_mouse,
                access_keyboard,
                access_terminal,
                manage_power,
            });
            await loadPermissionsGroups();
            alert(t('form.groupSaved'));
        } catch {
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
            await createDeviceShareRequest(payload);
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
        } catch {
            setError(t('sharing.inviteError'));
        }
    };

    const handleDeleteShare = async (shareId: string) => {
        if (confirm(t('sharing.removeConfirm'))) {
            try {
                await deleteDeviceShareRequest(shareId);
                loadShares();
            } catch {
                setError(t('sharing.removeError'));
            }
        }
    };

    const beginEditShare = (share: DeviceShare) => {
        const originalPerms = {
            see_screen: !!share.permissions_group?.see_screen,
            see_system_info: !!share.permissions_group?.see_system_info,
            access_mouse: !!share.permissions_group?.access_mouse,
            access_keyboard: !!share.permissions_group?.access_keyboard,
            access_terminal: !!share.permissions_group?.access_terminal,
            manage_power: !!share.permissions_group?.manage_power,
        };
        setEditOriginalGroup(originalPerms);
        setEditForm({
            shareId: share.id,
            permissionsGroupId: share.permissions_group?.id || '',
            expiresAt: share.expires_at ? share.expires_at.substring(0, 16) : '',
            newGroup: {
                name: share.permissions_group?.name || '',
                ...originalPerms
            }
        });
        setShowShareForm(false);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editForm) return;
        type PatchPayload = Partial<DeviceShareCreatePayload> & { permissions_group_attributes?: { name?: string; see_screen?: boolean; see_system_info?: boolean; access_mouse?: boolean; access_keyboard?: boolean; access_terminal?: boolean; manage_power?: boolean } };
        const payload: PatchPayload = {
            expires_at: editForm.expiresAt || undefined,
            device_id: deviceId!,
        };
        const changed = editOriginalGroup && (
            editOriginalGroup.see_screen !== editForm.newGroup.see_screen ||
            editOriginalGroup.see_system_info !== editForm.newGroup.see_system_info ||
            editOriginalGroup.access_mouse !== editForm.newGroup.access_mouse ||
            editOriginalGroup.access_keyboard !== editForm.newGroup.access_keyboard ||
            editOriginalGroup.access_terminal !== editForm.newGroup.access_terminal ||
            editOriginalGroup.manage_power !== editForm.newGroup.manage_power
        );
        if (editForm.permissionsGroupId && !changed) {
            payload.permissions_group_id = editForm.permissionsGroupId;
        } else {
            payload.permissions_group_attributes = {
                name: editForm.newGroup.name || undefined,
                see_screen: editForm.newGroup.see_screen,
                see_system_info: editForm.newGroup.see_system_info,
                access_mouse: editForm.newGroup.access_mouse,
                access_keyboard: editForm.newGroup.access_keyboard,
                access_terminal: editForm.newGroup.access_terminal,
                manage_power: editForm.newGroup.manage_power,
            };
        }
        try {
            await updateDeviceShareRequest(editForm.shareId, payload);
            setEditForm(null);
            setEditOriginalGroup(null);
            await loadShares();
        } catch {
            setError(t('sharing.updateShareError'));
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
                <button
                  onClick={async () => {
                    if (confirm(t('info.deleteConfirm'))) {
                      try { await deleteDeviceRequest(deviceId!); navigate('/devices'); } catch { alert(t('info.deleteError')); }
                    }
                  }}
                  className="mt-2 px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                >{t('info.deleteDevice')}</button>
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

                    {editForm && (
                      <EditShareForm
                        t={t}
                        editForm={editForm}
                        permissionsGroups={permissionsGroups}
                        onChange={(next) => setEditForm(next)}
                        onSubmit={handleEditSubmit}
                        onLoadGroup={() => {
                          if (!editForm.permissionsGroupId) { setError(t('form.selectPermissions')); return; }
                          const group = permissionsGroups.find(g => g.id === editForm.permissionsGroupId);
                          if (!group) return;
                          const updatedPerms = {
                            see_screen: !!group.see_screen,
                            see_system_info: !!group.see_system_info,
                            access_mouse: !!group.access_mouse,
                            access_keyboard: !!group.access_keyboard,
                            access_terminal: !!group.access_terminal,
                            manage_power: !!group.manage_power,
                          };
                          setEditOriginalGroup(updatedPerms);
                          setEditForm(prev => prev && ({
                            ...prev,
                            newGroup: {
                              name: `${group.name} ${t('form.cloneSuffix')}`.trim(),
                              ...updatedPerms
                            }
                          }));
                          alert(t('form.loadedGroup'));
                        }}
                        onSaveGroup={handleSaveCurrentGroup}
                        onCancel={() => { setEditForm(null); setEditOriginalGroup(null); }}
                      />
                    )}

                    <SharesList t={t} shares={shares} onDelete={handleDeleteShare} onEdit={beginEditShare} />
                </div>
            </div>
        </div>
    );
};

export default DeviceSettings;
