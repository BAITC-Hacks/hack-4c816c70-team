import type { ApiErrorDto } from "@/lib/contracts/api.generated";

export type ApiErrorKind = "network" | "timeout" | "aborted" | "http" | "invalid-json" | "contract";

export class ApiClientError extends Error {
  constructor(readonly kind: ApiErrorKind, message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** Converts the documented API error envelope and safely handles malformed envelopes. */
export function normalizeApiError(value: unknown, status: number): ApiClientError {
  const dto = value as Partial<ApiErrorDto>;
  if (dto.error && typeof dto.error.message === "string") {
    return new ApiClientError("http", dto.error.message, status, typeof dto.error.code === "string" ? dto.error.code : undefined);
  }
  return new ApiClientError("http", `Сервер вернул ошибку ${status}.`, status);
}
