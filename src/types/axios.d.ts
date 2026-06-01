import type { Meta, ApiError } from "../services/backend/envelope";

declare module "axios" {
  interface AxiosRequestConfig {
    skipAuth?: boolean;
  }
  interface AxiosResponse {
    // Pagination metadata stashed by the success interceptor (null when absent).
    meta?: Meta | null;
  }
  interface AxiosError {
    // Normalized envelope error attached by the error interceptor.
    apiError?: ApiError;
  }
}
