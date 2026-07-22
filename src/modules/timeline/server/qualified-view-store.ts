import { and, eq, lte, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  audienceShares,
  audienceViewReceipts,
  timelinePublications,
} from "@/modules/timeline/server/db/timeline-schema";
import * as timelineSchema from "@/modules/timeline/server/db/timeline-schema";
import {
  hashAudienceToken,
  hashesEqual,
  isAudienceTokenShape,
  resolveShareAccessState,
} from "@/modules/timeline/lib/audience-timeline";
import {
  hashQualifiedViewSession,
  qualifiedViewReceiptExpiry,
  type QualifiedViewPayload,
} from "@/modules/timeline/lib/qualified-view";

export type QualifiedViewDatabase = LibSQLDatabase<typeof timelineSchema>;
export type QualifiedViewWriteResult =
  | "counted"
  | "duplicate"
  | "invalid"
  | "unpublished";

/**
 * Database-injected seam for focused integration tests. The public wrapper is
 * server-only; this module intentionally contains no request headers or logs.
 */
export async function recordQualifiedViewWith(
  database: QualifiedViewDatabase,
  rawToken: string,
  payload: QualifiedViewPayload,
  now = new Date(),
): Promise<QualifiedViewWriteResult> {
  if (!isAudienceTokenShape(rawToken)) return "invalid";
  if (!Number.isFinite(now.getTime())) throw new TypeError("Receipt time is invalid");

  const tokenHash = hashAudienceToken(rawToken);

  return database.transaction(async (tx) => {
    const [share] = await tx
      .select({
        publicationId: audienceShares.publicationId,
        tokenHash: audienceShares.tokenHash,
        state: audienceShares.state,
        expiresAt: audienceShares.expiresAt,
      })
      .from(audienceShares)
      .where(eq(audienceShares.tokenHash, tokenHash))
      .limit(1);
    if (!share || !hashesEqual(share.tokenHash, tokenHash)) return "invalid";
    if (resolveShareAccessState(share, now) !== "valid") return "invalid";

    const [publication] = await tx
      .select({
        id: timelinePublications.id,
        state: timelinePublications.state,
      })
      .from(timelinePublications)
      .where(eq(timelinePublications.id, share.publicationId))
      .limit(1);
    if (!publication || publication.state !== "published") return "unpublished";

    // Retention is enforced opportunistically on a valid publication. The
    // aggregate survives; only the short-lived dedupe material is removed.
    await tx
      .delete(audienceViewReceipts)
      .where(lte(audienceViewReceipts.expiresAt, now));

    const sessionHash = hashQualifiedViewSession(
      publication.id,
      payload.sessionId,
    );
    const inserted = await tx
      .insert(audienceViewReceipts)
      .values({
        publicationId: publication.id,
        sessionHash,
        createdAt: now,
        expiresAt: qualifiedViewReceiptExpiry(now),
      })
      .onConflictDoNothing({
        target: [
          audienceViewReceipts.publicationId,
          audienceViewReceipts.sessionHash,
        ],
      })
      .returning({ publicationId: audienceViewReceipts.publicationId });
    if (inserted.length === 0) return "duplicate";

    const counted = await tx
      .update(timelinePublications)
      .set({
        qualifiedViewCount: sql`${timelinePublications.qualifiedViewCount} + 1`,
        lastQualifiedViewAt: now,
      })
      .where(
        and(
          eq(timelinePublications.id, publication.id),
          eq(timelinePublications.state, "published"),
        ),
      )
      .returning({ id: timelinePublications.id });
    if (counted.length !== 1) {
      throw new Error("Qualified view aggregate could not be updated");
    }
    return "counted";
  });
}
