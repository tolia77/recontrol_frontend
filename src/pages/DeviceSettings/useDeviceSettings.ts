import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { devicesService } from "src/services/backend/devicesService";
import { deviceSharesService } from "src/services/backend/deviceSharesService";
import { permissionsGroupsService } from "src/services/backend/permissionsGroupsService";
import { useTranslation } from "react-i18next";
import { useToast } from "src/components/ui/Toast";
import type {
  ShareFormState,
  DeviceInfoFormState,
  EditShareFormState,
} from "./types";
import type {
  Device,
  DeviceShare,
  PermissionsGroup,
  DeviceShareCreatePayload,
} from "src/types";

/** Resolved boolean permission bits used in edit-share comparison. */
export interface PermGroupBits {
  see_screen: boolean;
  access_mouse: boolean;
  access_keyboard: boolean;
  access_terminal: boolean;
  manage_power: boolean;
  access_clipboard: boolean;
  files_read: boolean;
  files_write: boolean;
}

export interface UseDeviceSettingsArgs {
  deviceId: string | undefined;
}

export interface UseDeviceSettingsReturn {
  // loaded data
  device: Device | null;
  shares: DeviceShare[];
  permissionsGroups: PermissionsGroup[];
  loading: boolean;
  // form state
  deviceForm: DeviceInfoFormState;
  setDeviceForm: React.Dispatch<React.SetStateAction<DeviceInfoFormState>>;
  shareForm: ShareFormState;
  setShareForm: React.Dispatch<React.SetStateAction<ShareFormState>>;
  showShareForm: boolean;
  setShowShareForm: (v: boolean) => void;
  editForm: EditShareFormState | null;
  setEditForm: React.Dispatch<React.SetStateAction<EditShareFormState | null>>;
  editOriginalGroup: PermGroupBits | null;
  setEditOriginalGroup: React.Dispatch<React.SetStateAction<PermGroupBits | null>>;
  // handlers
  handleDeviceUpdate: (e: React.FormEvent) => Promise<void>;
  handleLoadGroupIntoEditor: () => void;
  handleEditLoadGroupIntoEditor: () => void;
  handleSaveCurrentGroup: () => Promise<void>;
  handleShareSubmit: (e: React.FormEvent) => Promise<void>;
  handleDeleteShare: (shareId: string) => Promise<void>;
  beginEditShare: (share: DeviceShare) => void;
  handleEditSubmit: (e: React.FormEvent) => Promise<void>;
  handleDeleteDevice: () => Promise<void>;
}

/**
 * Owns all data loading, form state, and CRUD handlers for the DeviceSettings page:
 * device + shares + permissions groups loading, update/delete device, invite/edit/delete shares,
 * and clone/save permissions groups.
 *
 * Per D-06: mechanical behavior-preserving extraction from DeviceSettings.tsx (P28.1-04).
 * Per D-02: plain useState (state fields are independent, no atomic transitions).
 */
export function useDeviceSettings(
  args: UseDeviceSettingsArgs,
): UseDeviceSettingsReturn {
  const { deviceId } = args;
  const { t } = useTranslation("deviceSettings");
  const navigate = useNavigate();
  const toast = useToast();

  const [device, setDevice] = useState<Device | null>(null);
  const [shares, setShares] = useState<DeviceShare[]>([]);
  const [loading, setLoading] = useState(true);

  const [deviceForm, setDeviceForm] = useState<DeviceInfoFormState>({
    name: "",
  });
  const [shareForm, setShareForm] = useState<ShareFormState>({
    userEmail: "",
    permissionsGroupId: "",
    expiresAt: "",
    newGroup: {
      name: "",
      see_screen: false,
      access_mouse: false,
      access_keyboard: false,
      access_terminal: false,
      manage_power: false,
      access_clipboard: false,
      files_read: false,
      files_write: false,
    },
  });
  const [permissionsGroups, setPermissionsGroups] = useState<PermissionsGroup[]>(
    [],
  );
  const [showShareForm, setShowShareForm] = useState(false);
  const [editForm, setEditForm] = useState<EditShareFormState | null>(null);
  const [editOriginalGroup, setEditOriginalGroup] =
    useState<PermGroupBits | null>(null);

  const loadDeviceData = useCallback(async () => {
    try {
      const device = await devicesService.get(deviceId!);
      setDevice(device);
      setDeviceForm({ name: device.name });
    } catch {
      toast.error(t("errors.loadDetails"));
    } finally {
      setLoading(false);
    }
  }, [deviceId, t, toast]);

  const loadShares = useCallback(async () => {
    try {
      const response = await deviceSharesService.list(deviceId!);
      setShares(response.items);
    } catch {
      console.error("Failed to load shares");
    }
  }, [deviceId]);

  const loadPermissionsGroups = useCallback(async () => {
    try {
      const response = await permissionsGroupsService.list();
      setPermissionsGroups(response.items);
    } catch {
      console.error("Failed to load permissions groups");
    }
  }, []);

  useEffect(() => {
    if (deviceId) {
      loadDeviceData();
      loadShares();
      loadPermissionsGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const handleDeviceUpdate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const device = await devicesService.update(deviceId!, {
          name: deviceForm.name,
        });
        setDevice(device);
        toast.success(t("info.updated"));
      } catch {
        toast.error(t("info.updateError"));
      }
    },
    [deviceId, deviceForm.name, t, toast],
  );

  const handleLoadGroupIntoEditor = useCallback(() => {
    if (!shareForm.permissionsGroupId) {
      toast.warning(t("form.selectPermissions"));
      return;
    }
    const group = permissionsGroups.find(
      (g) => g.id === shareForm.permissionsGroupId,
    );
    if (!group) return;
    setShareForm((prev) => ({
      ...prev,
      newGroup: {
        name: `${group.name} ${t("form.cloneSuffix")}`.trim(),
        see_screen: !!group.see_screen,
        access_mouse: !!group.access_mouse,
        access_keyboard: !!group.access_keyboard,
        access_terminal: !!group.access_terminal,
        manage_power: !!group.manage_power,
        access_clipboard: !!group.access_clipboard,
        files_read: !!group.files_read,
        files_write: !!group.files_write,
      },
    }));
    toast.info(t("form.loadedGroup"));
  }, [shareForm.permissionsGroupId, permissionsGroups, t, toast]);

  const handleEditLoadGroupIntoEditor = useCallback(() => {
    if (!editForm?.permissionsGroupId) {
      toast.warning(t("form.selectPermissions"));
      return;
    }
    const group = permissionsGroups.find(
      (g) => g.id === editForm.permissionsGroupId,
    );
    if (!group) return;
    const updatedPerms: PermGroupBits = {
      see_screen: !!group.see_screen,
      access_mouse: !!group.access_mouse,
      access_keyboard: !!group.access_keyboard,
      access_terminal: !!group.access_terminal,
      manage_power: !!group.manage_power,
      access_clipboard: !!group.access_clipboard,
      files_read: !!group.files_read,
      files_write: !!group.files_write,
    };
    setEditOriginalGroup(updatedPerms);
    setEditForm(
      (prev) =>
        prev && {
          ...prev,
          newGroup: {
            name: `${group.name} ${t("form.cloneSuffix")}`.trim(),
            ...updatedPerms,
          },
        },
    );
    toast.info(t("form.loadedGroup"));
  }, [editForm, permissionsGroups, t, toast]);

  const handleSaveCurrentGroup = useCallback(async () => {
    const {
      name,
      see_screen,
      access_mouse,
      access_keyboard,
      access_terminal,
      manage_power,
      access_clipboard,
      files_read,
      files_write,
    } = shareForm.newGroup;
    if (!name?.trim()) {
      toast.warning(t("sharing.nameRequired"));
      return;
    }
    try {
      await permissionsGroupsService.create({
        name: name.trim(),
        see_screen: see_screen ?? null,
        access_mouse: access_mouse ?? null,
        access_keyboard: access_keyboard ?? null,
        access_terminal: access_terminal ?? null,
        manage_power: manage_power ?? null,
        access_clipboard: access_clipboard ?? null,
        files_read: files_read ?? null,
        files_write: files_write ?? null,
      });
      await loadPermissionsGroups();
      toast.success(t("form.groupSaved"));
    } catch {
      toast.error(t("form.groupSaveError"));
    }
  }, [shareForm.newGroup, loadPermissionsGroups, t, toast]);

  const handleShareSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!shareForm.userEmail) {
        toast.warning(t("sharing.emailRequired"));
        return;
      }
      const payload: DeviceShareCreatePayload = {
        device_id: deviceId!,
        user_email: shareForm.userEmail || undefined,
        expires_at: shareForm.expiresAt || undefined,
      };
      if (shareForm.permissionsGroupId) {
        payload.permissions_group_id = shareForm.permissionsGroupId;
      } else {
        payload.permissions_group_attributes = {
          see_screen: shareForm.newGroup.see_screen,
          access_mouse: shareForm.newGroup.access_mouse,
          access_keyboard: shareForm.newGroup.access_keyboard,
          access_terminal: shareForm.newGroup.access_terminal,
          manage_power: shareForm.newGroup.manage_power,
          access_clipboard: shareForm.newGroup.access_clipboard,
          files_read: shareForm.newGroup.files_read,
          files_write: shareForm.newGroup.files_write,
        };
      }
      try {
        await deviceSharesService.create(payload);
        setShareForm({
          userEmail: "",
          permissionsGroupId: "",
          expiresAt: "",
          newGroup: {
            name: "",
            see_screen: false,
            access_mouse: false,
            access_keyboard: false,
            access_terminal: false,
            manage_power: false,
            access_clipboard: false,
            files_read: false,
            files_write: false,
          },
        });
        setShowShareForm(false);
        loadShares();
        toast.success(t("sharing.userInvited"));
      } catch {
        toast.error(t("sharing.inviteError"));
      }
    },
    [deviceId, shareForm, loadShares, t, toast],
  );

  const handleDeleteShare = useCallback(
    async (shareId: string) => {
      if (!confirm(t("sharing.removeConfirm"))) return;
      try {
        await deviceSharesService.remove(shareId);
        loadShares();
        toast.success(t("sharing.removed"));
      } catch {
        toast.error(t("sharing.removeError"));
      }
    },
    [loadShares, t, toast],
  );

  const beginEditShare = useCallback((share: DeviceShare) => {
    const originalPerms: PermGroupBits = {
      see_screen: !!share.permissions_group?.see_screen,
      access_mouse: !!share.permissions_group?.access_mouse,
      access_keyboard: !!share.permissions_group?.access_keyboard,
      access_terminal: !!share.permissions_group?.access_terminal,
      manage_power: !!share.permissions_group?.manage_power,
      access_clipboard: !!share.permissions_group?.access_clipboard,
      files_read: !!share.permissions_group?.files_read,
      files_write: !!share.permissions_group?.files_write,
    };
    setEditOriginalGroup(originalPerms);
    setEditForm({
      shareId: share.id,
      permissionsGroupId: share.permissions_group?.id || "",
      expiresAt: share.expires_at ? share.expires_at.substring(0, 16) : "",
      newGroup: {
        name: share.permissions_group?.name || "",
        ...originalPerms,
      },
    });
    setShowShareForm(false);
  }, []);

  const handleEditSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editForm) return;
      type PatchPayload = Partial<DeviceShareCreatePayload> & {
        permissions_group_attributes?: {
          name?: string;
          see_screen?: boolean | null;
          access_mouse?: boolean | null;
          access_keyboard?: boolean | null;
          access_terminal?: boolean | null;
          manage_power?: boolean | null;
          access_clipboard?: boolean | null;
          files_read?: boolean | null;
          files_write?: boolean | null;
        };
      };
      const payload: PatchPayload = {
        expires_at: editForm.expiresAt || undefined,
        device_id: deviceId!,
      };
      const changed =
        editOriginalGroup &&
        (editOriginalGroup.see_screen !== editForm.newGroup.see_screen ||
          editOriginalGroup.access_mouse !== editForm.newGroup.access_mouse ||
          editOriginalGroup.access_keyboard !==
            editForm.newGroup.access_keyboard ||
          editOriginalGroup.access_terminal !==
            editForm.newGroup.access_terminal ||
          editOriginalGroup.manage_power !== editForm.newGroup.manage_power ||
          editOriginalGroup.access_clipboard !==
            editForm.newGroup.access_clipboard ||
          editOriginalGroup.files_read !== editForm.newGroup.files_read ||
          editOriginalGroup.files_write !== editForm.newGroup.files_write);
      if (editForm.permissionsGroupId && !changed) {
        payload.permissions_group_id = editForm.permissionsGroupId;
      } else {
        payload.permissions_group_attributes = {
          name: editForm.newGroup.name || undefined,
          see_screen: editForm.newGroup.see_screen,
          access_mouse: editForm.newGroup.access_mouse,
          access_keyboard: editForm.newGroup.access_keyboard,
          access_terminal: editForm.newGroup.access_terminal,
          manage_power: editForm.newGroup.manage_power,
          access_clipboard: editForm.newGroup.access_clipboard,
          files_read: editForm.newGroup.files_read,
          files_write: editForm.newGroup.files_write,
        };
      }
      try {
        await deviceSharesService.update(editForm.shareId, payload);
        setEditForm(null);
        setEditOriginalGroup(null);
        await loadShares();
        toast.success(t("sharing.updated"));
      } catch {
        toast.error(t("sharing.updateShareError"));
      }
    },
    [deviceId, editForm, editOriginalGroup, loadShares, t, toast],
  );

  const handleDeleteDevice = useCallback(async () => {
    if (!confirm(t("info.deleteConfirm"))) return;
    try {
      await devicesService.remove(deviceId!);
      toast.success(t("info.deleted"));
      navigate("/devices");
    } catch {
      toast.error(t("info.deleteError"));
    }
  }, [deviceId, navigate, t, toast]);

  return useMemo(
    () => ({
      device,
      shares,
      permissionsGroups,
      loading,
      deviceForm,
      setDeviceForm,
      shareForm,
      setShareForm,
      showShareForm,
      setShowShareForm,
      editForm,
      setEditForm,
      editOriginalGroup,
      setEditOriginalGroup,
      handleDeviceUpdate,
      handleLoadGroupIntoEditor,
      handleEditLoadGroupIntoEditor,
      handleSaveCurrentGroup,
      handleShareSubmit,
      handleDeleteShare,
      beginEditShare,
      handleEditSubmit,
      handleDeleteDevice,
    }),
    [
      device,
      shares,
      permissionsGroups,
      loading,
      deviceForm,
      shareForm,
      showShareForm,
      editForm,
      editOriginalGroup,
      handleDeviceUpdate,
      handleLoadGroupIntoEditor,
      handleEditLoadGroupIntoEditor,
      handleSaveCurrentGroup,
      handleShareSubmit,
      handleDeleteShare,
      beginEditShare,
      handleEditSubmit,
      handleDeleteDevice,
    ],
  );
}
