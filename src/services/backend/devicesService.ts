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

export interface GetAllDevicesParams {
  user_id?: string;
  status?: "active" | "inactive" | "";
  name?: string;
  last_active_from?: string;
  last_active_to?: string;
  sort?: string;
  direction?: "asc" | "desc";
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

  // Admin-scoped: hits /devices (Device.all), NOT /devices/me
  async listAll(params?: GetAllDevicesParams): Promise<{ devices: Device[]; meta: Meta | null }> {
    const res = await this.api.get<Device[]>("/devices", {
      params: {
        ...(params?.user_id ? { user_id: params.user_id } : {}),
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.name ? { name: params.name } : {}),
        ...(params?.last_active_from ? { last_active_from: params.last_active_from } : {}),
        ...(params?.last_active_to ? { last_active_to: params.last_active_to } : {}),
        ...(params?.sort ? { sort: params.sort } : {}),
        ...(params?.direction ? { direction: params.direction } : {}),
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
