import { backendInstance } from "src/services/backend/config.ts";
import { getAccessToken } from "src/utils/auth.ts";
import type { PermissionsGroup, PermissionCapabilities } from "src/types";

export async function listPermissionsGroupsRequest() {
  return await backendInstance.get<{ items: PermissionsGroup[] }>("/permissions-groups", {
    headers: { Authorization: getAccessToken() }
  });
}

export async function createPermissionsGroupRequest(attrs: PermissionCapabilities & { name: string }) {
  return await backendInstance.post("/permissions-groups", {
    permissions_group: attrs
  }, {
    headers: { Authorization: getAccessToken() }
  });
}

