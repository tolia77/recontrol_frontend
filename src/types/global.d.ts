export interface DeviceUser {
    id: string;
    username: string;
    email: string;
    role: string;
}

export interface Device {
    id: string;
    name: string;
    status: 'active' | 'inactive' | string;
    last_active_at: string | null;
    created_at: string;
    updated_at: string;
    user: DeviceUser;
}

// Additions
export interface User {
    id: string;
    username: string;
    email: string;
    role?: string;
}

export interface PermissionsGroup {
    id: string;
    name: string;
    see_screen: boolean | null;
    see_system_info: boolean | null;
    access_mouse: boolean | null;
    access_keyboard: boolean | null;
    access_terminal: boolean | null;
    manage_power: boolean | null;
    user_id: string;
    created_at?: string;
    updated_at?: string;
}

export interface DeviceShare {
    id: string;
    device_id: string;
    user_id: string;
    permissions_group_id: string;
    status: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
    device?: Pick<Device, 'id' | 'name'>;
    user?: Pick<User, 'id' | 'username' | 'email'>;
    permissions_group?: Pick<PermissionsGroup, 'id' | 'name' | 'see_screen' | 'see_system_info' | 'access_mouse' | 'access_keyboard' | 'access_terminal' | 'manage_power'>;
}

// New helper types for creating shares
export interface PermissionsGroupAttributes {
    name?: string;
    see_screen?: boolean | null;
    see_system_info?: boolean | null;
    access_mouse?: boolean | null;
    access_keyboard?: boolean | null;
    access_terminal?: boolean | null;
    manage_power?: boolean | null;
    user_id?: string;
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
