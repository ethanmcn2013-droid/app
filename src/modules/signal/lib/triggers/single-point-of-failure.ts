/**
 * triggers/single-point-of-failure.ts, One person carrying a project.
 *
 * PRODUCT.md §5.1: "> 70% of a project's open work assigned to one
 * person." Open work = active (not shipped, not refused). A project
 * with only 1–2 open tasks isn't a SPOF signal, set a floor of 4
 * open tasks before this trigger fires, otherwise every two-task
 * project with one assignee becomes a "quiet risk" and the block
 * gets noisy.
 *
 * Voice note: prose says "one person", not the name. Same reasoning
 * as overload + streak.
 */

import type { Trigger, Insight } from "./types";
import { isActive, tasksInProject } from "./_helpers";

const SPOF_THRESHOLD = 0.7;
const MIN_OPEN_TASKS = 4;

export const singlePointOfFailure: Trigger = {
  id: "single-point-of-failure",
  defaultBlock: "quiet-risks",
  detect(work) {
    const insights: Insight[] = [];

    for (const project of work.projects) {
      const open = tasksInProject(work, project.slug).filter((t) =>
        isActive(t.status),
      );
      if (open.length < MIN_OPEN_TASKS) continue;

      const counts = new Map<string, number>();
      for (const t of open) {
        const id = t.assignee?.id;
        if (!id) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      if (counts.size === 0) continue;

      let topId = "";
      let topCount = 0;
      for (const [id, count] of counts) {
        if (count > topCount) {
          topId = id;
          topCount = count;
        }
      }

      const share = topCount / open.length;
      if (share <= SPOF_THRESHOLD) continue;

      insights.push({
        triggerId: "single-point-of-failure",
        defaultBlock: "quiet-risks",
        entityType: "project",
        entityId: project.slug,
        variables: {
          project: project.name,
          share: Math.round(share * 100),
          assignee: topId,
        },
        rank: {
          cascade: 0.6,
          irreversibility: 0.4,
          proximity: 0.3,
        },
      });
    }
    return insights;
  },
};
