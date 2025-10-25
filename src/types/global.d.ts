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