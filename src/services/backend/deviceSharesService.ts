import { BaseService } from "src/services/backend/BaseService.ts";
import type { Meta } from "./envelope";
import type {
  DeviceShare,
  DeviceShareCreatePayload,
  PermissionsGroupAttributes,
} from "src/types";

class DeviceSharesService extends BaseService {
  async list(deviceId: string): Promise<{ items: DeviceShare[]; meta: Meta | null }> {
    const res = await this.api.get<DeviceShare[]>("/device-shares", {
      params: { device_id: deviceId },
    });
    return { items: res.data ?? [], meta: res.meta ?? null };
  }

  async create(payload: DeviceShareCreatePayload) {
    const res = await this.api.post<DeviceShare>("/device-shares", { device_share: payload });
    return res.data;
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
    const res = await this.api.patch<DeviceShare>(`/device-shares/${shareId}`, {
      device_share: payload,
    });
    return res.data;
  }

  // current user's shares (me) for a specific device
  async mineForDevice(deviceId: string): Promise<{ items: DeviceShare[]; meta: Meta | null }> {
    const res = await this.api.get<DeviceShare[]>("/device-shares/me", {
      params: { device_id: deviceId },
    });
    return { items: res.data ?? [], meta: res.meta ?? null };
  }
}

export const deviceSharesService = new DeviceSharesService();
