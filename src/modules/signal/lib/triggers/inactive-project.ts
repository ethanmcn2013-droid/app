/**
 * triggers/inactive-project.ts, A live project that's gone quiet.
 *
 * PRODUCT.md §5.1: "An active project with no activity for ≥ 8 days."
 * "Active" here means "has at least one task that isn't shipped or
 * refused", a project where every task is done isn't inactive, it's
 * complete, and shouldn't surface as a quiet risk.
 */

import type { Trigger, Insight } from "./types";
import { daysSince, isActive, tasksInProject } from "./_helpers";

const QUIET_DAYS = 8;

export const inactiveProject: Trigger = {
  id: "inactive-project",
  defaultBlock: "quiet-risks",
  detect(work) {
    const insights: Insight[] = [];

    for (const project of work.projects) {
      const projectTasks = tasksInProject(work, project.slug);
      if (!projectTasks.some((t) => isActive(t.status))) continue;

      const days = daysSince(work, project.lastActivityAt);
      if (days < QUIET_DAYS) continue;

      insights.push({
        triggerId: "inactive-project",
        defaultBlock: "quiet-risks",
        entityType: "project",
        entityId: project.slug,
        variables: {
          project: project.name,
          days,
        },
        rank: {
          cascade: 0.3,
          irreversibility: 0.5,
          proximity: 0.4,
        },
      });
    }
    return insights;
  },
};
