import { BaseService } from "src/services/backend/BaseService.ts";
import type { Meta } from "./envelope";
import type { PermissionsGroup, PermissionCapabilities } from "src/types";

class PermissionsGroupsService extends BaseService {
  async list(): Promise<{ items: PermissionsGroup[]; meta: Meta | null }> {
    const res = await this.api.get<PermissionsGroup[]>("/permissions-groups");
    return { items: res.data ?? [], meta: res.meta ?? null };
  }

  async create(attrs: PermissionCapabilities & { name: string }) {
    const res = await this.api.post<PermissionsGroup>("/permissions-groups", {
      permissions_group: attrs,
    });
    return res.data;
  }
}

export const permissionsGroupsService = new PermissionsGroupsService();
