export type AnalyticsErrorCode =
  | "analytics_disabled"
  | "unauthorized"
  | "beta_access_required"
  | "forbidden"
  | "scope_not_found"
  | "invalid_request"
  | "invalid_origin"
  | "provider_unavailable"
  | "not_found"
  | "method_not_allowed"
  | "internal_error";

export class AnalyticsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: AnalyticsErrorCode,
    message: string,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "AnalyticsApiError";
  }
}
