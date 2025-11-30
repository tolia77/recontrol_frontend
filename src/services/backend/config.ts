import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getRefreshToken } from 'src/utils/auth';

interface RefreshTokenResponse {
  access?: string;
  access_token?: string;
  accessToken?: string;
  token?: string;
  refresh?: string;
  refresh_token?: string;
  refreshToken?: string;
}

interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface ErrorResponseData {
  error?: string;
}

export const backendInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL
});

backendInstance.interceptors.response.use(
  response => response,
  async (error: AxiosError<ErrorResponseData>) => {
    const originalRequest = error.config as ExtendedAxiosRequestConfig | undefined;
    const status = error.response?.status;
    const messageText = error.response?.data?.error;

    if (status === 401 && messageText === 'Unauthorized' && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshRes = await axios.post<RefreshTokenResponse>(
          `${import.meta.env.VITE_BACKEND_URL}/auth/refresh`,
          {},
          {
            headers: {
              'Refresh-Token': getRefreshToken()
            }
          }
        );

        const tokens = refreshRes.data ?? {};
        const newAccess = tokens.access || tokens.access_token || tokens.accessToken || tokens.token;
        const newRefresh = tokens.refresh || tokens.refresh_token || tokens.refreshToken;

        if (newAccess) {
          localStorage.setItem('access_token', newAccess);
        }
        if (newRefresh) {
          localStorage.setItem('refresh_token', newRefresh);
        }

        if (newAccess) {
          originalRequest.headers.Authorization = newAccess;
        }

        return backendInstance(originalRequest);
      } catch (refreshError) {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
