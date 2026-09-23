export type ApiErrorKind = "network" | "timeout" | "aborted" | "http" | "invalid-json" | "contract";

export class ApiClientError extends Error {
  constructor(readonly kind: ApiErrorKind, message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** Converts the documented API error envelope and safely handles malformed envelopes. */
export function normalizeApiError(value: unknown, status: number): ApiClientError {
  const envelope = typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const detail = envelope?.error;
  if (typeof detail === "object" && detail !== null && !Array.isArray(detail)) {
    const error = detail as Record<string, unknown>;
    if (typeof error.message === "string") {
      return new ApiClientError("http", error.message, status, typeof error.code === "string" ? error.code : undefined);
    }
  }
  return new ApiClientError("http", `Сервер вернул ошибку ${status}.`, status);
}
