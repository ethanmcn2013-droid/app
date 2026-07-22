/**
 * Pure milestone threshold helpers — no IO, no server-only imports.
 *
 * Extracted from src/server/milestones.ts so tests can import these
 * without triggering the "server-only" guard in the server module.
 */

export const MILESTONE_THRESHOLDS = [100, 250, 500, 1000] as const;
export type MilestoneThreshold = (typeof MILESTONE_THRESHOLDS)[number];

/**
 * Pure helper — determines which thresholds are newly crossed given a
 * completion count and the set of thresholds already awarded.
 *
 * Returns thresholds in ascending order where:
 *   count >= threshold AND threshold not in alreadyAwarded
 */
export function awardableThresholds(
  count: number,
  alreadyAwarded: Set<number>,
): MilestoneThreshold[] {
  return MILESTONE_THRESHOLDS.filter(
    (t) => count >= t && !alreadyAwarded.has(t),
  );
}
