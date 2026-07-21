/**
 * triggers/overdue.ts, Tasks past their due date and not done.
 *
 * PRODUCT.md §5.1: "A task past its due date with no `done` status
 * and no `pushed-to` date." Tasks doesn't model `pushed-to`, a task
 * is overdue iff it has a dueDate in the past and status !== shipped
 * and status !== refused.
 */

import type { Trigger, Insight } from "./types";
import { daysUntilDate, primaryProjectName } from "./_helpers";

export const overdue: Trigger = {
  id: "overdue",
  defaultBlock: "needs-attention",
  detect(work) {
    const insights: Insight[] = [];
    for (const task of work.tasks) {
      if (!task.dueDate) continue;
      if (task.status === "shipped" || task.status === "refused") continue;
      const daysUntil = daysUntilDate(work, task.dueDate);
      if (daysUntil >= 0) continue; // not overdue yet

      const daysOver = -daysUntil;

      insights.push({
        triggerId: "overdue",
        defaultBlock: "needs-attention",
        entityType: "task",
        entityId: task.id,
        variables: {
          task: task.title,
          project: primaryProjectName(work, task),
          days: daysOver,
        },
        rank: {
          cascade: 0.4,
          // Overdue is hard to undo cleanly, the missed window is gone.
          irreversibility: 0.7,
          proximity: 1.0,
        },
      });
    }
    return insights;
  },
};
