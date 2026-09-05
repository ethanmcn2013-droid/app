import "server-only";

import { and, eq, sql } from "drizzle-orm";
import type { CoupleAccessDb } from "./couple-access-term";
import { isVenueEditionCompNotes } from "./couple-access-term";
import { compCodes, entitlements, workspaces } from "./schema";
import { authorizeStoredProject } from "@/server/actions/project-authz";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { extendedCoupleAccessExpiryMs, normaliseWeddingDateMs } from "@/lib/venue-access-term";
import type { SponsoredWeddingDate, WeddingDateResult, WeddingDateUpdate } from "@/lib/sponsored-wedding-date";

type Reader = Pick<CoupleAccessDb, "select">;

async function sponsoredGrants(database: Reader, projectId: string) {
  const rows = await database.select({
    id: entitlements.id, userId: entitlements.userId,
    startedAt: entitlements.startedAt, expiresAt: entitlements.expiresAt,
    durationDays: compCodes.durationDays, sponsorNotes: compCodes.notes,
  }).from(entitlements).innerJoin(compCodes, eq(entitlements.notes, sql`'comp:' || ${compCodes.code}`))
    .where(and(eq(entitlements.workspaceId, projectId), eq(entitlements.source, "comp"), eq(entitlements.tier, "wedding")));
  return rows.filter(row => isVenueEditionCompNotes(row.sponsorNotes));
}

type Grants = Awaited<ReturnType<typeof sponsoredGrants>>;
function recipientAccess(rows: Grants, actorUserId: string, now: Date): SponsoredWeddingDate["access"] {
  const own = rows.filter(row => row.userId === actorUserId && row.startedAt <= now);
  // Epoch zero is the local revocation sentinel. Elapsed positive terms are
  // distinct: D-022 requires recomputation on a date change, without a cutoff.
  const live = own.filter(row => row.expiresAt === null || row.expiresAt.getTime() > 0);
  if (live.some(row => row.expiresAt === null)) return { status: "active", expiresAt: null };
  const end = Math.max(...live.map(row => row.expiresAt!.getTime()));
  if (Number.isFinite(end)) return { status: end > now.getTime() ? "active" : "expired", expiresAt: new Date(end).toISOString() };
  return { status: own.length ? "revoked" : "none", expiresAt: null };
}

/** Read only the date of the named, freshly authorized sponsored Project. */
export async function readSponsoredWeddingDate(database: Reader, input: { projectId: string; actorUserId: string }, now = new Date()): Promise<SponsoredWeddingDate | null> {
  const [project] = await database.select().from(workspaces).where(eq(workspaces.id, input.projectId)).limit(1);
  if (!project) return null;
  const grant = await authorizeStoredProject({ storedProjectId: project.id, actorUserId: input.actorUserId, capability: "open", archivePolicy: "enforce", executor: database });
  if (!grant.ok || (project.contextType !== "wedding" && project.activeDomain !== "wedding")) return null;
  const rows = await sponsoredGrants(database, project.id);
  if (!rows.length) return null;
  return {
    projectId: project.id, weddingDate: project.primaryDate, revision: project.revision,
    canManage: grant.capabilities.manageProject && !grant.archived,
    access: recipientAccess(rows, input.actorUserId, now),
  };
}

/** Canonical date and project-bound comp terms commit or roll back together. */
export async function updateSponsoredWeddingDate(database: CoupleAccessDb, input: WeddingDateUpdate & { actorUserId: string }, now = new Date()): Promise<WeddingDateResult> {
  if (typeof input.projectId !== "string" || !input.projectId || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) return { ok: false, reason: "unavailable" };
  if (input.weddingDate !== null && (typeof input.weddingDate !== "string" || normaliseWeddingDateMs(input.weddingDate) === null)) return { ok: false, reason: "invalid-date" };
  const weddingDate = input.weddingDate?.trim() ?? null;
  return database.transaction(async tx => {
    const [project] = await tx.select().from(workspaces).where(eq(workspaces.id, input.projectId)).limit(1);
    if (!project) return { ok: false, reason: "unavailable" };
    const grant = await authorizeStoredProject({ storedProjectId: project.id, actorUserId: input.actorUserId, capability: "manageProject", archivePolicy: "enforce", executor: tx });
    if (!grant.ok || grant.archived || (project.contextType !== "wedding" && project.activeDomain !== "wedding")) return { ok: false, reason: "unavailable" };
    if (await hasAccountDeletionStartedWith(tx, input.actorUserId) || (project.ownerUserId && await hasAccountDeletionStartedWith(tx, project.ownerUserId))) return { ok: false, reason: "unavailable" };
    await assertProjectNotDeleting(tx, project.id);
    const rows = await sponsoredGrants(tx, project.id);
    if (!rows.length) return { ok: false, reason: "unavailable" };
    if (project.revision !== input.expectedRevision) return { ok: false, reason: "conflict" };

    const changed = project.primaryDate !== weddingDate;
    if (changed) await tx.update(workspaces).set({ primaryDate: weddingDate, primaryDateLabel: "Wedding date", revision: project.revision + 1 }).where(eq(workspaces.id, project.id));
    const weddingDateMs = normaliseWeddingDateMs(weddingDate);
    for (const row of rows) {
      // Never convert revocation, a future grant, or departed/deleting member
      // into new access. Neither account-wide gifts nor purchases enter rows.
      const currentMs = row.expiresAt?.getTime() ?? null;
      if (weddingDateMs === null || currentMs === null || currentMs <= 0 || row.startedAt > now) continue;
      const recipient = await authorizeStoredProject({ storedProjectId: project.id, actorUserId: row.userId, capability: "open", archivePolicy: "enforce", executor: tx });
      if (!recipient.ok || await hasAccountDeletionStartedWith(tx, row.userId)) continue;
      const nextMs = extendedCoupleAccessExpiryMs({ currentExpiresAtMs: currentMs, redeemedAtMs: row.startedAt.getTime(), weddingDateMs, mintedDurationDays: row.durationDays });
      if (nextMs !== null && nextMs > currentMs) {
        await tx.update(entitlements).set({ expiresAt: new Date(nextMs) }).where(eq(entitlements.id, row.id));
        row.expiresAt = new Date(nextMs);
      }
    }
    return { ok: true, data: { projectId: project.id, weddingDate, revision: project.revision + Number(changed), canManage: true, access: recipientAccess(rows, input.actorUserId, now) } };
  }, { behavior: "immediate" });
}
