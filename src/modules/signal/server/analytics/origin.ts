import "server-only";

import { AnalyticsApiError } from "./errors";
import { mutationOriginIssue } from "./origin-policy";

/** Require browser mutations to come from the same site as the request. */
export function assertTrustedMutationOrigin(request: Request): void {
  const issue = mutationOriginIssue(request);
  if (issue === "cross_site") {
    throw new AnalyticsApiError(403, "invalid_origin", "Cross-site preference changes are not allowed.");
  }
  if (issue === "missing_origin") {
    throw new AnalyticsApiError(403, "invalid_origin", "An Origin header is required.");
  }
  if (issue === "invalid_origin") {
    throw new AnalyticsApiError(403, "invalid_origin", "The request origin is invalid.");
  }
  if (issue === "origin_mismatch") {
    throw new AnalyticsApiError(403, "invalid_origin", "The request origin does not match this Signal site.");
  }
}
