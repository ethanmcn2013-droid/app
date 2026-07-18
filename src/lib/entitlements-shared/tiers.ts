import type { EntitlementSource, EntitlementTier } from "./schema";

/**
 * Tier vocabulary + ranking helpers. Pure, no DB access, safe to
 * import anywhere (server or client).
 *
 * Ranking is used by resolveHighestTier() to pick the right tier
 * when a user holds multiple active entitlements. Higher number =
 * more access. Treat as the truth table for gates:
 *
 *   if (rank(tier) >= rank("workspace")) allow(...)
 */
export const TIER_RANK: Record<EntitlementTier, number> = {
  free: 0,
  event: 1,
  wedding: 2,
  workspace: 3,
  studio: 4,
};

/** Compare two tiers, true if `a` is at least `b`. */
export function tierAtLeast(a: EntitlementTier, b: EntitlementTier): boolean {
  return TIER_RANK[a] >= TIER_RANK[b];
}

/** Pretty label for a tier, used in UI messaging. */
export const TIER_LABEL: Record<EntitlementTier, string> = {
  free: "Free",
  event: "Event",
  wedding: "Wedding",
  workspace: "Workspace",
  studio: "Studio",
};

/**
 * Human "edition" label for the header licence slot (Phase 1). Bound to
 * the entitlement *source*, not the tier: only sources that represent a
 * distinct licence programme carry an edition badge. A plain paid
 * `workspace_subscription` or a `free` account has no edition label — the
 * slot renders nothing rather than inventing one. Pure, no DB access.
 *
 * Returns null for every source that isn't a named edition, so the header
 * never shows a false or hardcoded label.
 */
const EDITION_LABEL: Partial<Record<EntitlementSource, string>> = {
  student_edu: "School Edition",
  venue_edition: "Venue Edition",
};

export function editionLabel(source: EntitlementSource | null | undefined): string | null {
  if (!source) return null;
  return EDITION_LABEL[source] ?? null;
}
