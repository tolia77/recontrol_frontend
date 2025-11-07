import { backendInstance } from "src/services/backend/config.ts";
import { getAccessToken } from "src/utils/auth.ts";
import type { PermissionsGroup, PermissionsGroupAttributes } from "src/types/global";

export async function listPermissionsGroupsRequest() {
  return await backendInstance.get<{ items: PermissionsGroup[] }>("/permissions_groups", {
    headers: { Authorization: getAccessToken() }
  });
}

export async function createPermissionsGroupRequest(attrs: Required<Pick<PermissionsGroupAttributes,
  "see_screen" | "see_system_info" | "access_mouse" | "access_keyboard" | "access_terminal" | "manage_power">> & { name: string }) {
  return await backendInstance.post("/permissions_groups", {
    permissions_group: attrs
  }, {
    headers: { Authorization: getAccessToken() }
  });
}

