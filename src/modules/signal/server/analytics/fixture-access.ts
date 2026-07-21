import type { AnalyticsFixture } from "../../lib/analytics/fixtures";
import type { ParsedAnalyticsQuery } from "./query";

export class FixtureAccessDeniedError extends Error {
  constructor() {
    super("Fixture scope denied");
    this.name = "FixtureAccessDeniedError";
  }
}

export function authorizeFixtureQuery(
  fixture: AnalyticsFixture,
  query: ParsedAnalyticsQuery,
): ParsedAnalyticsQuery {
  const userScopeAllowed =
    query.scope.type !== "user" ||
    query.scope.id === "me" ||
    query.scope.id === fixture.access.userId;
  const allowed =
    fixture.access.authorized &&
    fixture.access.allowedWorkspaceIds.includes(query.scope.workspaceId) &&
    userScopeAllowed &&
    (query.scope.type !== "project" ||
      (fixture.access.allowedProjectIds.includes(query.scope.id) &&
        !fixture.access.deniedProjectIds.includes(query.scope.id)));
  if (!allowed) throw new FixtureAccessDeniedError();
  return query.scope.type === "user"
    ? { ...query, scope: { ...query.scope, id: fixture.access.userId } }
    : query;
}
