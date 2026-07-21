/**
 * triggers/_helpers.ts, Shared utilities for the trigger detectors.
 *
 * Snapshot-time math (now is `work.snapshotAt`, not real-time clock —
 * triggers must be deterministic given a WorkRead).
 *
 * Plan 6 · Cycle 6.4 (Attention engine v1).
 */

import type { Status, TaskRead, WorkRead, ProjectRead } from "../data/types";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Ms timestamp from the snapshot's "now". */
export function snapshotNow(work: WorkRead): number {
  return Date.parse(work.snapshotAt);
}

/** Whole days between two ISO timestamps (a after b => positive). */
export function daysBetweenIso(later: string, earlier: string): number {
  return Math.floor((Date.parse(later) - Date.parse(earlier)) / DAY_MS);
}

/** Whole days from an ISO timestamp until the snapshot's "now". */
export function daysSince(work: WorkRead, isoTimestamp: string): number {
  return Math.floor((snapshotNow(work) - Date.parse(isoTimestamp)) / DAY_MS);
}

/** Whole days from snapshot's "now" until an ISO date (yyyy-mm-dd). */
export function daysUntilDate(work: WorkRead, isoDate: string): number {
  // Treat date as end-of-day local-ish, date-only comparison.
  const dueMs = Date.parse(`${isoDate}T23:59:59Z`);
  return Math.floor((dueMs - snapshotNow(work)) / DAY_MS);
}

/** A task is "active" if it's not done or refused. Used by overload + ratios. */
export function isActive(status: Status): boolean {
  return status !== "shipped" && status !== "refused";
}

/** A task is "completed" if it shipped. Used by streak + momentum. */
export function isCompleted(status: Status): boolean {
  return status === "shipped";
}

/** Lookup a ProjectRead by slug. Returns undefined if missing. */
export function projectBySlug(work: WorkRead, slug: string): ProjectRead | undefined {
  return work.projects.find((p) => p.slug === slug);
}

/**
 * Display name for a task's primary project. Picks the first projectSlug;
 * falls back to the slug verbatim if no synthesized ProjectRead exists,
 * and "an untagged item" if the task has no tags. Triggers that need the
 * project name in prose use this, workspace-level triggers don't.
 */
export function primaryProjectName(work: WorkRead, task: TaskRead): string {
  const slug = task.projectSlugs[0];
  if (!slug) return "an untagged item";
  return projectBySlug(work, slug)?.name ?? slug;
}

/** Tasks scoped to a project. Used by all per-project triggers. */
export function tasksInProject(work: WorkRead, projectSlug: string): TaskRead[] {
  return work.tasks.filter((t) => t.projectSlugs.includes(projectSlug));
}
