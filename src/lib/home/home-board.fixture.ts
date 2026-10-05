/**
 * Home in three accounts, for the unit tests and the rendered review harness
 * (`experience/home-overview/`). Review mode has one sample Project, so these
 * stand in for a busy account, a sparse one (one Project, nine tasks, none
 * assigned, as a first account looks) and one whose Projects have no work.
 * Never imported by product code.
 */

import { defaultColumnConfig, resolveBoardColumns } from "@/lib/board-columns";
import { consoleFixture } from "@/lib/projects/project-console.fixture";
import type { HomeBoardInput, HomeColumn, HomeProjectFact, HomeTaskFact } from "@/lib/home/home-board";

export const HOME_FIXTURE_NOW = Date.parse("2026-10-05T09:30:00+01:00");
export const HOME_FIXTURE_ZONE = "Europe/Dublin";
export const HOME_FIXTURE_VIEWER = "u-orla";

const DAY = 86_400_000;
const columns: HomeColumn[] = resolveBoardColumns(defaultColumnConfig()).map(({ key, name, isDone, isSystem, color }) => ({ key, name, isDone, isSystem, color }));

const PEOPLE: Record<string, string> = {
  "u-orla": "Orla Byrne",
  "u-aoife": "Aoife Brennan",
  "u-sean": "Seán Kavanagh",
  "u-tom": "Tom Reilly",
  "u-dara": "Dara Hayes",
};

/** A date `days` from today at midday, so no zone moves it to another day. */
const at = (days: number) => HOME_FIXTURE_NOW + days * DAY + 3 * 3_600_000;

function task(
  id: string,
  projectId: string,
  title: string,
  columnKey: string,
  due: number | null,
  assignees: string[],
  extra: Partial<HomeTaskFact> = {},
): HomeTaskFact {
  return {
    id,
    projectId,
    title,
    columnKey,
    dueAt: due === null ? null : at(due),
    completedAt: null,
    updatedAt: HOME_FIXTURE_NOW - DAY,
    assignees,
    recurring: false,
    ...extra,
  };
}

function busyProjects(): HomeProjectFact[] {
  return consoleFixture().projects.map((project) => ({ ...project, columns, members: PEOPLE }));
}

const BUSY_TASKS: HomeTaskFact[] = [
  // Late, yours.
  task("t-prices", "p-winter", "Agree the winter price list", "todo", -7, ["u-orla"]),
  task("t-brochure", "p-winter", "Approve the brochure copy", "doing", -1, ["u-orla", "u-sean"]),
  task("t-headcount", "p-keane", "Chase the headcount from Mark", "waiting", -3, ["u-orla"], { updatedAt: HOME_FIXTURE_NOW - 4 * DAY }),
  // Due today: one open, one already ticked this morning.
  task("t-menus", "p-mara", "Print the tasting menus", "doing", 0, ["u-orla"]),
  task("t-invoice", "p-mara", "Send the final invoice to Mara and Finn", "done", 0, ["u-orla"], { completedAt: HOME_FIXTURE_NOW - 3_600_000 }),
  // This week.
  task("t-seating", "p-mara", "Approve the seating plan", "todo", 1, ["u-orla"]),
  task("t-marquee", "p-garden", "Confirm the marquee sides with Lawlor Hire", "todo", 4, []),
  task("t-rota", "p-keane", "Send the weekend rota", "todo", 6, ["u-orla"], { recurring: true }),
  // To check: put there by someone else.
  task("t-quote", "p-barn", "Heating quote, underfloor", "review", 3, ["u-tom"], { updatedAt: HOME_FIXTURE_NOW - 2 * DAY }),
  task("t-copy", "p-winter", "Winter brochure, second draft", "review", null, ["u-sean"], { updatedAt: HOME_FIXTURE_NOW - 5 * DAY }),
  // Waiting.
  task("t-lindens", "p-garden", "Chase The Lindens for a yes", "waiting", 5, ["u-orla"], { updatedAt: HOME_FIXTURE_NOW - 2 * DAY }),
  task("t-florist", "p-mara", "Chase the florist deposit", "waiting", 2, ["u-aoife"], { updatedAt: HOME_FIXTURE_NOW - 7 * DAY }),
  task("t-slate", "p-barn", "Slate delivery date from the yard", "waiting", null, ["u-tom"], { updatedAt: HOME_FIXTURE_NOW - 4 * DAY }),
  // Other people's work, and work in a wrapped Project: never on Home's lists.
  task("t-sign", "p-mara", "Reprint the faded welcome sign", "todo", -3, ["u-aoife"]),
  task("t-olives", "p-mara", "Order tonic and the good olives", "todo", 0, ["u-dara"]),
  task("t-thanks", "p-summer", "Send the thank you cards", "todo", -20, ["u-orla"]),
  // Assigned only to someone who has left: nobody current holds it.
  task("t-left", "p-newyear", "Book the band for midnight", "todo", 0, ["u-gone"]),
];

const SPARSE_TITLES = [
  "Write the welcome note",
  "Pick a date for the first tasting",
  "Ask the florist for a quote",
  "Draft the guest list",
  "Choose the menu cards",
  "Book the photographer",
  "Confirm the room layout",
  "Order the place cards",
  "Send the save the dates",
];

export type HomeFixtureState = "busy" | "sparse" | "empty" | "none" | "partial" | "review";

export function homeFixture(state: HomeFixtureState = "busy"): HomeBoardInput {
  const base = {
    now: HOME_FIXTURE_NOW,
    timeZone: HOME_FIXTURE_ZONE,
    viewerId: HOME_FIXTURE_VIEWER,
    viewerName: PEOPLE[HOME_FIXTURE_VIEWER]!,
    truncated: false,
    canAct: true,
  };
  if (state === "none") return { ...base, projects: [], tasks: [] };

  if (state === "sparse" || state === "empty") {
    const project: HomeProjectFact = {
      id: "p-test",
      name: "Test project",
      role: "primary-owner",
      selectable: true,
      blockedReason: null,
      openCount: state === "empty" ? 0 : 8,
      stats: { status: null, targetDate: null, purpose: null, total: state === "empty" ? 0 : 9, complete: state === "empty" ? 0 : 1, overdue: state === "empty" ? 0 : 1 },
      facts: {
        lead: { name: "Orla Byrne", initials: "OB" },
        nextDate: null,
        oldestLate: state === "empty" ? null : { id: "s-1", title: SPARSE_TITLES[1]!, dueDate: "2026-10-02" },
        nudge: null,
        doneByDay: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, state === "empty" ? 0 : 1, 0],
      },
      columns,
      members: { "u-orla": "Orla Byrne" },
    };
    const tasks =
      state === "empty"
        ? []
        : SPARSE_TITLES.map((title, index) =>
            task(`s-${index}`, "p-test", title, index === 0 ? "done" : index === 4 ? "doing" : "todo", index === 1 ? -3 : index === 2 ? 0 : index === 3 ? 3 : null, [], {
              completedAt: index === 0 ? HOME_FIXTURE_NOW - 2 * DAY : null,
            }),
          );
    return { ...base, projects: [project], tasks };
  }

  const projects = busyProjects();
  if (state === "partial") {
    // The extra reads failed: no counts and no Console facts for anything.
    return { ...base, projects: projects.map((project) => ({ ...project, stats: null, facts: null })), tasks: BUSY_TASKS };
  }
  return { ...base, canAct: state !== "review", projects, tasks: BUSY_TASKS };
}
