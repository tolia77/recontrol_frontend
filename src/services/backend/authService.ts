import { BaseService } from "src/services/backend/BaseService.ts";
import { getRefreshToken } from "src/utils/auth.ts";
import type { AxiosResponse } from "axios";

export interface AuthData {
  user_id: string;
  role?: string;
  access_token: string;
  refresh_token: string;
}

export interface RefreshData {
  access_token: string;
  refresh_token: string;
}

class AuthService extends BaseService {
  async login(email: string, password: string): Promise<AxiosResponse<AuthData>> {
    return await this.api.post<AuthData>(
      "/auth/login",
      { email, password },
      { skipAuth: true },
    );
  }

  async register(username: string, email: string, password: string): Promise<AxiosResponse<AuthData>> {
    return await this.api.post<AuthData>(
      "/auth/register",
      { user: { username, email, password } },
      { skipAuth: true },
    );
  }

  async refreshToken(): Promise<AxiosResponse<RefreshData>> {
    return await this.api.post<RefreshData>(
      "/auth/refresh",
      {},
      {
        headers: { "Refresh-Token": getRefreshToken() },
        skipAuth: true,
      },
    );
  }

  async logout(): Promise<AxiosResponse<void>> {
    return await this.api.post<void>(
      "/auth/logout",
      {},
      { headers: { "Refresh-Token": getRefreshToken() } },
    );
  }
}

export const authService = new AuthService();
