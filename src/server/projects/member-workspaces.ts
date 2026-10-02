import "server-only";

import { eq } from "drizzle-orm";
import type { UserId } from "@/lib/data";
import { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { DEMO_WORKSPACE_ID } from "@/server/demo/tasks-demo";

export type MemberWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export function demoMemberWorkspaces(): MemberWorkspace[] {
  return [{ id: DEMO_WORKSPACE_ID, name: "The Orchard, events", slug: "the-orchard", role: "owner" }];
}

/** Trusted render-internal reader. The caller must resolve its own actor first. */
export async function listMyWorkspacesForUser(actorUserId: UserId, database: typeof db = db): Promise<MemberWorkspace[]> {
  return database
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, actorUserId));
}
