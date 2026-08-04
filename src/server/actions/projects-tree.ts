"use server";

/**
 * Projects sidebar tree — server read (T·95 lab parity).
 *
 * The Option B lab's Projects sidebar groups workspaces under their
 * planning period (with the period's date range) and lists periodless
 * workspaces as standalone rows. This builds that tree from real data:
 * my workspaces, their periods, and a per-workspace task count for the
 * leaf receipts. One grouped count query — no N+1.
 */

import { count, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { planningPeriods, tasks, workspaces } from "@/server/db/schema";
import { listMyWorkspaces } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import { DEMO_WORKSPACE_ID } from "@/server/demo/tasks-demo";

export type ProjectsTreeLeaf = Readonly<{
  id: string;
  name: string;
  taskCount: number;
}>;

export type ProjectsTreeGroup = Readonly<{
  /** Planning-period id, or null for the periodless group. */
  periodId: string | null;
  periodName: string | null;
  /** Compact range label, e.g. "6 Jul – 14 Aug"; null when undated. */
  dateRange: string | null;
  workspaces: readonly ProjectsTreeLeaf[];
}>;

export type ProjectsTreeData = Readonly<{
  /** Active (non-archived) projects, grouped by planning period. */
  groups: readonly ProjectsTreeGroup[];
  /** Archived projects, flat. Surfaced under a collapsed "Archived"
   *  section in the sidebar; restore returns them to `groups`. */
  archived: readonly ProjectsTreeLeaf[];
}>;

function compactDate(value: string, withYear = false): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/**
 * A period's span, carrying the year only when the span needs it.
 *
 * The default planning horizon runs a full year — 2026-05-18 to 2027-05-17 —
 * and with the year dropped from both ends that rendered as
 * "18 May – 17 May", which reads as a backwards one-day range rather than a
 * twelve-month one. The dates were always right; the label was hiding the
 * one field that made them make sense.
 */
function formatDateRange(startDate: string, endDate: string): string {
  const crossesYears = startDate.slice(0, 4) !== endDate.slice(0, 4);
  return `${compactDate(startDate, crossesYears)} – ${compactDate(endDate, crossesYears)}`;
}

export async function getProjectsTreeData(): Promise<ProjectsTreeData> {
  if (isDemoMode()) {
    return {
      groups: [
        {
          periodId: "demo-planning-period",
          periodName: "Wedding season",
          // Derived from the one pinned review frame, never a literal —
          // the sidebar must state the same season end every other demo
          // surface derives from.
          dateRange: compactDate(
            PINNED_REVIEW_CALENDAR_FRAME.planningPeriod?.endDate ?? "",
          ),
          workspaces: [
            { id: DEMO_WORKSPACE_ID, name: "The Orchard, events", taskCount: 10 },
          ],
        },
      ],
      archived: [],
    };
  }

  const mine = await listMyWorkspaces();
  if (mine.length === 0) return { groups: [], archived: [] };
  const ids = mine.map((w) => w.id);

  const [wsRows, countRows] = await Promise.all([
    db
      .select({
        id: workspaces.id,
        planningPeriodId: workspaces.planningPeriodId,
        archivedAt: workspaces.archivedAt,
      })
      .from(workspaces)
      .where(inArray(workspaces.id, ids)),
    db
      .select({ workspaceId: tasks.workspaceId, n: count() })
      .from(tasks)
      .where(inArray(tasks.workspaceId, ids))
      .groupBy(tasks.workspaceId),
  ]);

  const periodByWs = new Map(wsRows.map((r) => [r.id, r.planningPeriodId]));
  const archivedWs = new Set(
    wsRows.filter((r) => r.archivedAt != null).map((r) => r.id),
  );
  const countByWs = new Map(countRows.map((r) => [r.workspaceId, r.n]));

  const periodIds = [
    ...new Set(wsRows.map((r) => r.planningPeriodId).filter((v): v is string => Boolean(v))),
  ];
  const periods = periodIds.length
    ? await db
        .select({
          id: planningPeriods.id,
          name: planningPeriods.name,
          startDate: planningPeriods.startDate,
          endDate: planningPeriods.endDate,
        })
        .from(planningPeriods)
        .where(inArray(planningPeriods.id, periodIds))
    : [];
  const periodById = new Map(periods.map((p) => [p.id, p]));

  const groups = new Map<string | null, ProjectsTreeLeaf[]>();
  const archived: ProjectsTreeLeaf[] = [];
  for (const w of mine) {
    const leaf: ProjectsTreeLeaf = {
      id: w.id,
      name: w.name,
      taskCount: countByWs.get(w.id) ?? 0,
    };
    if (archivedWs.has(w.id)) {
      archived.push(leaf);
      continue;
    }
    const pid = periodByWs.get(w.id) ?? null;
    const key = pid && periodById.has(pid) ? pid : null;
    const bucket = groups.get(key);
    if (bucket) bucket.push(leaf);
    else groups.set(key, [leaf]);
  }

  const result: ProjectsTreeGroup[] = [];
  for (const [key, leaves] of groups) {
    if (key === null) continue;
    const p = periodById.get(key)!;
    const dateRange =
      p.startDate && p.endDate
        ? formatDateRange(p.startDate, p.endDate)
        : p.startDate
          ? compactDate(p.startDate)
          : null;
    result.push({ periodId: key, periodName: p.name, dateRange, workspaces: leaves });
  }
  const loose = groups.get(null);
  if (loose) {
    result.push({ periodId: null, periodName: null, dateRange: null, workspaces: loose });
  }
  return { groups: result, archived };
}
