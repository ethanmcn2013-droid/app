import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, workspaceMembers } from "./schema";
import { resolveUser } from "@/lib/data";
import type { WorkspaceMemberMeta } from "@/lib/members";
import { isDemoMode } from "@/lib/access-mode";
import { DEMO_USER_ID } from "@/server/demo/tasks-demo";
import { REVIEW_SUITE_FIXTURE } from "@/lib/review-suite-fixture";

/**
 * The workspace's members as render-ready identity rows, owner first, then
 * A–Z. This is the single source the client assign/avatar surfaces are
 * hydrated from; before it existed the hybrid views fell back to design-lab
 * fixture people on live data.
 *
 * `users.color` / `users.initials` win when present; `resolveUser` supplies
 * seed-persona rows and neutral fallbacks for legacy accounts so a member
 * with an unhydrated profile still renders as themselves, not as nobody.
 */
export async function getWorkspaceMemberMeta(
  workspaceId: string,
): Promise<WorkspaceMemberMeta[]> {
  if (isDemoMode()) {
    const demo = resolveUser(DEMO_USER_ID, REVIEW_SUITE_FIXTURE.user.name);
    return [
      {
        id: demo.id,
        name: demo.name,
        knownName: demo.name,
        initials: demo.initials,
        color: demo.color,
        role: "owner",
      },
    ];
  }

  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      name: users.name,
      color: users.color,
      initials: users.initials,
    })
    .from(workspaceMembers)
    .leftJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  return rows
    .map((row) => {
      const resolved = resolveUser(row.userId, row.name ?? undefined);
      return {
        id: row.userId,
        name: resolved.name,
        knownName: row.name?.trim() || null,
        initials: row.initials?.trim() || resolved.initials,
        color: row.color?.trim() || resolved.color,
        role: row.role,
      };
    })
    .sort(
      (a, b) =>
        Number(b.role === "owner") - Number(a.role === "owner") ||
        a.name.localeCompare(b.name, "en-GB"),
    );
}
