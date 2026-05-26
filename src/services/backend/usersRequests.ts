import { backendInstance } from "src/services/backend/config.ts";

export type UserResponse = {
  id: number | string;
  username: string;
  email: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
};

export async function getUserRequest(userId: string) {
  return await backendInstance.get<UserResponse>(`/users/${userId}`);
}

export type UserUpdateSelf = {
  username?: string;
  email?: string;
  password?: string;
};

export async function updateUserSelfRequest(userId: string, payload: UserUpdateSelf) {
  return await backendInstance.patch<UserResponse>(`/users/${userId}`, {
    user: payload
  });
}

// Admin endpoints
export async function listUsersRequest() {
  return await backendInstance.get<UserResponse[]>(`/users`);
}

export type UserCreateAdmin = { username: string; email: string; password: string; role: string };
export async function createUserAdminRequest(payload: UserCreateAdmin) {
  return await backendInstance.post<UserResponse>(`/users`, { user: payload });
}

export type UserUpdateAdmin = { username?: string; email?: string; password?: string; role?: string };
export async function updateUserAdminRequest(userId: number | string, payload: UserUpdateAdmin) {
  return await backendInstance.patch<UserResponse>(`/users/${userId}`, { user: payload });
}

export async function deleteUserAdminRequest(userId: number | string) {
  return await backendInstance.delete<void>(`/users/${userId}`);
}
