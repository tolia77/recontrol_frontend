import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getRefreshToken, saveTokens, getAccessToken } from "src/utils/auth";

interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface ErrorResponseData {
  error?: string;
}

export const backendInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
});

// ── Request interceptor ────────────────────────────────────────────────────
// Injects Authorization on every request unless config.skipAuth is true.
backendInstance.interceptors.request.use((config) => {
  if (config.skipAuth) return config;
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = token;
  }
  return config;
});

// ── Refresh mutex ──────────────────────────────────────────────────────────
// Prevents concurrent refresh calls from racing and cascade-revoking sessions.
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessTokenOnce(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;

      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/auth/refresh`,
        {},
        { headers: { "Refresh-Token": refreshToken } },
      );

      const tokens = res.data ?? {};
      const newAccess: string | undefined = tokens.access_token;
      const newRefresh: string | undefined = tokens.refresh_token;

      if (newAccess) {
        saveTokens(newAccess, newRefresh ?? null);
      }
      return newAccess ?? null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ── Response interceptor ───────────────────────────────────────────────────
backendInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponseData>) => {
    const originalRequest = error.config as
      | ExtendedAxiosRequestConfig
      | undefined;
    const status = error.response?.status;
    const messageText = error.response?.data?.error;

    if (
      status === 401 &&
      messageText === "Unauthorized" &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      const newAccess = await refreshAccessTokenOnce();
      if (newAccess) {
        originalRequest.headers.Authorization = newAccess;
        return backendInstance(originalRequest);
      }

      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);
