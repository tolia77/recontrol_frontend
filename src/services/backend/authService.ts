import { BaseService } from "src/services/backend/BaseService.ts";
import { getRefreshToken } from "src/utils/auth.ts";

class AuthService extends BaseService {
  async login(email: string, password: string) {
    return await this.api.post(
      "/auth/login",
      { email, password },
      { skipAuth: true },
    );
  }

  async register(username: string, email: string, password: string) {
    return await this.api.post(
      "/auth/register",
      { user: { username, email, password } },
      { skipAuth: true },
    );
  }

  async refreshToken() {
    return await this.api.post(
      "/auth/refresh",
      {},
      {
        headers: { "Refresh-Token": getRefreshToken() },
        skipAuth: true,
      },
    );
  }

  async logout() {
    return await this.api.post(
      "/auth/logout",
      {},
      { headers: { "Refresh-Token": getRefreshToken() } },
    );
  }
}

export const authService = new AuthService();
