import { backendInstance } from "src/services/backend/config.ts";
import { getAccessToken } from "src/utils/auth.ts";

export type UserResponse = {
  id: number | string;
  username: string;
  email: string;
  role?: string;
};

export async function getUserRequest(userId: string) {
  return await backendInstance.get<UserResponse>(`/users/${userId}` , {
    headers: {
      Authorization: getAccessToken()
    }
  });
}

export type UserUpdateSelf = {
  username?: string;
  email?: string;
  password?: string;
};

export async function updateUserSelfRequest(userId: string, payload: UserUpdateSelf) {
  return await backendInstance.patch<UserResponse>(`/users/${userId}`, {
    user: payload
  }, {
    headers: {
      Authorization: getAccessToken()
    }
  });
}

