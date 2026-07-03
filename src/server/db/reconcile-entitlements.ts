import "server-only";
import { and, gt, isNull, or } from "drizzle-orm";
import { db } from "./index";
import { entitlements } from "./schema";
import { writeSharedEntitlement } from "@/lib/entitlements-shared/writes";
import type { EntitlementSource as SharedSource } from "@/lib/entitlements-shared/schema";
import type { EntitlementTier } from "@/lib/data";

/** Source vocab translation. Mirrors the helper inside billing.ts;
 *  duplicated here so the reconcile sweep has no cross-action dep. */
function toSharedSource(
  source: string,
  tier: EntitlementTier,
): SharedSource | null {
  switch (source) {
    case "purchase":
      return tier === "wedding" || tier === "event"
        ? "event_pass"
        : "workspace_subscription";
    case "comp":
      return "compliments";
    case "edu":
      return "student_edu";
    case "default":
      return null;
  }
  return null;
}

export type ReconcileResult = {
  scanned: number;
  reconciled: number;
  skipped: number;
  failed: number;
};

/**
 * Daily safety net for the Tasks-local / shared-DB dual write
 * (E-3.2 + E-3.3, 2026-05-14).
 *
 * Scans all active entitlements in the local Tasks table and asks
 * writeSharedEntitlement to mirror each into signal-entitlements.
 * The shared writer is idempotent on (user_clerk_id, source,
 * source_ref) so already-mirrored rows no-op as "created: false"
 * and roll into `skipped`. Only the rare crash-between-writes case
 * actually inserts here.
 *
 * Runs from inside Tasks's daily digest cron (single hobby cron
 * slot, see vercel.json). Sub-second for the row volumes we
 * realistically expect, even years out.
 */
export async function reconcileEntitlements(): Promise<ReconcileResult> {
  const now = new Date();
  const rows = await db
    .select()
    .from(entitlements)
    // isolation-ok: cross-user reconciler run from the daily-digest cron;
    // intentionally scans every user's live entitlements (see fn docstring).
    .where(
      or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now)),
    );

  let reconciled = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const sharedSource = toSharedSource(row.source, row.tier);
    if (!sharedSource) {
      skipped++;
      continue;
    }
    try {
      const result = await writeSharedEntitlement({
        userClerkId: row.userId,
        tier: row.tier,
        source: sharedSource,
        sourceRef: row.notes ?? null,
        expiresAtMs: row.expiresAt ? row.expiresAt.getTime() : null,
        metadata: {
          workspaceId: row.workspaceId,
          origin: "tasks-reconcile-sweep",
        },
      });
      if (result.created) reconciled++;
      else skipped++;
    } catch (err) {
      failed++;
      console.warn(
        `[reconcile-entitlements] row id=${row.id} failed:`,
        err,
      );
    }
  }

  return { scanned: rows.length, reconciled, skipped, failed };
}

/** Suppress the unused-variable warning for `and` so the import stays
 *  available for follow-ups that add more predicates. */
const _maybeAnd = and;
void _maybeAnd;
