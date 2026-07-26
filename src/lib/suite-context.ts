export type SuiteContextV2 = Readonly<{
  version: 2;
  planningPeriodId?: string;
  projectId?: string;
  workspaceId: string;
}>;

const CONTEXT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function isSuiteContextId(value: unknown): value is string {
  return typeof value === "string" && CONTEXT_ID.test(value);
}

/** Context IDs are navigation hints. Consumers must still authorize them. */
export function withSuiteContext(
  appUrl: string,
  context: SuiteContextV2 | null,
): string {
  if (!context) return appUrl;
  const isAppPath = appUrl.startsWith("/");
  const url = isAppPath
    ? new URL(appUrl, "https://app.signalstudio.ie")
    : new URL(appUrl);
  url.searchParams.set("sourceProduct", "tasks");
  url.searchParams.set("contextVersion", "2");
  url.searchParams.set("workspaceId", context.workspaceId);
  if (context.planningPeriodId) {
    url.searchParams.set("planningPeriodId", context.planningPeriodId);
  }
  if (context.projectId) {
    url.searchParams.set("projectId", context.projectId);
  }
  return isAppPath ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}

// ── Signal module additions (Phase 6 port) ──────────────────────────────────

const MAX_IDENTIFIER_LENGTH = 200;

function boundedIdentifier(value: string | null): string | undefined {
  if (value && /[\u0000-\u001f\u007f]/.test(value)) return undefined;
  const normalized = value?.trim();
  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH) return undefined;
  return normalized;
}

const SUITE_PRODUCT_IDS = new Set([
  "studio",
  "tasks",
  "timeline",
  "signal",
  "notes",
]);

/**
 * Translate an inbound version-one SuiteContext into Signal's native scope
 * keys. Native keys win when both forms are present; authorization remains a
 * server responsibility after parsing.
 *
 * Ported from signal/src/lib/suite-context.ts for Phase 6 host compatibility.
 */
export function normalizeSuiteContextForSignal(
  input: URLSearchParams,
): URLSearchParams {
  const normalized = new URLSearchParams(input);
  const sourceProduct = input.get("sourceProduct");
  if (!sourceProduct || !SUITE_PRODUCT_IDS.has(sourceProduct)) return normalized;

  const workspaceId = boundedIdentifier(input.get("workspaceId"));
  if (!normalized.has("workspace_id") && workspaceId) {
    normalized.set("workspace_id", workspaceId);
  }

  const projectId = boundedIdentifier(input.get("projectId"));
  if (projectId && !normalized.has("scope_id")) {
    normalized.set("scope_id", projectId);
    if (!normalized.has("scope_type")) normalized.set("scope_type", "project");
  }

  return normalized;
}
