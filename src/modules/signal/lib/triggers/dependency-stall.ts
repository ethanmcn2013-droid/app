/**
 * triggers/dependency-stall.ts, A task waiting on a stalled blocker.
 *
 * PRODUCT.md §5.1: "A task waiting on another task that has had no
 * activity for ≥ 5 days." The waiting task itself may not be marked
 * blocked (depending on lane); what matters is the blocker's silence.
 *
 * Snapshot-only: `blockedBy` is the canonical pointer. We look up
 * each referenced blocker and read its `lastActivityAt`. No event
 * log dependency.
 */

import type { Trigger, Insight } from "./types";
import { daysSince, primaryProjectName } from "./_helpers";

const STALL_DAYS = 5;

export const dependencyStall: Trigger = {
  id: "dependency-stall",
  defaultBlock: "needs-attention",
  detect(work) {
    const byId = new Map(work.tasks.map((t) => [t.id, t]));
    const insights: Insight[] = [];
    const seen = new Set<string>();

    for (const task of work.tasks) {
      if (task.blockedBy.length === 0) continue;
      if (task.status === "shipped" || task.status === "refused") continue;

      for (const blockerId of task.blockedBy) {
        const blocker = byId.get(blockerId);
        if (!blocker) continue;
        if (blocker.status === "shipped" || blocker.status === "refused") continue;

        const stallDays = daysSince(work, blocker.lastActivityAt);
        if (stallDays < STALL_DAYS) continue;

        // De-dupe per-(task, blocker) pair, a task can list the same
        // blocker only once anyway, but be defensive.
        const key = `${task.id}->${blockerId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        insights.push({
          triggerId: "dependency-stall",
          defaultBlock: "needs-attention",
          entityType: "task",
          entityId: task.id,
          variables: {
            task: task.title,
            blocker: blocker.title,
            project: primaryProjectName(work, task),
            days: stallDays,
          },
          rank: {
            cascade: 0.8,
            irreversibility: 0.4,
            proximity: 0.8,
          },
        });
      }
    }
    return insights;
  },
};
