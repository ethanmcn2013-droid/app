import "server-only";
import { eq, sql } from "drizzle-orm";
import type { db } from "@/server/db";
import { meta, workspaces } from "@/server/db/schema";
import { proveProjectCapability } from "@/server/actions/project-authz";
import { parseProjectId } from "@/lib/projects/project-ref";
import { parseProjectColorIndex, projectColorMetaKey } from "@/lib/projects/project-appearance";
import { assertProjectNotDeleting } from "./project-deletion-fence";

type Database = Pick<typeof db, "transaction">;
/** Re-prove role/archive state and deletion intent inside the one write transaction. */
export async function setProjectColorWith(database: Database, actorUserId: string, projectId: string, color: unknown) {
  const id = parseProjectId(projectId);
  const index = parseProjectColorIndex(color);
  if (!id || index === null) throw new Error("Choose a project colour from the palette.");
  await database.transaction(async tx => {
    if (!(await proveProjectCapability(actorUserId, id, "manageProject", "enforce", tx)).ok) throw new Error("That project isn’t available to change.");
    await assertProjectNotDeleting(tx, id);
    const [project] = await tx.select({ archivedAt: workspaces.archivedAt }).from(workspaces).where(eq(workspaces.id, id)).limit(1);
    if (!project || project.archivedAt !== null) throw new Error("Restore this project before changing its colour.");
    await tx.insert(meta).values({ key: projectColorMetaKey(id), value: String(index), updatedAt: new Date() }).onConflictDoUpdate({ target: meta.key, set: { value: String(index), updatedAt: new Date() } });
    await tx.update(workspaces).set({ revision: sql`${workspaces.revision} + 1`, updatedAt: new Date() }).where(eq(workspaces.id, id));
  }, { behavior: "immediate" });
  return { ok: true as const, colorIndex: index };
}
