export type RuntimeIssue =
  | { kind: "pageerror"; message: string }
  | { kind: "console"; message: string; url: string }
  | { kind: "http"; status: number; resourceType: string; url: string }
  | { kind: "requestfailed"; message: string; resourceType: string; url: string };

export type RuntimeWatch = {
  issues: RuntimeIssue[];
  intentionalEventSourceTeardowns: Set<string>;
  completedQualifiedViewWrites: Set<string>;
};

export type MainDocumentAllowance = { status: number; url: string } | null;

export type RuntimeResponse = {
  headers: Record<string, string>;
  method?: string;
  resourceType: string;
  status: number;
  url: string;
};

export function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url;
  }
}

function isExactQualifiedViewEndpoint(url: string, currentPageUrl: string) {
  try {
    const requestUrl = new URL(url);
    const pageUrl = new URL(currentPageUrl);
    const pageSegments = pageUrl.pathname.split("/").filter(Boolean);
    const requestSegments = requestUrl.pathname.split("/").filter(Boolean);
    return (
      requestUrl.origin === pageUrl.origin &&
      pageUrl.search === "" &&
      requestUrl.search === "" &&
      pageSegments.length === 2 &&
      pageSegments[0] === "s" &&
      requestSegments.length === 3 &&
      requestSegments[0] === "s" &&
      requestSegments[1] === pageSegments[1] &&
      requestSegments[2] === "view"
    );
  } catch {
    return false;
  }
}

function isExactRealtimeEndpoint(url: string, currentPageUrl: string) {
  try {
    const requestUrl = new URL(url);
    const pageUrl = new URL(currentPageUrl);
    return (
      requestUrl.origin === pageUrl.origin &&
      requestUrl.pathname === "/api/events" &&
      requestUrl.search === ""
    );
  } catch {
    return false;
  }
}

export function isIntentionalEventSourceDisableResponse(
  response: RuntimeResponse,
  currentPageUrl: string,
) {
  return (
    response.resourceType === "eventsource" &&
    response.status === 204 &&
    response.headers["x-realtime-disabled"] === "single-process-substrate" &&
    isExactRealtimeEndpoint(response.url, currentPageUrl)
  );
}

export function isCompletedQualifiedViewResponse(
  response: RuntimeResponse,
  currentPageUrl: string,
) {
  return (
    response.method === "POST" &&
    response.resourceType === "fetch" &&
    response.status === 204 &&
    isExactQualifiedViewEndpoint(response.url, currentPageUrl)
  );
}

function isIntentionalEventSourceTeardown(
  issue: RuntimeIssue,
  runtime: RuntimeWatch,
  currentPageUrl: string,
) {
  return (
    issue.kind === "requestfailed" &&
    issue.resourceType === "eventsource" &&
    issue.message === "net::ERR_ABORTED" &&
    isExactRealtimeEndpoint(issue.url, currentPageUrl) &&
    runtime.intentionalEventSourceTeardowns.has(normalizeUrl(issue.url))
  );
}

function isCompletedQualifiedViewAbort(
  issue: RuntimeIssue,
  runtime: RuntimeWatch,
  currentPageUrl: string,
) {
  return (
    issue.kind === "requestfailed" &&
    issue.resourceType === "fetch" &&
    issue.message === "net::ERR_ABORTED" &&
    isExactQualifiedViewEndpoint(issue.url, currentPageUrl) &&
    runtime.completedQualifiedViewWrites.has(normalizeUrl(issue.url))
  );
}

/**
 * A cancelled request for immutable build output on the page's own origin.
 *
 * The browser cancels in-flight chunk and prefetch requests when a navigation
 * moves on, which happens constantly in a suite that drives real interactions.
 * The abort says the page changed its mind, not that the app broke: a chunk
 * that genuinely did not exist would arrive as an HTTP 404, which stays fatal
 * below.
 *
 * Deliberately narrow. Only `/_next/static/`, only same-origin, only an abort.
 */
function isCancelledBuildAsset(issue: RuntimeIssue, currentPageUrl: string) {
  if (issue.kind !== "requestfailed") return false;
  if (issue.message !== "net::ERR_ABORTED") return false;
  if (issue.resourceType !== "script" && issue.resourceType !== "stylesheet") return false;
  try {
    const requestUrl = new URL(issue.url);
    const pageUrl = new URL(currentPageUrl);
    return (
      requestUrl.origin === pageUrl.origin &&
      requestUrl.pathname.startsWith("/_next/static/")
    );
  } catch {
    return false;
  }
}

export function runtimeFailures(
  runtime: RuntimeWatch,
  allowance: MainDocumentAllowance,
  currentPageUrl: string,
) {
  const mainUrl = allowance ? normalizeUrl(allowance.url) : null;
  const allowedConsolePattern = allowance
    ? new RegExp(
        `^Failed to load resource: the server responded with a status of ${allowance.status}(?: \\([^)]*\\))?$`,
      )
    : null;

  return runtime.issues
    .filter((issue) => {
      if (
        issue.kind === "requestfailed" &&
        issue.resourceType === "fetch" &&
        issue.message === "net::ERR_ABORTED"
      ) {
        try {
          const requestUrl = new URL(issue.url);
          const pageUrl = new URL(currentPageUrl);
          if (
            requestUrl.origin === pageUrl.origin &&
            (requestUrl.searchParams.has("_rsc") ||
              (requestUrl.pathname.startsWith("/app") && requestUrl.searchParams.has("task")))
          ) {
            return false;
          }
        } catch {
          // Malformed URLs remain fatal below.
        }
      }
      if (isCancelledBuildAsset(issue, currentPageUrl)) return false;
      if (isIntentionalEventSourceTeardown(issue, runtime, currentPageUrl)) return false;
      if (isCompletedQualifiedViewAbort(issue, runtime, currentPageUrl)) return false;
      if (!allowance || !mainUrl) return true;
      if (
        issue.kind === "http" &&
        issue.status === allowance.status &&
        issue.resourceType === "document" &&
        normalizeUrl(issue.url) === mainUrl
      ) {
        return false;
      }
      if (
        issue.kind === "console" &&
        normalizeUrl(issue.url) === mainUrl &&
        allowedConsolePattern?.test(issue.message)
      ) {
        return false;
      }
      return true;
    })
    .map((issue) => {
      if (issue.kind === "pageerror") return `pageerror: ${issue.message}`;
      if (issue.kind === "console") return `console: ${issue.message} (${issue.url})`;
      if (issue.kind === "http") {
        return `http ${issue.status}: ${issue.resourceType} ${issue.url}`;
      }
      return `requestfailed: ${issue.resourceType} ${issue.url} (${issue.message})`;
    });
}
