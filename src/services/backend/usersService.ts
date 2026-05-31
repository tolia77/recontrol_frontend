import { BaseService } from "src/services/backend/BaseService.ts";

export type UserResponse = {
  id: number | string;
  username: string;
  email: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
};

export type UserUpdateSelf = {
  username?: string;
  email?: string;
  password?: string;
};

export type UserCreateAdmin = {
  username: string;
  email: string;
  password: string;
  role: string;
};

export type UserUpdateAdmin = {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
};

class UsersService extends BaseService {
  async get(userId: string) {
    return await this.api.get<UserResponse>(`/users/${userId}`);
  }

  async updateSelf(userId: string, payload: UserUpdateSelf) {
    return await this.api.patch<UserResponse>(`/users/${userId}`, {
      user: payload,
    });
  }

  // Admin endpoints
  async list() {
    return await this.api.get<UserResponse[]>(`/users`);
  }

  async createAdmin(payload: UserCreateAdmin) {
    return await this.api.post<UserResponse>(`/users`, { user: payload });
  }

  async updateAdmin(userId: number | string, payload: UserUpdateAdmin) {
    return await this.api.patch<UserResponse>(`/users/${userId}`, {
      user: payload,
    });
  }

  async removeAdmin(userId: number | string) {
    return await this.api.delete<void>(`/users/${userId}`);
  }
}

export const usersService = new UsersService();
