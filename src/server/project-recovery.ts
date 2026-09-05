import "server-only";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { deleteProject } from "@/server/projects/service";
import { readTasksRecoveryWith, revokeRecoveryShareWith, unpublishProjectWith } from "@/server/projects/recovery";
import { readTimelineRecovery, withdrawTimelinePublication } from "@/modules/timeline/server/project-recovery";
import { readProjectRecoveryWith, runProjectRecoveryWith, type RecoveryDependencies } from "./project-recovery-core";
import type { RecoveryCursor } from "@/lib/projects/recovery";

/** Narrow product-recovery composition. The principal-owned module gate needs
 * an exact import allowance for this file and the Timeline recovery surface.
 * Authentication is supplied only by the server page/action, never by a form. */
async function localActor(clerkId: string): Promise<string | null> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return user?.id ?? null; // no provisioning or keyless-dev identity fallback
}

const dependencies: RecoveryDependencies = {
  async readTasks(clerkId, projectId, cursor) {
    const actor = await localActor(clerkId);
    return actor ? readTasksRecoveryWith(db, actor, projectId, cursor) : { kind: "unavailable" };
  },
  readTimeline: readTimelineRecovery,
  async revokeLink(clerkId, projectId, reference) {
    const actor = await localActor(clerkId);
    const revoked = actor ? await revokeRecoveryShareWith(db, actor, projectId, reference) : false;
    if (revoked) revalidatePath("/share/[token]", "page");
    return revoked;
  },
  async unpublishBoard(clerkId, projectId) {
    const actor = await localActor(clerkId);
    const result = actor ? await unpublishProjectWith(db, actor, projectId) : null;
    if (result) revalidatePath(`/p/${result.slug}`);
    return result !== null;
  },
  async deleteProject(clerkId, projectId) {
    const actor = await localActor(clerkId);
    if (!actor) throw new Error("Project unavailable");
    // Reuses the primary-owner service, including existing deletion intent and
    // provider-receipt retry semantics. No Drive lifecycle implementation here.
    await deleteProject({ actorUserId: actor, projectId });
  },
  async withdrawTimeline(clerkId, projectId, publicationId, operation) {
    const changed = await withdrawTimelinePublication(clerkId, projectId, publicationId, operation);
    if (changed) {
      revalidatePath("/app/timeline/audience");
      revalidatePath("/s/[token]", "page");
    }
    return changed;
  },
};

export function readProjectRecovery(clerkId: string, projectId: unknown, cursor: RecoveryCursor) {
  return readProjectRecoveryWith(dependencies, clerkId, projectId, cursor);
}
export function runProjectRecovery(clerkId: string, form: FormData) {
  return runProjectRecoveryWith(dependencies, clerkId, form);
}
