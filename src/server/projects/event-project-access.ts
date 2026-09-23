import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { entitlementsDb } from "@/lib/entitlements-shared/client";
import { entitlements as sharedEntitlements } from "@/lib/entitlements-shared/schema";
import { isPurchaseMirror, sharedGrantScope } from "@/lib/entitlements-shared/reads";
import { TIER_RANK } from "@/lib/entitlements-shared/tiers";
import { entitlements, eventPurchaseDesignations, users, workspaceMembers, workspaces } from "@/server/db/schema";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { assertProjectNotDeleting, ProjectDeletionInProgressError } from "./project-deletion-fence";
import { parseProjectId } from "@/lib/projects/project-ref";
import type { EventDatabase } from "@/server/db/event-designation";

export type EventProjectAccess =
  | Readonly<{ kind: "editable"; basis: "current_cover" }>
  | Readonly<{ kind: "read_only"; basis: "completed_designated_event" }>
  | Readonly<{ kind: "unavailable"; reason: "not_authorized" | "refunded" }>
  | Readonly<{ kind: "unknown"; reason: "no_designation" | "checkout_pending" | "paid_undesignated" }>
  | Readonly<{ kind: "verification_unavailable" }>;

const notAuthorized = { kind: "unavailable", reason: "not_authorized" } as const;
type LocalGrant = typeof entitlements.$inferSelect;
type SharedGrant = typeof sharedEntitlements.$inferSelect;
type Term = typeof eventPurchaseDesignations.$inferSelect;

function paidTier(tier: string) {
  return Object.hasOwn(TIER_RANK, tier) && TIER_RANK[tier as keyof typeof TIER_RANK] > 0;
}

function exactLocal(term: Term, row: LocalGrant) {
  return row.userId === term.purchaserUserId && row.workspaceId === term.workspaceId &&
    row.tier === "event" && row.source === "purchase";
}

/**
 * Internal Event commercial decision, NOT final action/read authorization.
 * Membership is re-proved, but existing roles and manual archivedAt policy must
 * still be applied by future adapters. No production adapter consumes this yet.
 * Personal feature readers and all undesignated history retain their treatment.
 */
export async function readEventProjectAccessWith(
  database: EventDatabase,
  sharedDatabase: ReturnType<typeof entitlementsDb>,
  input: { actorUserId: string; workspaceId: string; now?: Date },
): Promise<EventProjectAccess> {
  if (typeof input.actorUserId !== "string" || !input.actorUserId ||
      input.actorUserId.trim() !== input.actorUserId || !parseProjectId(input.workspaceId)) return notAuthorized;
  const now = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(now)) return { kind: "verification_unavailable" };
  try {
    return await database.transaction(async transaction => {
      const [actor] = await transaction.select({ clerkId: users.clerkId }).from(users)
        .where(eq(users.id, input.actorUserId)).limit(1);
      if (!actor?.clerkId || await hasAccountDeletionStartedWith(transaction, actor.clerkId)) return notAuthorized;
      const [project] = await transaction.select({ ownerUserId: workspaces.ownerUserId })
        .from(workspaces).innerJoin(workspaceMembers, and(
          eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, input.actorUserId),
        )).where(eq(workspaces.id, input.workspaceId)).limit(1);
      if (!project) return notAuthorized;
      try { await assertProjectNotDeleting(transaction, input.workspaceId); }
      catch (error) {
        if (error instanceof ProjectDeletionInProgressError) return notAuthorized;
        throw error;
      }
      const terms = await transaction.select().from(eventPurchaseDesignations)
        .where(eq(eventPurchaseDesignations.workspaceId, input.workspaceId));
      const designated = terms.filter(term => term.designation === "designated");
      if (!designated.length) {
        return { kind: "unknown", reason: terms.some(term => term.designation === "paid_undesignated")
          ? "paid_undesignated" : terms.length ? "checkout_pending" : "no_designation" } as const;
      }
      if (!project.ownerUserId) return { kind: "verification_unavailable" } as const;
      const [owner] = await transaction.select({ id: users.id, clerkId: users.clerkId }).from(users)
        .where(eq(users.id, project.ownerUserId)).limit(1);
      if (!owner?.clerkId) return { kind: "verification_unavailable" } as const;
      if (await hasAccountDeletionStartedWith(transaction, owner.clerkId)) return { kind: "verification_unavailable" } as const;

      let shared: SharedGrant[] = [];
      let sharedAvailable = true;
      try {
        shared = await sharedDatabase.select().from(sharedEntitlements).where(or(
          eq(sharedEntitlements.userClerkId, owner.clerkId),
          sql`CASE WHEN json_valid(${sharedEntitlements.metadata}) THEN json_extract(${sharedEntitlements.metadata}, '$.workspaceId') = ${input.workspaceId} ELSE 0 END`,
        ));
      } catch { sharedAvailable = false; }
      let local = await transaction.select().from(entitlements).where(or(
        eq(entitlements.userId, owner.id), eq(entitlements.workspaceId, input.workspaceId),
      ));
      const references = [...new Set([
        ...local.filter(row => row.source === "purchase").map(row => row.notes),
        ...shared.filter(isPurchaseMirror).map(row => row.sourceRef),
        ...designated.map(row => row.providerReference),
      ].filter((value): value is string => Boolean(value)))];
      if (references.length) {
        // isolation-ok: exact provider references from this authorized project's
        // terms/current-owner grants; all matches are compared below. Filtering
        // global duplicate references by tenant would hide conflicting evidence.
        const related = await transaction.select().from(entitlements).where(inArray(entitlements.notes, references));
        local = [...new Map([...local, ...related].map(row => [row.id, row])).values()];
      }
      return evaluate(designated, local, shared, sharedAvailable, owner, input.workspaceId, now);
    }, { behavior: "deferred" });
  } catch {
    return { kind: "verification_unavailable" };
  }
}

function evaluate(
  designated: Term[], local: LocalGrant[], shared: SharedGrant[], sharedAvailable: boolean,
  owner: { id: string; clerkId: string | null }, workspaceId: string, now: number,
): EventProjectAccess {
  const purchases = (reference: string) => local.filter(row => row.source === "purchase" && row.notes === reference);
  const isLocalExpired = (row: LocalGrant) => row.expiresAt !== null && row.expiresAt.getTime() <= now;
  const started = (time: number) => Number.isFinite(time) && time <= now;
  const sharedFor = (reference: string) => shared.filter(row => isPurchaseMirror(row) && row.sourceRef === reference);
  let uncertain = !sharedAvailable;
  const completed: Term[] = [];
  const revokedRefs = new Set<string>();
  const futureRefs = new Set<string>();
  const conflictingRefs = new Set<string>();
  let erasedRevoked = 0;

  for (const term of designated) {
    // Erasure removes the payment/account/checkout bindings, not the fact that
    // this surviving project was governed. A negative remains negative. Without
    // the binding, never fabricate current cover or verified archive authority.
    if (term.purchaserUserId === null) {
      if (term.revoked) erasedRevoked++;
      else uncertain = true;
      continue;
    }
    const reference = term.providerReference;
    const conflict = () => {
      uncertain = true;
      if (reference) conflictingRefs.add(reference);
    };
    if (!reference || !term.settledAt || !term.originalExpiresAt || !term.settlementAuthorizedAt) {
      conflict(); continue;
    }
    const matches = purchases(reference);
    if (matches.length !== 1 || !exactLocal(term, matches[0])) {
      conflict(); continue;
    }
    const mirror = sharedFor(reference);
    if (mirror.length > 1 || mirror.some(row => {
      const scope = sharedGrantScope(row);
      return row.userClerkId !== term.purchaserUserId || row.tier !== "event" ||
        scope.kind !== "workspace" || scope.workspaceId !== workspaceId;
    })) { conflict(); continue; }
    const revoked = term.revoked || matches[0].expiresAt?.getTime() === 0 ||
      mirror.some(row => row.status === "revoked" || row.expiresAt === 0);
    if (revoked) revokedRefs.add(reference);
    else if (matches[0].expiresAt?.getTime() !== term.originalExpiresAt.getTime()) {
      conflict(); continue;
    } else if (!started(term.settledAt.getTime())) {
      futureRefs.add(reference);
    } else if (term.originalExpiresAt.getTime() <= now) {
      completed.push(term);
    }
  }

  for (const row of local) {
    if (!paidTier(row.tier) || !["purchase", "comp", "edu"].includes(row.source) ||
        !started(row.startedAt.getTime()) || isLocalExpired(row)) continue;
    if (!(row.workspaceId === workspaceId || (row.workspaceId === null && row.userId === owner.id))) continue;
    if (row.source === "purchase" && row.notes) {
      const matches = purchases(row.notes);
      const mirrors = sharedFor(row.notes);
      if (matches.length !== 1 || conflictingRefs.has(row.notes) || revokedRefs.has(row.notes) || futureRefs.has(row.notes) ||
          mirrors.some(mirror => mirror.status === "revoked" || mirror.expiresAt === 0)) continue;
      if (mirrors.some(mirror => {
        const scope = sharedGrantScope(mirror);
        return mirror.userClerkId !== row.userId || mirror.tier !== row.tier ||
          (scope.kind === "workspace" ? scope.workspaceId : scope.kind === "account" ? null : undefined) !== row.workspaceId;
      })) { uncertain = true; continue; }
    }
    return { kind: "editable", basis: "current_cover" };
  }
  for (const row of shared) {
    if (!paidTier(row.tier) || row.status !== "active" || !started(row.grantedAt) ||
        (row.expiresAt !== null && row.expiresAt <= now)) continue;
    const scope = sharedGrantScope(row);
    if (scope.kind === "unknown") { uncertain = true; continue; }
    if (!(scope.kind === "workspace" ? scope.workspaceId === workspaceId : row.userClerkId === owner.clerkId)) continue;
    if (isPurchaseMirror(row)) {
      if (!row.sourceRef) { uncertain = true; continue; }
      const matches = purchases(row.sourceRef);
      // A shared-first write whose local commit failed is not project authority.
      if (matches.length === 0) { uncertain = true; continue; }
      if (matches.length !== 1 || conflictingRefs.has(row.sourceRef) || revokedRefs.has(row.sourceRef) || futureRefs.has(row.sourceRef) || isLocalExpired(matches[0])) continue;
      const purchase = matches[0];
      if (purchase.userId !== row.userClerkId || purchase.tier !== row.tier ||
          purchase.workspaceId !== (scope.kind === "workspace" ? scope.workspaceId : null)) {
        uncertain = true; continue;
      }
    }
    return { kind: "editable", basis: "current_cover" };
  }
  if (uncertain) return { kind: "verification_unavailable" };
  if (completed.length) return { kind: "read_only", basis: "completed_designated_event" };
  if (revokedRefs.size + erasedRevoked === designated.length) return { kind: "unavailable", reason: "refunded" };
  return { kind: "verification_unavailable" };
}
