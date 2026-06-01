import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getRefreshToken, saveTokens, getAccessToken } from "src/utils/auth";
import { triggerPlanLimitNudge } from "src/utils/planLimitBus.ts";
import type { PlanLimitEnvelope } from "src/services/backend/subscriptionService.ts";
import { isApiEnvelope, type ApiError } from "./envelope";

interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface ErrorResponseData {
  error?: ApiError;
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

      const tokens = res.data?.data ?? {};
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
  (response) => {
    const body = response.data;
    if (isApiEnvelope(body)) {
      response.meta = body.meta;
      response.data = body.data as typeof response.data;
    }
    return response;
  },
  async (error: AxiosError<ErrorResponseData>) => {
    const envelopeError: ApiError | undefined =
      error.response?.data?.error ?? undefined;
    if (envelopeError) error.apiError = envelopeError;
    const status = error.response?.status;
    const code = envelopeError?.code;

    const originalRequest = error.config as
      | ExtendedAxiosRequestConfig
      | undefined;

    if (
      status === 401 &&
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
    } else if (status === 402 || code === "plan_limit_reached") {
      // D-15: global upgrade nudge — fire once and re-reject; no retry loop.
      // The backend returns the new envelope shape:
      //   { data: null, meta: null, error: { code, message, details: { limit_name, … } } }
      // The interceptor does NOT unwrap error responses, so error.response.data
      // is the full envelope.  Build the flat PlanLimitEnvelope the nudge
      // consumers (Layout.tsx etc.) expect by spreading details up to the top.
      if (envelopeError) {
        triggerPlanLimitNudge({
          error: "plan_limit_reached",
          ...(envelopeError.details as Record<string, unknown>),
        } as unknown as PlanLimitEnvelope);
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);
