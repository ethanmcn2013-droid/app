export type MutationOriginIssue =
  | "cross_site"
  | "missing_origin"
  | "invalid_origin"
  | "origin_mismatch";

/** Pure same-origin decision used by the preference mutation route. */
export function mutationOriginIssue(request: Request): MutationOriginIssue | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const requestUrl = new URL(request.url);

  if (fetchSite === "cross-site") return "cross_site";
  if (!origin) return "missing_origin";

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return "invalid_origin";
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const expectedHost = forwardedHost || request.headers.get("host") || requestUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const expectedProtocol = forwardedProto ? `${forwardedProto}:` : requestUrl.protocol;
  return originUrl.host === expectedHost && originUrl.protocol === expectedProtocol
    ? null
    : "origin_mismatch";
}
