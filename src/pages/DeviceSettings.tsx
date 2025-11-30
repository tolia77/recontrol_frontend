import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getDeviceRequest, updateDeviceRequest, deleteDeviceRequest } from 'src/services/backend/devicesRequests';
import {
  listDeviceSharesRequest,
  createDeviceShareRequest,
  deleteDeviceShareRequest,
  updateDeviceShareRequest
} from 'src/services/backend/deviceSharesRequests';
import {
  listPermissionsGroupsRequest,
  createPermissionsGroupRequest
} from 'src/services/backend/permissionsGroupsRequests';
import { useTranslation } from 'react-i18next';
import { useToast } from 'src/components/ui/Toast';
import { LoadingOverlay } from 'src/components/ui/Spinner';
import { DeviceInfoForm } from './DeviceSettings/DeviceInfoForm';
import { InviteShareForm } from './DeviceSettings/InviteShareForm';
import { SharesList } from './DeviceSettings/SharesList';
import { EditShareForm } from './DeviceSettings/EditShareForm';
import type { ShareFormState, DeviceInfoFormState, EditShareFormState } from './DeviceSettings/types';
import type { Device, DeviceShare, PermissionsGroup, DeviceShareCreatePayload } from 'src/types/global';

const DeviceSettings = () => {
  const { t } = useTranslation('deviceSettings');
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [device, setDevice] = useState<Device | null>(null);
  const [shares, setShares] = useState<DeviceShare[]>([]);
  const [loading, setLoading] = useState(true);

  const [deviceForm, setDeviceForm] = useState<DeviceInfoFormState>({ name: '' });
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
  const [editOriginalGroup, setEditOriginalGroup] = useState<{
    see_screen: boolean;
    see_system_info: boolean;
    access_mouse: boolean;
    access_keyboard: boolean;
    access_terminal: boolean;
    manage_power: boolean;
  } | null>(null);

  const loadDeviceData = useCallback(async () => {
    try {
      const response = await getDeviceRequest(deviceId!);
      setDevice(response.data);
      setDeviceForm({ name: response.data.name });
    } catch {
      toast.error(t('errors.loadDetails'));
    } finally {
      setLoading(false);
    }
  }, [deviceId, t, toast]);

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
      toast.success(t('info.updated'));
    } catch {
      toast.error(t('info.updateError'));
    }
  };

  const handleLoadGroupIntoEditor = () => {
    if (!shareForm.permissionsGroupId) {
      toast.warning(t('form.selectPermissions'));
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
    toast.info(t('form.loadedGroup'));
  };

  const handleSaveCurrentGroup = async () => {
    const {
      name,
      see_screen,
      see_system_info,
      access_mouse,
      access_keyboard,
      access_terminal,
      manage_power
    } = shareForm.newGroup;
    if (!name.trim()) {
      toast.warning(t('sharing.nameRequired'));
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
      toast.success(t('form.groupSaved'));
    } catch {
      toast.error(t('form.groupSaveError'));
    }
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareForm.userEmail) {
      toast.warning(t('sharing.emailRequired'));
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
      toast.success(t('sharing.userInvited'));
    } catch {
      toast.error(t('sharing.inviteError'));
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    if (!confirm(t('sharing.removeConfirm'))) return;
    try {
      await deleteDeviceShareRequest(shareId);
      loadShares();
      toast.success(t('sharing.removed'));
    } catch {
      toast.error(t('sharing.removeError'));
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
    type PatchPayload = Partial<DeviceShareCreatePayload> & {
      permissions_group_attributes?: {
        name?: string;
        see_screen?: boolean;
        see_system_info?: boolean;
        access_mouse?: boolean;
        access_keyboard?: boolean;
        access_terminal?: boolean;
        manage_power?: boolean;
      };
    };
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
      toast.success(t('sharing.updated'));
    } catch {
      toast.error(t('sharing.updateShareError'));
    }
  };

  const handleDeleteDevice = async () => {
    if (!confirm(t('info.deleteConfirm'))) return;
    try {
      await deleteDeviceRequest(deviceId!);
      toast.success(t('info.deleted'));
      navigate('/devices');
    } catch {
      toast.error(t('info.deleteError'));
    }
  };

  if (loading) return <LoadingOverlay message={t('loading')} />;
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
              className="px-4 py-2 bg-primary text-white rounded-md hover:opacity-90 transition-opacity"
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
                if (!editForm.permissionsGroupId) {
                  toast.warning(t('form.selectPermissions'));
                  return;
                }
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
                toast.info(t('form.loadedGroup'));
              }}
              onSaveGroup={handleSaveCurrentGroup}
              onCancel={() => {
                setEditForm(null);
                setEditOriginalGroup(null);
              }}
            />
          )}

          <SharesList t={t} shares={shares} onDelete={handleDeleteShare} onEdit={beginEditShare} />
        </div>

        <button
          onClick={handleDeleteDevice}
          className="px-4 py-2 rounded-lg bg-error text-white hover:opacity-90 transition-opacity"
        >
          {t('info.deleteDevice')}
        </button>
      </div>
    </div>
  );
};

export default DeviceSettings;
