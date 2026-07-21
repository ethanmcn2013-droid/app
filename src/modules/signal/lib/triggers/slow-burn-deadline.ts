/**
 * triggers/slow-burn-deadline.ts, Project deadline close, work not.
 *
 * PRODUCT.md §5.1: "A project with a deadline ≤ 7 days away and < 30%
 * of items closed."
 *
 * v1 caveat (documented in PRODUCT.md §6): Tasks doesn't model
 * project-level deadlines, so `ProjectRead.deadline` is always null
 * from `tasksDbSource`. This trigger therefore returns [] in v1, it's
 * implemented and registered so the pipeline shape is stable, but it
 * cannot fire until project-level deadlines have a source.
 *
 * If/when project deadlines become readable (e.g. derived from
 * earliest task dueDate among tagged tasks, or modeled in Tasks
 * itself), the detect logic below activates without further changes.
 */

import type { Trigger, Insight } from "./types";
import {
  daysUntilDate,
  isCompleted,
  tasksInProject,
} from "./_helpers";

const HORIZON_DAYS = 7;
const CLOSED_RATIO = 0.3;
const MIN_TASKS = 4;

export const slowBurnDeadline: Trigger = {
  id: "slow-burn-deadline",
  defaultBlock: "quiet-risks",
  detect(work) {
    const insights: Insight[] = [];

    for (const project of work.projects) {
      if (!project.deadline) continue;

      const daysUntil = daysUntilDate(work, project.deadline);
      if (daysUntil < 0 || daysUntil > HORIZON_DAYS) continue;

      const tasks = tasksInProject(work, project.slug);
      if (tasks.length < MIN_TASKS) continue;

      const shipped = tasks.filter((t) => isCompleted(t.status)).length;
      const closedShare = shipped / tasks.length;
      if (closedShare >= CLOSED_RATIO) continue;

      insights.push({
        triggerId: "slow-burn-deadline",
        defaultBlock: "quiet-risks",
        entityType: "project",
        entityId: project.slug,
        variables: {
          project: project.name,
          days: daysUntil,
          // Whole-percent done, prose may use "still mostly open"
          // wording rather than the number.
          done: Math.round(closedShare * 100),
        },
        rank: {
          cascade: 0.5,
          irreversibility: 0.8,
          proximity: 0.9,
        },
      });
    }
    return insights;
  },
};
