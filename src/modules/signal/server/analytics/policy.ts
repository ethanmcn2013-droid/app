import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { isEmailAllowed } from "@/lib/access-allowlist";
import { getAccessMode, type AccessMode } from "@/lib/access-mode";
import { getAnalyticsFixture } from "../../lib/analytics/fixtures";
import { signalAnalyticsDb as signalDb } from "../db/signal-analytics-client";
import { analyticsUsers } from "../db/signal-analytics-schema";
import { getTasksClient, getTasksDb } from "../tasks-db/signal-tasks-db-client";
import {
  users,
  workspaceMembers,
  workspaces,
} from "../tasks-db/signal-tasks-db-schema";
import { AnalyticsApiError } from "./errors";
import { isSignalAnalyticsEnabled } from "./feature-flag";
import type { ParsedAnalyticsQuery } from "./query";
import { projectIdFromTag } from "./providers/tasks";
import { normalizeAnalyticsQueryTimezone } from "./timezone";
import { authorizeFixtureQuery, FixtureAccessDeniedError } from "./fixture-access";

export interface AnalyticsPrincipal {
  clerkId: string;
  mode: AccessMode;
  dataAccess: "live" | "fixtures";
}

export interface AuthorizedAnalyticsContext {
  principal: AnalyticsPrincipal;
  query: ParsedAnalyticsQuery;
  membership: {
    workspaceId: string;
    workspaceName: string;
    role: "owner" | "member";
    tasksUserId: string;
  } | null;
}

/** Authenticate, enforce the closed beta, then revalidate tenant access live. */
export async function authorizeAnalyticsRequest(
  query: ParsedAnalyticsQuery,
): Promise<AuthorizedAnalyticsContext> {
  if (!isSignalAnalyticsEnabled()) {
    throw new AnalyticsApiError(404, "analytics_disabled", "Signal analytics is not enabled.");
  }

  const mode = getAccessMode();
  if (mode === "demo" || mode === "review" || (mode === "development" && query.fixtureScenario)) {
    const fixture = getAnalyticsFixture(query.fixtureScenario ?? "signature");
    let authorizedFixtureQuery: ParsedAnalyticsQuery;
    try {
      authorizedFixtureQuery = authorizeFixtureQuery(fixture, query);
    } catch (error) {
      if (!(error instanceof FixtureAccessDeniedError)) throw error;
      throw new AnalyticsApiError(403, "forbidden", "You do not have access to this analytics fixture scope.");
    }
    return {
      principal: { clerkId: `signal-${mode}`, mode, dataAccess: "fixtures" },
      query: authorizedFixtureQuery,
      membership: null,
    };
  }

  const { userId } = await auth();
  if (!userId) {
    throw new AnalyticsApiError(401, "unauthorized", "Sign in to use Signal analytics.");
  }

  if (mode === "production") {
    const user = await currentUser();
    const email = user
      ? (user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null)
      : null;
    if (!isEmailAllowed(email)) {
      throw new AnalyticsApiError(403, "beta_access_required", "Signal analytics is currently in closed beta.");
    }
  }

  const principal: AnalyticsPrincipal = { clerkId: userId, mode, dataAccess: "live" };
  const settings = await readAnalyticsUserSettings(userId);
  const canonicalTimezone = validTimezone(settings.timezone) ? settings.timezone! : "UTC";
  const timezoneQuery = normalizeAnalyticsQueryTimezone(query, canonicalTimezone);
  const membership = await revalidateWorkspaceMembership(userId, timezoneQuery.scope.workspaceId);
  if (!membership) {
    throw new AnalyticsApiError(403, "forbidden", "You do not have access to this workspace.");
  }
  let authorizedQuery = timezoneQuery;
  if (timezoneQuery.scope.type === "user") {
    if (![userId, membership.tasksUserId, "me"].includes(timezoneQuery.scope.id)) {
      throw new AnalyticsApiError(403, "forbidden", "User scope is limited to the signed-in account.");
    }
    // Canonical Task owner ids are Tasks users, not Clerk subjects. Normalize
    // only after live membership succeeds so the domain filter cannot confuse
    // the two identity spaces.
    authorizedQuery = {
      ...timezoneQuery,
      scope: { ...timezoneQuery.scope, id: membership.tasksUserId },
    };
  }
  if (timezoneQuery.scope.type === "project") {
    const projectExists = await workspaceHasProject(timezoneQuery.scope.workspaceId, timezoneQuery.scope.id);
    if (!projectExists) {
      throw new AnalyticsApiError(404, "scope_not_found", "This project is not available in the selected workspace.");
    }
  }

  return { principal, query: authorizedQuery, membership };
}

/** Used by the server-rendered /app shell before an explicit API scope exists. */
export async function resolveLinkedAnalyticsWorkspace(clerkId: string): Promise<string | null> {
  const settings = await readAnalyticsUserSettings(clerkId);
  if (!settings.linkedWorkspaceId) return null;
  const membership = await revalidateWorkspaceMembership(clerkId, settings.linkedWorkspaceId);
  return membership ? settings.linkedWorkspaceId : null;
}

async function readAnalyticsUserSettings(
  clerkId: string,
): Promise<{ linkedWorkspaceId: string | null; timezone: string | null }> {
  try {
    const [row] = await signalDb
      .select({
        linkedWorkspaceId: analyticsUsers.linkedWorkspaceId,
        timezone: analyticsUsers.timezone,
      })
      .from(analyticsUsers)
      .where(eq(analyticsUsers.clerkId, clerkId))
      .limit(1);
    return row ?? { linkedWorkspaceId: null, timezone: null };
  } catch (error) {
    console.warn("[signal-analytics] user settings unavailable; using UTC", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { linkedWorkspaceId: null, timezone: null };
  }
}

function validTimezone(value: string | null): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export async function revalidateWorkspaceMembership(
  clerkId: string,
  workspaceId: string,
): Promise<AuthorizedAnalyticsContext["membership"]> {
  const db = getTasksDb();
  if (!db) {
    throw new AnalyticsApiError(503, "provider_unavailable", "Tasks is not connected to Signal.");
  }

  const [identity] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  if (!identity) return null;

  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!workspace) return null;
  if (workspace.ownerUserId === identity.id) {
    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      role: "owner",
      tasksUserId: identity.id,
    };
  }

  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, identity.id),
      ),
    )
    .limit(1);
  if (!membership) return null;
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    role: membership.role === "owner" ? "owner" : "member",
    tasksUserId: identity.id,
  };
}

async function workspaceHasProject(workspaceId: string, projectId: string): Promise<boolean> {
  const client = getTasksClient();
  if (!client) return false;
  // Projects are canonical Tasks tags. Ask SQLite for distinct tag values so
  // validity does not depend on which 2,000 task rows happen to be returned.
  // The 2,000 distinct-project cap bounds the response, not the task scan.
  const result = await client.execute({
    sql: `SELECT DISTINCT json_each.value AS tag
          FROM tasks, json_each(tasks.tags)
          WHERE tasks.workspace_id = ? AND json_each.type = 'text'
          LIMIT 2000`,
    args: [workspaceId],
  });
  return result.rows.some((row) =>
    typeof row.tag === "string" && projectIdFromTag(row.tag) === projectId,
  );
}
