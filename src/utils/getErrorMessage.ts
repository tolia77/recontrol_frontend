import type { ApiError } from "../services/backend/envelope";

export function getErrorMessage(err: unknown): string {
  const axiosErr = err as
    | { apiError?: ApiError; response?: { data?: { error?: ApiError } } }
    | undefined;

  const apiError = axiosErr?.apiError ?? axiosErr?.response?.data?.error;

  if (apiError && typeof apiError === "object" && typeof apiError.message === "string") {
    const details = apiError.details;
    if (details && typeof details === "object") {
      const fieldMsgs: string[] = [];
      Object.entries(details).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          const cap = key.charAt(0).toUpperCase() + key.slice(1);
          value.forEach((v) => fieldMsgs.push(`${cap} ${String(v)}`));
        }
      });
      if (fieldMsgs.length) return fieldMsgs.join(", ");
    }
    return apiError.message;
  }

  return "An unexpected error occurred";
}
