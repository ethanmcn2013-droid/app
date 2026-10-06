/**
 * The sidebar's Projects group: which Projects carry a status dot.
 *
 * The rule is the Projects console's own (`buildRow` in project-console.ts):
 * a Project is late when its target date has passed and its owner has not
 * marked it complete; otherwise it is at risk when its owner set that status.
 * Everything else, including a Project with no status, carries no dot.
 * Nothing here is worked out from task counts or guessed.
 *
 * Pure and client-safe: no clock, database or network.
 */
import { summarizeProjectCards, targetDatePassed, type ProjectMetaRow } from "@/lib/projects/project-hub";

import type { SidebarProjectMark } from "@/lib/projects/sidebar-mark";

export type { SidebarProjectMark };

export function sidebarProjectMarks(
  projectIds: readonly string[],
  metaRows: readonly ProjectMetaRow[],
  todayIso: string,
): Record<string, SidebarProjectMark> {
  const stats = summarizeProjectCards(projectIds, metaRows, []);
  const marks: Record<string, SidebarProjectMark> = {};
  for (const id of projectIds) {
    const entry = stats.get(id);
    if (!entry || entry.status === "complete") continue;
    if (targetDatePassed(entry.targetDate, entry.status, todayIso)) marks[id] = "late";
    else if (entry.status === "at-risk") marks[id] = "risk";
  }
  return marks;
}
