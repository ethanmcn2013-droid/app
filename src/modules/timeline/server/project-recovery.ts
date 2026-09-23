import "server-only";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { db } from "./db/timeline-client";
import { timelinePublications, workspaces } from "./db/timeline-schema";
import { revokeAudienceSharesInTransaction, unpublishAudiencePublicationInTransaction } from "./audience-revocation";
import { parseProjectId } from "@/lib/projects/project-ref";
import { RECOVERY_PAGE_SIZE, type TimelineRecovery } from "@/lib/projects/recovery";
import { withRecoveryTransaction } from "@/lib/projects/recovery-lock-retry";

type Database = typeof db;
const publicationRow = sql<number>`timeline_publications.rowid`;

/** Exact stored publication source, not a guessed current Tasks membership or
 * primary Timeline. Includes older/orphaned publications the local owner can
 * already revoke, without reading their frozen content or token hashes. */
export async function readTimelineRecoveryWith(database: Database, clerkId: string, projectId: string, before?: number): Promise<TimelineRecovery> {
  if (!clerkId || !parseProjectId(projectId)) return { kind: "unavailable" };
  return withRecoveryTransaction(database, () => database.transaction(async tx => {
    const scope = and(eq(timelinePublications.sourceWorkspaceId, projectId), eq(workspaces.ownerUserId, clerkId));
    const [authority] = await tx.select({ id: timelinePublications.id }).from(timelinePublications)
      .innerJoin(workspaces, eq(workspaces.slug, timelinePublications.workspaceSlug)).where(scope).limit(1);
    if (!authority) return { kind: "unavailable" } as const;
    const rows = await tx.select({ row: publicationRow, id: timelinePublications.id, createdAt: timelinePublications.createdAt, state: timelinePublications.state })
      .from(timelinePublications).innerJoin(workspaces, eq(workspaces.slug, timelinePublications.workspaceSlug))
      .where(and(scope, before ? lt(publicationRow, before) : undefined)).orderBy(desc(publicationRow)).limit(RECOVERY_PAGE_SIZE + 1);
    const visible = rows.slice(0, RECOVERY_PAGE_SIZE);
    return { kind: "ready", publications: { items: visible.map(row => ({ id: row.id, createdAt: row.createdAt.toISOString(), state: row.state })),
      next: rows.length > RECOVERY_PAGE_SIZE ? visible.at(-1)!.row : null } };
  }, { behavior: "deferred" }));
}

/** Fresh LOCAL Timeline ownership plus exact publication source in one immediate
 * transaction. Tasks membership/commercial verification is intentionally not a
 * prerequisite for the existing negative-only owner operation. */
export async function withdrawTimelinePublicationWith(database: Database, clerkId: string, projectId: string, publicationId: string, operation: "revoke" | "unpublish"): Promise<boolean> {
  if (!clerkId || !parseProjectId(projectId) || !/^[A-Za-z0-9_-]{1,80}$/.test(publicationId) || !["revoke", "unpublish"].includes(operation)) return false;
  return withRecoveryTransaction(database, () => database.transaction(async tx => {
    const [publication] = await tx.select({ workspaceSlug: timelinePublications.workspaceSlug }).from(timelinePublications)
      .innerJoin(workspaces, eq(workspaces.slug, timelinePublications.workspaceSlug))
      .where(and(eq(timelinePublications.id, publicationId), eq(timelinePublications.sourceWorkspaceId, projectId), eq(workspaces.ownerUserId, clerkId))).limit(1);
    if (!publication) return false;
    if (operation === "revoke") await revokeAudienceSharesInTransaction(tx, publicationId, publication.workspaceSlug);
    else await unpublishAudiencePublicationInTransaction(tx, publicationId, publication.workspaceSlug);
    return true;
  }, { behavior: "immediate" }));
}

/** The only host bridge: no content loader, positive writer or identity lookup. */
export async function readTimelineRecovery(clerkId: string, projectId: string, before?: number) {
  const { db: database } = await import("./db/timeline-client");
  return readTimelineRecoveryWith(database, clerkId, projectId, before);
}
export async function withdrawTimelinePublication(clerkId: string, projectId: string, publicationId: string, operation: "revoke" | "unpublish") {
  const { db: database } = await import("./db/timeline-client");
  return withdrawTimelinePublicationWith(database, clerkId, projectId, publicationId, operation);
}
