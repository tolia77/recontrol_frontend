import { BaseService } from "src/services/backend/BaseService.ts";
import type { Meta } from "src/services/backend/envelope.ts";
import type { Device } from "src/types";

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
  async list(params?: GetMyDevicesParams): Promise<{ devices: Device[]; meta: Meta | null }> {
    const res = await this.api.get<Device[]>("/devices/me", {
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
    return { devices: res.data ?? [], meta: res.meta ?? null };
  }

  async get(deviceId: string): Promise<Device> {
    const res = await this.api.get<Device>(`/devices/${deviceId}`);
    return res.data;
  }

  async update(deviceId: string, payload: { name: string }): Promise<Device> {
    const res = await this.api.patch<Device>(`/devices/${deviceId}`, { device: payload });
    return res.data;
  }

  async remove(deviceId: string) {
    const res = await this.api.delete(`/devices/${deviceId}`);
    this.refreshUsage(); // device_limit changed
    return res;
  }
}

export const devicesService = new DevicesService();
