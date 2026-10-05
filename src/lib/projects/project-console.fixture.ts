/**
 * A twelve-Project list in mixed states, for judging the Console with many
 * rows. Review mode has one sample Project, so this fixture stands in for a
 * busy account in the unit tests and in the rendered review harness
 * (`experience/project-console/`). It is never imported by product code.
 *
 * Every state the model knows appears at least once: past its target date,
 * at risk, on track, paused, no status, wrapped; led by the reader, co-owned
 * and joined; no tasks, all done, counts that could not be read, a name that
 * could not be made unique, a very long name, and a date in another year.
 */

import type { ProjectCardStats, ProjectStatus } from "@/lib/projects/project-hub";
import type { ProjectRole } from "@/lib/projects/project-ref";
import type { ConsoleFacts, ConsoleProjectInput } from "@/lib/projects/project-console";

export const CONSOLE_FIXTURE_TODAY = "2026-10-05";

const week = (...lastSeven: number[]): number[] => [1, 0, 2, 1, 0, 1, 2, ...lastSeven];
const quiet = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function stats(status: ProjectStatus, targetDate: string | null, complete: number, total: number, overdue: number): ProjectCardStats {
  return { status, targetDate, purpose: null, complete, total, overdue };
}

function project(
  id: string,
  name: string,
  role: ProjectRole,
  cardStats: ProjectCardStats | null,
  facts: ConsoleFacts | null,
  extra: Partial<ConsoleProjectInput> = {},
): ConsoleProjectInput {
  return {
    id,
    name,
    role,
    selectable: true,
    blockedReason: null,
    openCount: cardStats ? cardStats.total - cardStats.complete : 0,
    stats: cardStats,
    facts,
    ...extra,
  };
}

const orla = { name: "Orla Byrne", initials: "OB" };
const aoife = { name: "Aoife Brennan", initials: "AB" };
const sean = { name: "Seán Kavanagh", initials: "SK" };
const tom = { name: "Tom Reilly", initials: "TR" };

export function consoleFixture(): { today: string; projects: ConsoleProjectInput[] } {
  return {
    today: CONSOLE_FIXTURE_TODAY,
    projects: [
      project("p-mara", "Mara & Finn’s wedding", "member", stats("at-risk", "2026-10-17", 23, 44, 2), {
        lead: aoife,
        nextDate: { title: "Menu tasting", date: "2026-10-05" },
        oldestLate: { id: "t-sign", title: "Reprint the faded welcome sign", dueDate: "2026-10-02" },
        nudge: { taskId: "t-sign", title: "Reprint the faded welcome sign", who: "Aoife Brennan" },
        doneByDay: week(3, 2, 4, 1, 2, 3, 0),
      }),
      project("p-winter", "Winter season launch", "member", stats("on-track", "2026-09-28", 2, 14, 4), {
        lead: sean,
        nextDate: { title: "Menus signed off", date: "2026-09-28" },
        oldestLate: { id: "t-prices", title: "Agree the winter price list", dueDate: "2026-09-28" },
        nudge: { taskId: "t-prices", title: "Agree the winter price list", who: "Seán Kavanagh" },
        doneByDay: week(0, 1, 0, 0, 1, 0, 0),
      }),
      project("p-barn", "Barn roof and heating works", "owner", stats("at-risk", "2026-11-20", 4, 15, 3), {
        lead: tom,
        nextDate: { title: "Slate delivery", date: "2026-10-10" },
        oldestLate: { id: "t-manifold", title: "Order the heating manifold", dueDate: "2026-10-01" },
        nudge: { taskId: "t-manifold", title: "Order the heating manifold", who: "Tom Reilly" },
        doneByDay: week(1, 0, 1, 0, 0, 1, 0),
      }),
      project("p-keane", "Keane Legal retreat", "primary-owner", stats("on-track", "2026-10-12", 2, 6, 0), {
        lead: orla,
        nextDate: { title: "Final headcount", date: "2026-10-09" },
        oldestLate: null,
        nudge: null,
        doneByDay: week(0, 0, 1, 0, 0, 1, 0),
      }),
      project("p-garden", "Garden party, the Lynch family", "primary-owner", stats("on-track", "2026-10-24", 3, 4, 0), {
        lead: orla,
        nextDate: { title: "Marquee goes up", date: "2026-10-23" },
        oldestLate: null,
        nudge: null,
        doneByDay: week(1, 0, 0, 1, 0, 0, 1),
      }),
      project("p-harvest", "Harvest supper and the long-table dinner for the Kinsale food festival weekend", "member", stats("on-track", "2026-11-07", 9, 21, 1), {
        lead: aoife,
        nextDate: null,
        oldestLate: { id: "t-linen", title: "Confirm the linen order", dueDate: "2026-10-04" },
        nudge: null,
        doneByDay: week(2, 1, 0, 2, 1, 0, 1),
      }),
      project("p-newyear", "New Year’s Eve dinner", "primary-owner", stats("on-track", "2026-12-31", 1, 9, 0), {
        lead: orla,
        nextDate: { title: "Tickets on sale", date: "2026-11-02" },
        oldestLate: null,
        nudge: null,
        doneByDay: quiet,
      }),
      project("p-kitchen", "Kitchen refit", "member", stats("paused", "2027-02-15", 5, 18, 0), {
        lead: tom,
        nextDate: null,
        oldestLate: null,
        nudge: null,
        doneByDay: quiet,
      }),
      project("p-website", "New website", "owner", stats(null, null, 0, 0, 0), {
        lead: sean,
        nextDate: null,
        oldestLate: null,
        nudge: null,
        doneByDay: quiet,
      }),
      project(
        "p-shared",
        "Supplier contracts",
        "member",
        stats(null, null, 3, 10, 0),
        { lead: sean, nextDate: null, oldestLate: null, nudge: null, doneByDay: quiet },
        { selectable: false, blockedReason: "Two projects share this name. Rename one in Settings to tell them apart." },
      ),
      project("p-summer", "Summer season, 2026", "primary-owner", stats("complete", "2026-08-31", 38, 38, 0), {
        lead: orla,
        nextDate: null,
        oldestLate: null,
        nudge: null,
        doneByDay: quiet,
      }),
      project("p-oconnor", "The O’Connor wedding", "member", stats("complete", "2026-09-12", 51, 52, 0), {
        lead: aoife,
        nextDate: null,
        oldestLate: null,
        nudge: null,
        doneByDay: quiet,
      }),
    ],
  };
}
