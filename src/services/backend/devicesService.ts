import { BaseService } from "src/services/backend/BaseService.ts";

export interface GetMyDevicesParams {
  owner?: "me" | "owned" | "shared" | "";
  status?: "active" | "inactive" | "";
  name?: string;
  last_active_from?: string; // ISO-like datetime string
  last_active_to?: string; // ISO-like datetime string
  page?: number;
  per_page?: number;
}

class DevicesService extends BaseService {
  async list(params?: GetMyDevicesParams) {
    return await this.api.get("/devices/me", {
      params: {
        // only include defined values
        ...(params?.owner ? { owner: params.owner } : {}),
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.name ? { name: params.name } : {}),
        ...(params?.last_active_from
          ? { last_active_from: params.last_active_from }
          : {}),
        ...(params?.last_active_to
          ? { last_active_to: params.last_active_to }
          : {}),
        ...(params?.page ? { page: params.page } : {}),
        ...(params?.per_page ? { per_page: params.per_page } : {}),
      },
    });
  }

  async get(deviceId: string) {
    return await this.api.get(`/devices/${deviceId}`);
  }

  async update(deviceId: string, payload: { name: string }) {
    return await this.api.patch(`/devices/${deviceId}`, { device: payload });
  }

  async remove(deviceId: string) {
    const res = await this.api.delete(`/devices/${deviceId}`);
    this.refreshUsage(); // device_limit changed
    return res;
  }
}

export const devicesService = new DevicesService();
