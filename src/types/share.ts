import type { Device } from "./device";
import type { User } from "./user";
import type {
  PermissionsGroup,
  PermissionsGroupAttributes,
} from "./permissions";

export interface DeviceShare {
  id: string;
  device_id: string;
  user_id: string;
  permissions_group_id: string;
  status: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  device?: Pick<Device, "id" | "name">;
  user?: Pick<User, "id" | "username" | "email">;
  permissions_group?: Pick<
    PermissionsGroup,
    | "id"
    | "name"
    | "see_screen"
    | "access_mouse"
    | "access_keyboard"
    | "access_terminal"
    | "manage_power"
    | "access_clipboard"
    | "files_read"
    | "files_write"
  >;
}

export interface DeviceShareCreatePayload {
  device_id: string;
  user_id?: string;
  user_email?: string;
  permissions_group_id?: string;
  permissions_group_attributes?: PermissionsGroupAttributes;
  expires_at?: string;
  // status intentionally omitted from UI editing
}
