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
  async get(userId: string): Promise<UserResponse> {
    const res = await this.api.get<UserResponse>(`/users/${userId}`);
    return res.data;
  }

  async updateSelf(userId: string, payload: UserUpdateSelf): Promise<UserResponse> {
    const res = await this.api.patch<UserResponse>(`/users/${userId}`, {
      user: payload,
    });
    return res.data;
  }

  // Admin endpoints
  async list(): Promise<UserResponse[]> {
    const res = await this.api.get<UserResponse[]>(`/users`);
    return res.data;
  }

  async createAdmin(payload: UserCreateAdmin): Promise<UserResponse> {
    const res = await this.api.post<UserResponse>(`/users`, { user: payload });
    return res.data;
  }

  async updateAdmin(userId: number | string, payload: UserUpdateAdmin): Promise<UserResponse> {
    const res = await this.api.patch<UserResponse>(`/users/${userId}`, {
      user: payload,
    });
    return res.data;
  }

  async removeAdmin(userId: number | string): Promise<void> {
    await this.api.delete<void>(`/users/${userId}`);
  }
}

export const usersService = new UsersService();
