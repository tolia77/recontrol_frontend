export interface PermissionCapabilities {
  see_screen: boolean | null;
  access_mouse: boolean | null;
  access_keyboard: boolean | null;
  access_terminal: boolean | null;
  manage_power: boolean | null;
  access_clipboard: boolean | null;
  files_read: boolean | null;
  files_write: boolean | null;
}

export interface PermissionsGroup extends PermissionCapabilities {
  id: string;
  name: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
}

export type PermissionsSubset = Partial<PermissionCapabilities>;

export interface PermissionsGroupAttributes extends Partial<PermissionCapabilities> {
  name?: string;
  user_id?: string;
}
