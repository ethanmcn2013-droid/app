/**
 * When a Tasks milestone snapshot is allowed to delete synchronized nodes.
 *
 * Pure on purpose, like `adopt-timeline.ts` and `provision-slug.ts`: this is a
 * rule about destruction, and a rule about destruction should be readable and
 * testable without a database in the room.
 *
 * ── THE DEFECT THIS REPLACES ───────────────────────────────────────────────
 * `getMilestonesForClerkId` returned `SyncedMilestone[]` and converted every
 * failure to `[]`. `writeRoadmapNodes`, given an empty incoming set, deletes
 * every synchronized node in the project — its documented "un-promote is
 * immediate and total" behaviour, which is correct for a real un-promote and
 * catastrophic for a dropped connection. A read-token expiry, a Tasks outage,
 * a subject with no Tasks user row, or a Project with more than 200 milestones
 * all produced deletions that looked like successful syncs.
 *
 * ── THE RULE (plan §6.5) ───────────────────────────────────────────────────
 * Destructive reconciliation runs only for `complete`, and only when the
 * snapshot can prove it saw everything (`items.length === totalCount`). A
 * freshly authorized, successful ZERO is the only outcome permitted to remove
 * every synchronized node. Partial, timeout, authentication, database and
 * network failures preserve the last snapshot. Manual nodes and overlays are
 * never touched by Tasks reconciliation at all — that is enforced separately,
 * by the `ms-` prefix filter in `writeRoadmapNodes`.
 */

import type { MilestoneSnapshot } from "@/modules/timeline/server/sync/tasks-milestone-source";
import type { SyncedMilestone } from "@/modules/timeline/server/db/timeline-queries";

export type MilestoneReconciliationPlan =
  /** Upsert the incoming rows AND delete synchronized rows that are no longer
   *  in them. Reachable only from a provably whole snapshot. */
  | Readonly<{
      kind: "apply";
      reconcile: "destructive";
      items: readonly SyncedMilestone[];
      digest: string;
    }>
  /** Upsert the incoming rows and delete nothing. What we did not see is not
   *  evidence that it is gone. */
  | Readonly<{
      kind: "apply";
      reconcile: "preserve";
      items: readonly SyncedMilestone[];
      reason: string;
    }>
  /** Write nothing at all. The previous snapshot stands. */
  | Readonly<{ kind: "skip"; reason: string; code: string }>;

export function planMilestoneReconciliation(
  snapshot: MilestoneSnapshot,
): MilestoneReconciliationPlan {
  if (snapshot.kind === "complete") {
    if (snapshot.items.length !== snapshot.totalCount) {
      // The source called itself complete and its own numbers disagree. Trust
      // the disagreement, not the label.
      return {
        kind: "apply",
        reconcile: "preserve",
        items: snapshot.items,
        reason: "count-mismatch",
      };
    }
    // Includes the legitimate zero: authorized, successful, and genuinely
    // empty. This is the only path that may empty a Timeline.
    return {
      kind: "apply",
      reconcile: "destructive",
      items: snapshot.items,
      digest: snapshot.digest,
    };
  }

  if (snapshot.kind === "partial") {
    return {
      kind: "apply",
      reconcile: "preserve",
      items: snapshot.items,
      reason: "truncated-source",
    };
  }

  return {
    kind: "skip",
    reason: snapshot.kind,
    code: snapshot.code,
  };
}
