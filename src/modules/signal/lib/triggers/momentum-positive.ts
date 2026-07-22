/**
 * triggers/momentum-positive.ts, Project shipping faster than its norm.
 *
 * PRODUCT.md §5.1: "≥ 3 completions in the last 7 days *and* completion
 * rate above its 28-day average."
 *
 * v1 simplification (documented): without the activity-event log, we
 * can't precisely compare 7d to 28d completion rates. We approximate
 * with `lastStatusChangeAt` on shipped tasks: a project earns this
 * trigger when ≥ 3 tasks shipped in the last 7d AND that 7d count is
 * higher than the per-week run-rate inferred from the prior 21d. The
 * comparison stays directionally honest; the precise event-log version
 * lands when source.read() pulls from `activities` in a later cycle.
 */

import type { Trigger, Insight } from "./types";
import {
  daysSince,
  isCompleted,
  tasksInProject,
} from "./_helpers";

const RECENT_DAYS = 7;
const PRIOR_DAYS = 21;
const MIN_RECENT_SHIPPED = 3;

export const momentumPositive: Trigger = {
  id: "momentum-positive",
  defaultBlock: "moving-well",
  detect(work) {
    const insights: Insight[] = [];

    for (const project of work.projects) {
      const projectTasks = tasksInProject(work, project.slug);
      const shipped = projectTasks.filter((t) => isCompleted(t.status));
      if (shipped.length === 0) continue;

      let recent = 0;
      let prior = 0;
      for (const t of shipped) {
        const age = daysSince(work, t.lastStatusChangeAt);
        if (age < 0) continue;
        if (age < RECENT_DAYS) recent += 1;
        else if (age < RECENT_DAYS + PRIOR_DAYS) prior += 1;
      }

      if (recent < MIN_RECENT_SHIPPED) continue;
      // 7d count vs prior-21d weekly rate (prior / 3).
      const priorWeekly = prior / 3;
      if (recent <= priorWeekly) continue;

      insights.push({
        triggerId: "momentum-positive",
        defaultBlock: "moving-well",
        entityType: "project",
        entityId: project.slug,
        variables: {
          project: project.name,
          count: recent,
        },
        rank: {
          cascade: 0.2,
          irreversibility: 0.0,
          proximity: 0.5,
        },
      });
    }
    return insights;
  },
};
