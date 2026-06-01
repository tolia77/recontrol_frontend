// The standard backend response envelope.
export interface Meta {
  page: number;
  per_page: number;
  total: number;
}

export interface ApiError {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export interface ApiEnvelope<T = unknown> {
  data: T | null;
  meta: Meta | null;
  error: ApiError | null;
}

// Type guard: is a parsed body shaped like our envelope?
export function isApiEnvelope(body: unknown): body is ApiEnvelope {
  return (
    !!body &&
    typeof body === "object" &&
    "data" in body &&
    "meta" in body &&
    "error" in body
  );
}
