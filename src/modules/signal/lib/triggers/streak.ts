/**
 * triggers/streak.ts, An assignee on a hot streak.
 *
 * PRODUCT.md §5.1: "An assignee with ≥ 5 completions in the last 7 days."
 * Workspace-level, not per-project. Tasks shipped without an assignee
 * (rare) are excluded.
 *
 * Voice note: like overload, prose doesn't slot the person's name.
 * "Someone has shipped 7 in the last week" reads cleanly for solo and
 * multi-person workspaces, and avoids the comparison-shopping vibe of
 * named productivity tracking. PRODUCT.md §7 explicitly bans
 * leaderboards and per-person scores; this trigger threads the needle
 * by surfacing the *fact of momentum*, not the name attached to it.
 */

import type { Trigger, Insight } from "./types";
import { daysSince, isCompleted } from "./_helpers";

const RECENT_DAYS = 7;
const MIN_COMPLETIONS = 5;

export const streak: Trigger = {
  id: "streak",
  defaultBlock: "moving-well",
  detect(work) {
    const counts = new Map<string, number>();
    for (const task of work.tasks) {
      if (!isCompleted(task.status)) continue;
      if (!task.assignee) continue;
      if (daysSince(work, task.lastStatusChangeAt) >= RECENT_DAYS) continue;
      const id = task.assignee.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    const insights: Insight[] = [];
    for (const [assigneeId, count] of counts) {
      if (count < MIN_COMPLETIONS) continue;
      insights.push({
        triggerId: "streak",
        defaultBlock: "moving-well",
        entityType: "user",
        entityId: assigneeId,
        variables: {
          count,
        },
        rank: {
          cascade: 0.1,
          irreversibility: 0.0,
          proximity: 0.5,
        },
      });
    }
    return insights;
  },
};
