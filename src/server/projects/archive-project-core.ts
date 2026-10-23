import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { db } from '@/server/db';
import { workspaces } from '@/server/db/schema';
import { proveProjectCapability } from '@/server/actions/project-authz';
import { parseProjectId } from '@/lib/projects/project-ref';
import { assertProjectNotDeleting } from './project-deletion-fence';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class ProjectArchiveRefusal extends Error {
  constructor(readonly code: 'unavailable' | 'stale') { super(code); }
}

/** Canonical archive/restore effect, inside the caller's receipt transaction. No external effects. */
export async function setProjectArchivedInTransaction(tx: Transaction, input: {
  actorUserId: string; projectId: string; archived: boolean; now?: Date;
  expectedRevision?: number; expectedArchivedAt?: Date | null;
  /** Undo restores the exact previous timestamp, rather than creating a new archive date. */
  restoreArchivedAt?: Date | null;
}) {
  const id = parseProjectId(input.projectId);
  if (!id || !(await proveProjectCapability(input.actorUserId, id, 'manageProject', 'enforce', tx)).ok)
    throw new ProjectArchiveRefusal('unavailable');
  await assertProjectNotDeleting(tx, id);
  const [before] = await tx.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  if (!before) throw new ProjectArchiveRefusal('unavailable');
  if (input.expectedRevision !== undefined && before.revision !== input.expectedRevision ||
      input.expectedArchivedAt !== undefined && before.archivedAt?.getTime() !== input.expectedArchivedAt?.getTime())
    throw new ProjectArchiveRefusal('stale');
  const now = input.now ?? new Date();
  const archivedAt = input.restoreArchivedAt !== undefined ? input.restoreArchivedAt : input.archived ? now : null;
  if (input.expectedRevision !== undefined && input.restoreArchivedAt === undefined && (before.archivedAt !== null) === input.archived) return before;
  const [after] = await tx.update(workspaces).set({ archivedAt, revision: sql`${workspaces.revision} + 1`, updatedAt: now })
    .where(and(eq(workspaces.id, id), eq(workspaces.revision, before.revision),
      before.archivedAt === null ? isNull(workspaces.archivedAt) : eq(workspaces.archivedAt, before.archivedAt)))
    .returning();
  if (!after) throw new ProjectArchiveRefusal('stale');
  return after;
}
