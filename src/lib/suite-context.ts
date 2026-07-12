export type SuiteContextV2 = Readonly<{
  version: 2;
  planningPeriodId: string;
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
  const url = new URL(appUrl);
  url.searchParams.set("contextVersion", "2");
  url.searchParams.set("planningPeriodId", context.planningPeriodId);
  url.searchParams.set("workspaceId", context.workspaceId);
  return url.toString();
}
