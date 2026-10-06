import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import type { db } from "@/server/db";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import type { WorkspaceContext } from "@/lib/planning/context";

type ProjectWriteTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The one shape a newly created, owned Project is written in: the Project row
 * and its owner membership, together, inside the caller's transaction.
 *
 * `createProject` (the sidebar and Your Work path) and the operator sample
 * data seeder both write through here, so a Project made either way carries
 * the same columns and the same owner membership. Authorization is the
 * caller's: no Project exists yet, so no Project capability can apply.
 */
export async function insertOwnedProjectInTransaction(
  tx: ProjectWriteTransaction,
  input: Readonly<{
    id: string;
    slug: string;
    name: string;
    ownerUserId: string;
    planningPeriodId: string | null;
    contextType: WorkspaceContext;
    position: number;
    activeDomain: string;
    primaryUseCase: string;
    now: Date;
    description?: string | null;
    primaryDate?: string | null;
    primaryDateLabel?: string | null;
    currency?: string | null;
    budgetCents?: number | null;
  }>,
): Promise<{ id: string }> {
  const created = await tx
    .insert(workspaces)
    .values({
      id: input.id,
      slug: input.slug,
      name: input.name,
      ownerUserId: input.ownerUserId,
      planningPeriodId: input.planningPeriodId,
      contextType: input.contextType,
      position: input.position,
      activeDomain: input.activeDomain,
      primaryUseCase: input.primaryUseCase,
      onboardingCompletedAt: input.now,
      updatedAt: input.now,
      ...(input.description == null ? {} : { description: input.description }),
      ...(input.primaryDate == null ? {} : { primaryDate: input.primaryDate }),
      ...(input.primaryDateLabel == null ? {} : { primaryDateLabel: input.primaryDateLabel }),
      ...(input.currency == null ? {} : { currency: input.currency }),
      ...(input.budgetCents == null ? {} : { budgetCents: input.budgetCents }),
    })
    .returning({ id: workspaces.id });
  if (!created[0]) throw new Error("Workspace not found.");
  await tx.insert(workspaceMembers).values({
    workspaceId: input.id,
    userId: input.ownerUserId,
    role: "owner",
  });
  return { id: created[0].id };
}

/**
 * The position that orders a new Project after the actor's existing siblings
 * in the same group (a specific period, or the periodless bucket).
 */
export async function nextOwnedProjectPositionInTransaction(
  tx: ProjectWriteTransaction,
  input: Readonly<{ actorUserId: string; planningPeriodId: string | null }>,
): Promise<number> {
  const [last] = await tx
    .select({ position: workspaces.position })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, input.actorUserId),
        input.planningPeriodId
          ? eq(workspaces.planningPeriodId, input.planningPeriodId)
          : sql`${workspaces.planningPeriodId} IS NULL`,
      ),
    )
    .orderBy(desc(workspaces.position))
    .limit(1);
  return (last?.position ?? 0) + 1000;
}
