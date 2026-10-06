/**
 * The Overview's week view in four accounts, for the unit tests and the
 * rendered review harness (`experience/home-overview/`): a busy wedding with
 * Areas, people, late work and big dates; a sparse first Project (nine tasks,
 * no labels, nobody assigned, most with no date); a Project with no tasks;
 * and a read across two Projects. Never imported by product code.
 */

import { defaultColumnConfig, resolveBoardColumns } from "@/lib/board-columns";
import type { HomeColumn } from "@/lib/home/home-board";
import type { RiverInput, RiverProjectFact, RiverTaskFact } from "@/lib/home/overview-river";

export const RIVER_FIXTURE_NOW = Date.parse("2026-10-05T09:30:00+01:00");
export const RIVER_FIXTURE_ZONE = "Europe/Dublin";

const DAY = 86_400_000;
const columns: HomeColumn[] = resolveBoardColumns(defaultColumnConfig()).map(({ key, name, isDone, isSystem, color }) => ({ key, name, isDone, isSystem, color }));
const at = (days: number) => RIVER_FIXTURE_NOW + days * DAY + 3 * 3_600_000;

const PEOPLE = {
  "u-orla": "Orla Byrne",
  "u-aoife": "Aoife Brennan",
  "u-dev": "Dev Patel",
  "u-dara": "Dara Hayes",
  "u-tom": "Tomás Reilly",
};

const FOOD = "food-and-drink";
const VENUE = "venue-and-hire";
const GUESTS = "guests-and-seating";

function task(id: string, title: string, label: string | null, who: string | null, due: number | null, extra: Partial<RiverTaskFact> = {}): RiverTaskFact {
  return {
    id,
    projectId: "p-mara",
    title,
    columnKey: "todo",
    dueAt: due === null ? null : at(due),
    completedAt: null,
    assignees: who ? [who] : [],
    labels: label ? [label] : [],
    bigDate: false,
    recurring: false,
    ...extra,
  };
}
const done = (id: string, title: string, label: string, who: string, due: number, on: number) => task(id, title, label, who, due, { columnKey: "done", completedAt: at(on) });

const WEDDING: RiverProjectFact = {
  id: "p-mara",
  name: "Mara & Finn’s wedding",
  role: "primary-owner",
  status: "at-risk",
  targetDate: "2026-10-13",
  columns,
  members: PEOPLE,
};

const WEDDING_TASKS: RiverTaskFact[] = [
  task("r-olives", "Order tonic and the good olives", FOOD, "u-dev", -2),
  task("r-tasting", "Menu tasting at The Orchard", FOOD, "u-dev", 0, { columnKey: "doing" }),
  task("r-menus", "Print the tasting menus", FOOD, "u-aoife", 0),
  task("r-prosecco", "Order prosecco for the drinks reception", FOOD, "u-dev", 3),
  task("r-numbers", "Final numbers to the kitchen", FOOD, "u-aoife", 5, { columnKey: "waiting" }),
  task("r-blaas", "Prep the late-night blaas and chips", FOOD, "u-dev", 7),
  task("r-sign", "Reprint the faded welcome sign", VENUE, "u-dara", -3),
  task("r-marquee", "Confirm marquee sides with Lawlor Hire", VENUE, "u-aoife", 2, { columnKey: "review" }),
  task("r-lights", "Test the festoon lights on the terrace", VENUE, "u-tom", 4),
  task("r-return", "Return the marquee to Lawlor Hire", VENUE, "u-tom", 10),
  task("r-weather", "Draft a wet-weather plan for the drinks reception", GUESTS, "u-orla", 1, { columnKey: "doing" }),
  task("r-seating", "Approve the seating plan", GUESTS, "u-aoife", 1),
  task("r-cards", "Order place card stock", GUESTS, "u-aoife", 2),
  task("r-thanks", "Send Mara and Finn the thank you card", GUESTS, "u-orla", 12),
  task("r-big-tasting", "Menu tasting", FOOD, "u-aoife", 0, { bigDate: true }),
  task("r-big-seating", "Seating plan approved", GUESTS, "u-aoife", 1, { bigDate: true }),
  task("r-big-rehearsal", "Rehearsal dinner", VENUE, "u-orla", 7, { bigDate: true }),
  task("r-cloak", "Book the extra cloakroom attendant", VENUE, "u-aoife", null),
  task("r-playlist", "Agree the first dance with the band", null, null, null),
  done("d-1", "Book the florist", VENUE, "u-aoife", -20, -19),
  done("d-2", "Send the save the dates", GUESTS, "u-orla", -16, -15),
  done("d-3", "Confirm the photographer", VENUE, "u-dara", -9, -10),
  done("d-4", "Taste the cake samples", FOOD, "u-dev", -8, -8),
  done("d-5", "Collect the dietary notes", FOOD, "u-dev", -5, -4),
  done("d-6", "Send the table plan to the venue", GUESTS, "u-aoife", -3, -3),
  done("d-7", "Pay the band deposit", VENUE, "u-orla", -2, -1),
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

export type RiverFixtureState = "busy" | "sparse" | "empty" | "several" | "review";

export function riverFixture(state: RiverFixtureState = "busy"): RiverInput {
  const base = { now: RIVER_FIXTURE_NOW, timeZone: RIVER_FIXTURE_ZONE, viewerId: "u-orla", truncated: false, canAct: true };
  if (state === "sparse" || state === "empty") {
    const project: RiverProjectFact = { id: "p-test", name: "Test project", role: "primary-owner", status: null, targetDate: null, columns, members: { "u-orla": "Orla Byrne" } };
    const tasks: RiverTaskFact[] =
      state === "empty"
        ? []
        : SPARSE_TITLES.map((title, index) => ({
            ...task(`s-${index}`, title, null, null, index === 1 ? -3 : index === 2 ? 0 : index === 3 ? 3 : null),
            projectId: "p-test",
            columnKey: index === 0 ? "done" : index === 4 ? "doing" : "todo",
            completedAt: index === 0 ? at(-2) : null,
          }));
    return { ...base, projects: [project], tasks };
  }
  if (state === "several") {
    const winter: RiverProjectFact = { id: "p-winter", name: "Winter season launch", role: "member", status: "on-track", targetDate: "2026-11-02", columns, members: PEOPLE };
    return {
      ...base,
      projects: [WEDDING, winter],
      tasks: [
        ...WEDDING_TASKS,
        { ...task("w-prices", "Agree the winter price list", null, "u-orla", -7), projectId: "p-winter" },
        { ...task("w-brochure", "Approve the brochure copy", null, "u-orla", 6), projectId: "p-winter" },
      ],
    };
  }
  return { ...base, canAct: state !== "review", projects: [WEDDING], tasks: WEDDING_TASKS };
}
