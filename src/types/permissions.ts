export interface PermissionCapabilities {
  see_screen: boolean | null;
  see_system_info: boolean | null;
  access_mouse: boolean | null;
  access_keyboard: boolean | null;
  access_terminal: boolean | null;
  manage_power: boolean | null;
}

export interface PermissionsGroup extends PermissionCapabilities {
  id: string;
  name: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
}

// Replaces the duplicate in DeviceControl/types.ts (D-07)
export type PermissionsSubset = Partial<PermissionCapabilities>;

// Replaces the inline Required<Pick<...>> in permissionsGroupsRequests.ts (D-07)
export interface PermissionsGroupAttributes extends Partial<PermissionCapabilities> {
  name?: string;
  user_id?: string;
}
