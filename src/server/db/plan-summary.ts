import "server-only";
import { and, desc, eq, gt, isNull, like, or } from "drizzle-orm";
import { db } from "./index";
import { compCodes, entitlements } from "./schema";
import { getEffectiveTier } from "./entitlements";
import type { EntitlementTier } from "@/lib/data";

export type PlanSummary =
  | {
      kind: "free";
      tier: "free";
    }
  | {
      kind: "comp_wedding";
      tier: "wedding";
      sponsorName: string;
      sponsorSlug: string;
      code: string;
      startedAt: Date;
      expiresAt: Date | null;
    }
  | {
      kind: "paid";
      tier: Exclude<EntitlementTier, "free" | "wedding">;
      startedAt: Date;
      expiresAt: Date | null;
    }
  | {
      kind: "paid_wedding";
      tier: "wedding";
      startedAt: Date;
      expiresAt: Date | null;
    };

type CompNotes = {
  sponsor_slug?: string;
  sponsor_name?: string;
  source_type?: string;
};

/**
 * Resolve the user-facing plan summary for the user in their currently
 * active workspace. Joins entitlement source + comp-code sponsor JSON
 * so the Plan view can render Lamb's-Hill-aware copy without the
 * client doing a second round-trip.
 */
export async function getPlanSummary(
  userId: string,
  workspaceId: string,
): Promise<PlanSummary> {
  const tier = await getEffectiveTier(userId, workspaceId);
  if (tier === "free") return { kind: "free", tier: "free" };

  const now = new Date();
  const [row] = await db
    .select({
      tier: entitlements.tier,
      source: entitlements.source,
      notes: entitlements.notes,
      startedAt: entitlements.startedAt,
      expiresAt: entitlements.expiresAt,
    })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        or(
          eq(entitlements.workspaceId, workspaceId),
          isNull(entitlements.workspaceId),
        ),
        or(
          isNull(entitlements.expiresAt),
          gt(entitlements.expiresAt, now),
        ),
      ),
    )
    .orderBy(desc(entitlements.startedAt))
    .limit(1);

  if (!row) return { kind: "free", tier: "free" };

  if (row.tier === "wedding" && row.source === "comp" && row.notes) {
    const code = row.notes.replace(/^comp:/, "");
    if (code) {
      const [compRow] = await db
        .select({ notes: compCodes.notes })
        .from(compCodes)
        .where(eq(compCodes.code, code))
        .limit(1);
      if (compRow?.notes) {
        try {
          const parsed = JSON.parse(compRow.notes) as CompNotes;
          if (
            parsed.sponsor_slug &&
            parsed.sponsor_name &&
            parsed.source_type === "venue_edition"
          ) {
            return {
              kind: "comp_wedding",
              tier: "wedding",
              sponsorName: parsed.sponsor_name,
              sponsorSlug: parsed.sponsor_slug,
              code,
              startedAt: row.startedAt,
              expiresAt: row.expiresAt,
            };
          }
        } catch {
          // Fall through to paid_wedding kind.
        }
      }
    }
  }

  if (row.tier === "wedding") {
    return {
      kind: "paid_wedding",
      tier: "wedding",
      startedAt: row.startedAt,
      expiresAt: row.expiresAt,
    };
  }

  return {
    kind: "paid",
    tier: row.tier as Exclude<EntitlementTier, "free" | "wedding">,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
  };
}
