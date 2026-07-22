/**
 * triggers/overload.ts, A single assignee carrying too much.
 *
 * PRODUCT.md §5.1: "> 8 active tasks (or > 60% of all active tasks
 * in their workspace)." Active = not shipped, not refused.
 *
 * Note on assignee names: prose for this trigger doesn't slot a person's
 * name. Tasks's user records expose only opaque ids in WorkRead today,
 * and a wedding-planner workspace where the loaded assignee is also the
 * reader makes "Sarah is loaded" awkward. The phrasings read as
 * "Someone is carrying X" / "One person holds X", works for solo and
 * multi-person workspaces. Hydrating names is a follow-up.
 */

import type { Trigger, Insight } from "./types";
import { isActive } from "./_helpers";

const HARD_CAP = 8;
const SHARE_THRESHOLD = 0.6;

export const overload: Trigger = {
  id: "overload",
  defaultBlock: "needs-attention",
  detect(work) {
    const active = work.tasks.filter((t) => isActive(t.status));
    const totalActive = active.length;
    if (totalActive === 0) return [];

    const counts = new Map<string, number>();
    for (const task of active) {
      const id = task.assignee?.id;
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const insights: Insight[] = [];
    for (const [assigneeId, count] of counts) {
      const share = count / totalActive;
      if (count <= HARD_CAP && share <= SHARE_THRESHOLD) continue;

      insights.push({
        triggerId: "overload",
        defaultBlock: "needs-attention",
        entityType: "user",
        entityId: assigneeId,
        variables: {
          count,
          // Whole-percent share for prose, never a metric phrase.
          share: Math.round(share * 100),
        },
        rank: {
          cascade: 0.7,
          irreversibility: 0.2,
          proximity: 0.7,
        },
      });
    }
    return insights;
  },
};
