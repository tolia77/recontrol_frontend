import {backendInstance} from "src/services/backend/config.ts";
import {getAccessToken} from "src/utils/auth.ts";

export async function getMyDevicesRequest() {
    return await backendInstance.get("/devices/me", {
        headers: {
            Authorization: getAccessToken()
        }
    })
}

export async function getDeviceRequest(deviceId: string) {
    return await backendInstance.get(`/devices/${deviceId}`, {
        headers: { Authorization: getAccessToken() }
    });
}

export async function updateDeviceRequest(deviceId: string, payload: { name: string }) {
    return await backendInstance.patch(`/devices/${deviceId}`, { device: payload }, {
        headers: { Authorization: getAccessToken() }
    });
}

export async function deleteDeviceRequest(deviceId: string) {
    return await backendInstance.delete(`/devices/${deviceId}`, {
        headers: { Authorization: getAccessToken() }
    });
}
