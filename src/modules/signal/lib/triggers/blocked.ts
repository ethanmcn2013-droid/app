/**
 * triggers/blocked.ts, Tasks blocked for ≥ 2 days.
 *
 * PRODUCT.md §5.1: "A task with status `blocked` for ≥ 2 days, or a
 * task with an unresolved blocker referenced from another item."
 *
 * Status here is post-canonicalization (PRODUCT.md §6 lane mapping):
 * `blocked` = `blockedBy.length > 0` and the lane hasn't reached done.
 * The two branches in PRODUCT.md collapse to one in our derived model.
 */

import type { Trigger, Insight } from "./types";
import { daysSince, primaryProjectName } from "./_helpers";

export const blocked: Trigger = {
  id: "blocked",
  defaultBlock: "needs-attention",
  detect(work) {
    const insights: Insight[] = [];
    for (const task of work.tasks) {
      if (task.status !== "blocked") continue;
      const days = daysSince(work, task.lastStatusChangeAt);
      if (days < 2) continue;

      const blockerTitle =
        work.tasks.find((t) => task.blockedBy.includes(t.id))?.title ?? null;

      insights.push({
        triggerId: "blocked",
        defaultBlock: "needs-attention",
        entityType: "task",
        entityId: task.id,
        variables: {
          task: task.title,
          project: primaryProjectName(work, task),
          days,
          blocker: blockerTitle ?? "another item",
        },
        rank: {
          cascade: 0.6,
          irreversibility: 0.3,
          proximity: 0.9,
        },
      });
    }
    return insights;
  },
};
