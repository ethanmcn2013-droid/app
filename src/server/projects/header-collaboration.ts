import "server-only";
import { getWorkspaceMemberMeta } from "@/server/db/members";
import type { RouteProjectDecision } from "./route-authz";
import { headerMemberHref, headerRouteKey, headerScopeAllowed, headerSearch, type HeaderCollaborationData, type HeaderParams } from "@/lib/projects/header-collaboration-scope";

/** Internal server helper, called only after this request's route membership proof. */
export async function loadHeaderCollaboration(
  decision: Extract<RouteProjectDecision, { kind: "ready" | "archived" }>,
  pathname: "/app/files" | "/app/analytics",
  params: HeaderParams,
): Promise<HeaderCollaborationData | null> {
  const search = headerSearch(params);
  if (!headerScopeAllowed(pathname, search)) return null;
  try {
    const members = await getWorkspaceMemberMeta(decision.workspaceId);
    return {
      routeKey: headerRouteKey(pathname, search),
      projectId: decision.workspaceId,
      projectName: decision.name,
      href: headerMemberHref(pathname, search, decision.workspaceId),
      canInvite: decision.kind === "ready" && decision.project.archivedAt === null && decision.project.capabilities.manageProject,
      members: members.map(({ id, name, initials, role }) => ({ id, name, initials, role })),
    };
  } catch {
    // Roster failure must not take down the page or fabricate a membership list.
    return null;
  }
}
