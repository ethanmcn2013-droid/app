import "server-only";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { entitlementsDb } from "./client";
import { entitlements, ENTITLEMENT_SOURCES, type Entitlement, type EntitlementTier } from "./schema";
import { TIER_RANK } from "./tiers";

export type ResolvedEntitlement = {
  tier: EntitlementTier;
  source: string | null;
  sourceRef: string | null;
  expiresAt: number | null;
  stripeCustomerId: string | null;
};

const FREE_DEFAULT: ResolvedEntitlement = {
  tier: "free",
  source: null,
  sourceRef: null,
  expiresAt: null,
  stripeCustomerId: null,
};

export type GrantScope =
  | { kind: "account" }
  | { kind: "workspace"; workspaceId: string }
  | { kind: "unknown" };

/** Stripe mirrors need the App's local revocation check before authorising use. */
export function isPurchaseMirror(row: Entitlement): boolean {
  return row.source === "workspace_subscription" || row.source === "event_pass" ||
    Boolean(row.stripeCustomerId || row.stripeSubscriptionId ||
      row.sourceRef?.startsWith("stripe:") || row.sourceRef?.startsWith("stripe-sub:"));
}

/**
 * Explicit scope wins at every tier. Legacy Studio operator/code grants were
 * account-bound before workspaceId existed; retain those known shapes. Missing
 * purchase scope is not evidence of an account-wide Event/Pro purchase. A local
 * legacy row with workspaceId=null can still authorise it in the App resolver.
 */
export function sharedGrantScope(row: Entitlement): GrantScope {
  if (!ENTITLEMENT_SOURCES.some(source => source === row.source)) return { kind: "unknown" };
  let metadata: Record<string, unknown> = {};
  if (row.metadata !== null) {
    try {
      const parsed: unknown = JSON.parse(row.metadata);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { kind: "unknown" };
      metadata = parsed as Record<string, unknown>;
    } catch { return { kind: "unknown" }; }
  }
  if (Object.hasOwn(metadata, "workspaceId")) {
    const id = metadata.workspaceId;
    if (id === null) return { kind: "account" };
    return typeof id === "string" && id.trim() === id && id.length > 0
      ? { kind: "workspace", workspaceId: id }
      : { kind: "unknown" };
  }
  // These App writers always record scope; an incomplete mirror is not legacy.
  if (metadata.origin === "stripe-reconciliation" ||
      metadata.origin === "tasks-grantEntitlement" ||
      metadata.origin === "tasks-reconcile-sweep") return { kind: "unknown" };
  if (row.tier === "studio" || !isPurchaseMirror(row) ||
      metadata.origin === "studio-ops" || metadata.origin === "studio-hq" ||
      row.sourceRef?.startsWith("redeem:")) return { kind: "account" };
  return { kind: "unknown" };
}

export function grantAppliesToWorkspace(scope: GrantScope, workspaceId: string | null): boolean {
  return scope.kind === "account" ||
    (scope.kind === "workspace" && scope.workspaceId === workspaceId);
}

/**
 * Resolve a shared grant for a project, or account grants only when no project
 * is supplied. This store-only read cannot check App purchase revocations:
 * App access gates must use server/db/entitlements, not this display reader.
 *
 * Failure mode: returns `free` on any DB error. Entitlements MUST
 * NOT take a product down. Callers that need to distinguish "user is
 * on free" from "DB unreachable" should call resolveEntitlementOrThrow.
 */
export async function resolveEntitlement(
  clerkId: string,
  workspaceId: string | null = null,
  database?: ReturnType<typeof entitlementsDb>,
): Promise<ResolvedEntitlement> {
  if (!clerkId) return FREE_DEFAULT;
  try {
    return await resolveEntitlementOrThrow(clerkId, workspaceId, database);
  } catch {
    return FREE_DEFAULT;
  }
}

export async function resolveEntitlementOrThrow(
  clerkId: string,
  workspaceId: string | null = null,
  database?: ReturnType<typeof entitlementsDb>,
): Promise<ResolvedEntitlement> {
  if (!clerkId) return FREE_DEFAULT;
  const rows = (await listEntitlements(clerkId, database)).filter(row =>
    Object.hasOwn(TIER_RANK, row.tier) && grantAppliesToWorkspace(sharedGrantScope(row), workspaceId));

  if (rows.length === 0) return FREE_DEFAULT;

  let best = rows[0];
  let bestRank = TIER_RANK[best.tier as EntitlementTier] ?? -1;
  for (let i = 1; i < rows.length; i++) {
    const rank = TIER_RANK[rows[i].tier as EntitlementTier] ?? -1;
    if (rank > bestRank) {
      best = rows[i];
      bestRank = rank;
    }
  }
  return {
    tier: best.tier as EntitlementTier,
    source: best.source,
    sourceRef: best.sourceRef,
    expiresAt: best.expiresAt,
    stripeCustomerId: best.stripeCustomerId,
  };
}

/**
 * Fetch the full active-entitlement list for a user. Used by HQ
 * dashboards, settings/plan pages, admin tooling. Read-only inventory across
 * ALL scopes, not an authorisation result. Keep metadata in the returned rows.
 */
export async function listEntitlements(clerkId: string, database?: ReturnType<typeof entitlementsDb>) {
  if (!clerkId) return [];
  const now = Date.now();
  const db = database ?? entitlementsDb();
  return db
    .select()
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userClerkId, clerkId),
        eq(entitlements.status, "active"),
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now)),
      ),
    );
}
