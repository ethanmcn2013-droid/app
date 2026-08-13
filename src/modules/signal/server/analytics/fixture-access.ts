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
  // The Project is the only boundary. A Label narrows an already-authorized
  // read, so there is nothing here to authorize it against (D-010).
  const allowed =
    fixture.access.authorized &&
    fixture.access.allowedWorkspaceIds.includes(query.scope.workspaceId) &&
    userScopeAllowed;
  if (!allowed) throw new FixtureAccessDeniedError();
  return query.scope.type === "user"
    ? { ...query, scope: { ...query.scope, id: fixture.access.userId } }
    : query;
}
