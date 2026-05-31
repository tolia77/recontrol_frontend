import { BaseService } from "src/services/backend/BaseService.ts";
import type { PermissionsGroup, PermissionCapabilities } from "src/types";

class PermissionsGroupsService extends BaseService {
  async list() {
    return await this.api.get<{ items: PermissionsGroup[] }>(
      "/permissions-groups",
    );
  }

  async create(attrs: PermissionCapabilities & { name: string }) {
    return await this.api.post("/permissions-groups", {
      permissions_group: attrs,
    });
  }
}

export const permissionsGroupsService = new PermissionsGroupsService();
