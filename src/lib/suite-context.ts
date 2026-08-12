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

/**
 * The V2 context vocabulary this module emits.
 *
 * Named here, beside the emitter, so the V3 canonicaliser
 * (`src/lib/projects/project-url.ts`) strips exactly what this function writes
 * and cannot drift from it. ADR 0001 §8 keeps `withSuiteContext` in place for
 * at least two stable releases: V2 links already in the wild — and in Signal's
 * inbound normalizer below — must keep resolving while V3 rolls out.
 *
 * `scripts/check-suite-switcher-contract.mjs:122-129` pins `sourceProduct` in
 * this file. That pin is correct and is left untouched: the emitter is retained
 * on purpose, and deleting a guard to make a V3 build green would remove the
 * protection at exactly the moment it starts mattering.
 */
export const SUITE_CONTEXT_V2_PARAMS = [
  "sourceProduct",
  "contextVersion",
  "planningPeriodId",
  "projectId",
] as const;

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
