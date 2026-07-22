/**
 * triggers/unresolved-recurring-block.ts, One blocker hitting many tasks.
 *
 * PRODUCT.md §5.1 (canonical): "The same blocker pattern appears ≥ 3
 * times across the project's history."
 *
 * v1 implementation (documented): without activity history, we use the
 * snapshot-time proxy: the same blocker task currently referenced by
 * ≥ 3 different open tasks. This catches the "this thing is in
 * everyone's way" case the canonical rule was after, with a different
 * mechanism. The historical-pattern version revisits when the
 * activities-table read lands.
 */

import type { Trigger, Insight } from "./types";

const RECURRING_THRESHOLD = 3;

export const unresolvedRecurringBlock: Trigger = {
  id: "unresolved-recurring-block",
  defaultBlock: "quiet-risks",
  detect(work) {
    const byId = new Map(work.tasks.map((t) => [t.id, t]));

    // Count distinct dependents per blocker id. Only count blockers that
    // are themselves still open, a shipped blocker that hasn't been
    // cleared from the dependents' blockedBy array isn't recurring,
    // it's stale data.
    const dependents = new Map<string, Set<string>>();
    for (const task of work.tasks) {
      if (task.status === "shipped" || task.status === "refused") continue;
      for (const blockerId of task.blockedBy) {
        const blocker = byId.get(blockerId);
        if (!blocker) continue;
        if (blocker.status === "shipped" || blocker.status === "refused") continue;
        let set = dependents.get(blockerId);
        if (!set) {
          set = new Set();
          dependents.set(blockerId, set);
        }
        set.add(task.id);
      }
    }

    const insights: Insight[] = [];
    for (const [blockerId, deps] of dependents) {
      if (deps.size < RECURRING_THRESHOLD) continue;
      const blocker = byId.get(blockerId);
      if (!blocker) continue;

      insights.push({
        triggerId: "unresolved-recurring-block",
        defaultBlock: "quiet-risks",
        entityType: "task",
        entityId: blockerId,
        variables: {
          blocker: blocker.title,
          count: deps.size,
        },
        rank: {
          cascade: 0.9,
          irreversibility: 0.3,
          proximity: 0.5,
        },
      });
    }
    return insights;
  },
};
