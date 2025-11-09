import {backendInstance} from "src/services/backend/config.ts";
import {getAccessToken} from "src/utils/auth.ts";

export interface GetMyDevicesParams {
    owner?: 'me' | 'owned' | 'shared' | '';
    status?: 'active' | 'inactive' | '';
    name?: string;
    last_active_from?: string; // ISO-like datetime string
    last_active_to?: string;   // ISO-like datetime string
    page?: number;
    per_page?: number;
}

export async function getMyDevicesRequest(params?: GetMyDevicesParams) {
    return await backendInstance.get("/devices/me", {
        headers: {
            Authorization: getAccessToken()
        },
        params: {
            // only include defined values
            ...(params?.owner ? {owner: params.owner} : {}),
            ...(params?.status ? {status: params.status} : {}),
            ...(params?.name ? {name: params.name} : {}),
            ...(params?.last_active_from ? {last_active_from: params.last_active_from} : {}),
            ...(params?.last_active_to ? {last_active_to: params.last_active_to} : {}),
            ...(params?.page ? {page: params.page} : {}),
            ...(params?.per_page ? {per_page: params.per_page} : {}),
        }
    })
}

export async function getDeviceRequest(deviceId: string) {
    return await backendInstance.get(`/devices/${deviceId}`, {
        headers: {Authorization: getAccessToken()}
    });
}

export async function updateDeviceRequest(deviceId: string, payload: { name: string }) {
    return await backendInstance.patch(`/devices/${deviceId}`, {device: payload}, {
        headers: {Authorization: getAccessToken()}
    });
}

export async function deleteDeviceRequest(deviceId: string) {
    return await backendInstance.delete(`/devices/${deviceId}`, {
        headers: {Authorization: getAccessToken()}
    });
}
