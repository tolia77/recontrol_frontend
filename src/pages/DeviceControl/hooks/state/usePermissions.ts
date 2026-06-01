import { useCallback, useMemo, useState } from "react";
import { deviceSharesService } from "src/services/backend/deviceSharesService";
import type { DeviceShare } from "src/types";

/**
 * Derived permissions interface for easier gating.
 * Moved from DeviceControl.tsx per D-01/DEVCTL-03. This is the single
 * definition site for device permission building and command gating.
 */
export interface DevicePermissions {
  see_screen: boolean;
  see_system_info: boolean;
  access_mouse: boolean;
  access_keyboard: boolean;
  access_terminal: boolean;
  manage_power: boolean;
  // convenience compound flags
  any_input: boolean; // mouse or keyboard
  any_screen: boolean; // currently same as see_screen
}

export interface UsePermissionsReturn {
  permissions: DevicePermissions | null;
  permissionsLoading: boolean;
  isOwner: boolean;
  setIsOwner: (v: boolean) => void;
  fetchPermissions: (devId: string, ownerOverride: boolean) => Promise<void>;
  canSend: (type: string) => boolean;
}

/**
 * Owns all permission state for DeviceControl: the DevicePermissions slice,
 * ownership flag, fetchPermissions async flow, and canSend command-gating.
 *
 * Per D-01: feature sub-hook extracted from DeviceControl's inline state.
 * Per DEVCTL-03: buildPermissions and canSend exist in exactly one place here.
 * Per D-02: plain useState (transitions are independent, no interrelation).
 */
export function usePermissions(): UsePermissionsReturn {
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissions, setPermissions] = useState<DevicePermissions | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);

  const buildPermissions = useCallback(
    (share: DeviceShare | null): DevicePermissions => {
      const pg = share?.permissions_group;
      const ownDefaults: DevicePermissions = {
        see_screen: true,
        see_system_info: true,
        access_mouse: true,
        access_keyboard: true,
        access_terminal: true,
        manage_power: true,
        any_input: true,
        any_screen: true,
      };
      if (!pg) return ownDefaults;
      return {
        see_screen: !!pg.see_screen,
        see_system_info: !!pg.see_system_info,
        access_mouse: !!pg.access_mouse,
        access_keyboard: !!pg.access_keyboard,
        access_terminal: !!pg.access_terminal,
        manage_power: !!pg.manage_power,
        any_input: !!pg.access_mouse || !!pg.access_keyboard,
        any_screen: !!pg.see_screen,
      };
    },
    [],
  );

  const fetchPermissions = useCallback(
    async (devId: string, ownerOverride: boolean) => {
      if (!devId) return;
      setPermissionsLoading(true);
      try {
        if (ownerOverride) {
          setPermissions(buildPermissions(null)); // full access
          return;
        }
        const res = await deviceSharesService.mineForDevice(devId);
        const share = res.items.length ? res.items[0] : null;
        setPermissions(buildPermissions(share));
      } catch (e) {
        console.warn("Failed to load device permissions", e);
        setPermissions(buildPermissions(null));
      } finally {
        setPermissionsLoading(false);
      }
    },
    [buildPermissions],
  );

  const canSend = useCallback(
    (type: string): boolean => {
      if (!permissions) return false; // still loading
      if (isOwner) return true; // owners bypass all restrictions
      if (type.startsWith("screen.")) return permissions.see_screen;
      if (type.startsWith("mouse.")) return permissions.access_mouse;
      if (type.startsWith("keyboard.")) return permissions.access_keyboard;
      if (type.startsWith("terminal.")) return permissions.access_terminal;
      if (type.startsWith("power.")) return permissions.manage_power;
      return true;
    },
    [permissions, isOwner],
  );

  return useMemo(
    () => ({
      permissions,
      permissionsLoading,
      isOwner,
      setIsOwner,
      fetchPermissions,
      canSend,
    }),
    [permissions, permissionsLoading, isOwner, setIsOwner, fetchPermissions, canSend],
  );
}
