import { backendInstance } from "src/services/backend/config.ts";
import { getAccessToken } from "src/utils/auth.ts";
import type { DeviceShare, DeviceShareCreatePayload, PermissionsGroupAttributes } from "src/types";

export async function listDeviceSharesRequest(deviceId: string) {
  return await backendInstance.get<{ items: DeviceShare[] }>("/device-shares", {
    params: { device_id: deviceId },
    headers: { Authorization: getAccessToken() }
  });
}

export async function createDeviceShareRequest(payload: DeviceShareCreatePayload) {
  return await backendInstance.post("/device-shares", { device_share: payload }, {
    headers: { Authorization: getAccessToken() }
  });
}

export async function deleteDeviceShareRequest(shareId: string) {
  return await backendInstance.delete(`/device-shares/${shareId}`, {
    headers: { Authorization: getAccessToken() }
  });
}

export async function updateDeviceShareRequest(shareId: string, payload: Partial<DeviceShareCreatePayload> & { permissions_group_attributes?: PermissionsGroupAttributes }) {
  return await backendInstance.patch(`/device-shares/${shareId}`, { device_share: payload }, {
    headers: { Authorization: getAccessToken() }
  });
}

// New: fetch current user's shares (me) for a specific device
export async function getMyDeviceSharesForDeviceRequest(deviceId: string) {
  return await backendInstance.get<{ items: DeviceShare[] }>("/device-shares/me", {
    params: { device_id: deviceId },
    headers: { Authorization: getAccessToken() }
  });
}
