import "server-only";
import { and, eq } from "drizzle-orm";
import type { db } from "./db/timeline-client";
import { audienceShares, timelinePublicationItems, timelinePublications } from "./db/timeline-schema";

type Writer = Pick<typeof db, "select" | "update">;

async function requirePublication(executor: Writer, publicationId: string, workspaceSlug: string) {
  const [row] = await executor.select({ id: timelinePublications.id }).from(timelinePublications)
    .where(and(eq(timelinePublications.id, publicationId), eq(timelinePublications.workspaceSlug, workspaceSlug))).limit(1);
  if (!row) throw new TypeError("Publication not found");
}

/** Negative-only persistence shared by the established owner actions and the
 * recovery controller. Actor authorization belongs to the caller; recovery
 * re-proves local ownership in this same writer snapshot. */
export async function revokeAudienceSharesInTransaction(executor: Writer, publicationId: string, workspaceSlug: string, now = new Date()): Promise<void> {
  await requirePublication(executor, publicationId, workspaceSlug);
  await executor.update(audienceShares).set({ state: "revoked", revokedAt: now })
    .where(and(eq(audienceShares.publicationId, publicationId), eq(audienceShares.state, "active")));
}

export async function unpublishAudiencePublicationInTransaction(executor: Writer, publicationId: string, workspaceSlug: string): Promise<void> {
  await requirePublication(executor, publicationId, workspaceSlug);
  const now = new Date();
  await executor.update(timelinePublications)
    .set({ state: "unpublished", unpublishedAt: now, updatedAt: now, lastUpdatedAt: now })
    .where(and(eq(timelinePublications.id, publicationId), eq(timelinePublications.workspaceSlug, workspaceSlug)));
  await executor.update(timelinePublicationItems).set({ unpublishedAt: now })
    .where(eq(timelinePublicationItems.publicationId, publicationId));
  await revokeAudienceSharesInTransaction(executor, publicationId, workspaceSlug, now);
}
