import "server-only";

import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { applyTemplateInTransaction } from "./apply-template";
import { TEMPLATES } from "@/lib/templates";
import type { db } from "./index";
import { compCodes, entitlements, workspaces } from "./schema";
import { authorizeStoredProject } from "@/server/actions/project-authz";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { compRedemptionExpiresAtMs, weddingDateMsForWorkspace } from "./couple-access-term";

type Database = typeof db;
type Failure = { ok: false; reason: "not-found" | "exhausted" | "expired" | "already-redeemed" | "still-provisioning" };
export type CompClaim = Failure | {
  ok: true;
  entitlement: typeof entitlements.$inferSelect;
  codeNotes: string | null;
  sponsorSlug?: string;
  templateRequestId: string;
};

function sponsorSlug(notes: string | null): string | undefined {
  if (!notes) return undefined;
  try {
    const value = JSON.parse(notes) as Record<string, unknown>;
    return value.source_type === "venue_edition" && typeof value.sponsor_slug === "string" && value.sponsor_slug &&
      typeof value.sponsor_name === "string" && value.sponsor_name ? value.sponsor_slug : undefined;
  } catch { return undefined; }
}

/** Claim capacity and the entitlement in one writer transaction. A retry uses
 * the existing grant's stored project, never today's ambient project. */
export async function claimCompEntitlement(database: Database, input: {
  code: string; actorUserId: string; candidateProjectId: string | null; now?: Date;
}): Promise<CompClaim> {
  return withClaimRetry(() => database.transaction(async (tx): Promise<CompClaim> => {
    const now = input.now ?? new Date();
    const [code] = await tx.select().from(compCodes).where(eq(compCodes.code, input.code));
    if (!code) return { ok: false, reason: "not-found" };
    const existing = await tx.select().from(entitlements).where(and(
      eq(entitlements.userId, input.actorUserId), eq(entitlements.source, "comp"),
      eq(entitlements.notes, `comp:${input.code}`),
    ));
    if (existing.length > 1) return { ok: false, reason: "already-redeemed" };
    const prior = existing[0];
    if (prior?.expiresAt && prior.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
    if (!prior && code.expiresAt && code.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
    const projectId = prior ? prior.workspaceId : input.candidateProjectId;
    if (!projectId) return { ok: false, reason: "still-provisioning" };
    const grant = await authorizeStoredProject({
      storedProjectId: projectId, actorUserId: input.actorUserId, capability: "createOrEditTasks",
      archivePolicy: "enforce", executor: tx,
    });
    if (!grant.ok || await hasAccountDeletionStartedWith(tx, input.actorUserId)) return { ok: false, reason: "still-provisioning" };
    await assertProjectNotDeleting(tx, grant.projectId);
    const slug = (prior?.tier ?? code.tier) === "wedding" ? sponsorSlug(code.notes) : undefined;
    const requestId = `comp-template-${createHash("sha256").update(JSON.stringify([input.actorUserId, input.code, grant.projectId])).digest("hex")}`;
    if (prior) return { ok: true, entitlement: prior, codeNotes: code.notes, sponsorSlug: slug, templateRequestId: requestId };
    if (code.redeemed >= code.quantity) return { ok: false, reason: "exhausted" };
    const expiresAt = new Date(compRedemptionExpiresAtMs({
      redeemedAtMs: now.getTime(), durationDays: code.durationDays, venueEdition: Boolean(slug),
      weddingDateMs: slug ? await weddingDateMsForWorkspace(tx, grant.projectId) : null,
    }));
    const claimed = await tx.update(compCodes).set({ redeemed: sql`${compCodes.redeemed} + 1` })
      .where(and(eq(compCodes.code, input.code), sql`${compCodes.redeemed} < ${compCodes.quantity}`)).returning({ code: compCodes.code });
    if (claimed.length !== 1) return { ok: false, reason: "exhausted" };
    const [entitlement] = await tx.insert(entitlements).values({
      id: `e-${createHash("sha256").update(JSON.stringify(["comp-claim-v1", input.actorUserId, input.code])).digest("hex").slice(0, 32)}`,
      workspaceId: grant.projectId, userId: input.actorUserId, tier: code.tier, source: "comp",
      startedAt: now, expiresAt, notes: `comp:${input.code}`,
    }).returning();
    if (slug && TEMPLATES.some(template => template.id === "wedding-planning-workspace")) {
      await applyTemplateInTransaction(tx, "wedding-planning-workspace", grant.projectId, input.actorUserId, { requestId });
      await tx.update(workspaces).set({ templateId: "wedding-planning-workspace", activeDomain: "wedding" })
        .where(eq(workspaces.id, grant.projectId));
    }
    return { ok: true, entitlement, codeNotes: code.notes, sponsorSlug: slug, templateRequestId: requestId };
  }, { behavior: "immediate" }));
}

/** Only lock contention is retried automatically, using a fresh transaction.
 * Unknown commit/network outcomes surface; repeating the code reconciles them. */
async function withClaimRetry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error) {
      const cause = error as { code?: string; cause?: { code?: string } };
      if (attempt >= 5 || (cause.code !== "SQLITE_BUSY" && cause.cause?.code !== "SQLITE_BUSY")) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}
