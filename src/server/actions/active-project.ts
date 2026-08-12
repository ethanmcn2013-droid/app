"use server";

/**
 * The one guarded Project transition — plan §3.5.
 *
 * This is the only place in the app that may write the last-active Project
 * cookie. Following a contextual link does not; resolving a route does not;
 * rendering a page does not. Only an explicit selection.
 *
 * The eight required behaviours from plan §3.5, and where each lives:
 *
 *  1. one selection at a time — the synchronous client guard in
 *     `active-project-provider.tsx`; this action is idempotent regardless;
 *  2. `Opening <B>…` on the trigger while A stays visibly A — provider;
 *  3. reauthenticate, then validate B's current membership and archive state
 *     — here, before anything is written;
 *  4. cookie written only after validation — here;
 *  5. destination built from an enum, never an arbitrary return URL — here,
 *     via `parseProjectDestination`. An action that accepted a caller-supplied
 *     path would be an open redirect reachable by direct POST;
 *  6. redirect with `push`, outside `try`/`catch`, so Back returns to A —
 *     here. `redirect` throws a framework control-flow exception; inside a
 *     `catch` it would be swallowed and reported as a failure;
 *  7. the target page independently reauthorizes explicit B — the resolver;
 *  8. failure before the redirect commits no B URL and no cookie — here, by
 *     ordering.
 *
 * Server Functions are reachable by direct POST, not only through the UI, so
 * every check above runs unconditionally on the server (Next.js "Mutating
 * Data" guide, security note).
 */

import { and, eq, sql } from "drizzle-orm";
import { redirect, RedirectType } from "next/navigation";
import { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { getCurrentUser } from "@/server/auth";
import { isActiveProjectV3Enabled } from "@/lib/projects/flags";
import { parseProjectId } from "@/lib/projects/project-ref";
import {
  buildProjectUrl,
  parseProjectDestination,
} from "@/lib/projects/project-url";
import { writeActiveProjectCookie } from "@/server/projects/active-project-cookie";

/**
 * Failure codes. Coarse on purpose: `unavailable` covers "no such Project",
 * "not a member" and "deleted" together, so a probe cannot use this action to
 * learn which Projects exist. `archived` is only ever returned after
 * membership has been proved, so it discloses nothing the caller's own catalog
 * did not already show them.
 */
export type SwitchActiveProjectFailure = Readonly<{
  ok: false;
  reason:
    | "disabled"
    | "invalid-project"
    | "invalid-destination"
    | "unavailable"
    | "archived";
}>;

export type SwitchActiveProjectInput = Readonly<{
  workspaceId: string;
  destination: unknown;
}>;

export async function switchActiveProjectAction(
  input: SwitchActiveProjectInput,
): Promise<SwitchActiveProjectFailure> {
  // Flag off: no cookie write, no redirect, no behaviour. The action exists in
  // the bundle and does nothing, which is what "inert" has to mean for a
  // Server Function that is reachable by direct POST.
  if (!isActiveProjectV3Enabled()) return { ok: false, reason: "disabled" };

  const destination = parseProjectDestination(input?.destination);
  if (!destination) return { ok: false, reason: "invalid-destination" };

  const projectId = parseProjectId(input?.workspaceId);
  if (!projectId) return { ok: false, reason: "invalid-project" };

  let target: string | null = null;

  try {
    // 3. Reauthenticate. Never trust an identity carried in the payload.
    const actorUserId = await getCurrentUser();

    // 3. Fresh membership and archive state, membership-first so that "no such
    //    Project" and "not a member" are the same empty result.
    const [row] = await db
      .select({
        id: workspaces.id,
        archivedAt: sql<number | null>`${workspaces.archivedAt}`,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.userId, actorUserId),
          eq(workspaceMembers.workspaceId, projectId),
        ),
      )
      .limit(1);

    if (!row) return { ok: false, reason: "unavailable" };

    // ADR 0001 §5: an archived Project is opened through a URL-only read-only
    // flow. The switch rejects it and never writes it to the cookie.
    if (row.archivedAt !== null) return { ok: false, reason: "archived" };

    // 4. Cookie only after validation.
    await writeActiveProjectCookie(projectId);

    // 5. Destination from the enum.
    target = buildProjectUrl(destination, projectId);
  } catch {
    // 8. Nothing committed. A remains active and the caller shows
    //    "Couldn't open <B>. You're still in <A>."
    return { ok: false, reason: "unavailable" };
  }

  // 6. Outside the try. `push` so Back returns to A.
  redirect(target, RedirectType.push);
}
