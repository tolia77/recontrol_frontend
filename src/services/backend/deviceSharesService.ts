import { BaseService } from "src/services/backend/BaseService.ts";
import type {
  DeviceShare,
  DeviceShareCreatePayload,
  PermissionsGroupAttributes,
} from "src/types";

class DeviceSharesService extends BaseService {
  async list(deviceId: string) {
    return await this.api.get<{ items: DeviceShare[] }>("/device-shares", {
      params: { device_id: deviceId },
    });
  }

  async create(payload: DeviceShareCreatePayload) {
    return await this.api.post("/device-shares", { device_share: payload });
  }

  async remove(shareId: string) {
    return await this.api.delete(`/device-shares/${shareId}`);
  }

  async update(
    shareId: string,
    payload: Partial<DeviceShareCreatePayload> & {
      permissions_group_attributes?: PermissionsGroupAttributes;
    },
  ) {
    return await this.api.patch(`/device-shares/${shareId}`, {
      device_share: payload,
    });
  }

  // current user's shares (me) for a specific device
  async mineForDevice(deviceId: string) {
    return await this.api.get<{ items: DeviceShare[] }>("/device-shares/me", {
      params: { device_id: deviceId },
    });
  }
}

export const deviceSharesService = new DeviceSharesService();
