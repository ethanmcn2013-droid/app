import assert from "node:assert/strict";
import test from "node:test";
import {
  areaName,
  buildRiver,
  packRiverLane,
  riverCounts,
  riverDayOf,
  riverDueLabel,
  riverIso,
  riverLaneStats,
  riverLong,
  riverMonday,
  riverRelative,
  riverShort,
  riverWeeks,
  riverWith,
  riverWithDay,
} from "@/lib/home/overview-river";
import { riverFixture } from "@/lib/home/overview-river.fixture";
import { formatDueLabelOn } from "@/components/app/detail-panel/due-calendar";

test("busy Project: standing, target date and counts are its own", () => {
  const river = buildRiver(riverFixture("busy"));
  assert.equal(river.today, "2026-10-05");
  assert.equal(river.name, "Mara & Finn’s wedding");
  assert.deepEqual([river.mark, river.markLabel], ["at_risk", "At risk"]);
  assert.equal(river.lead, "8 days to the target date, Tue 13 Oct.");
  assert.deepEqual(river.destination, { day: 8, title: "Mara & Finn’s wedding", meta: "Tue 13 Oct, in 8 days" });
  assert.deepEqual(riverCounts(river.items), { open: 19, late: 2, undated: 2, doneLastWeek: 3 });
  assert.equal(river.tasksHref, "/app/tasks?workspaceId=p-mara");
  // A whole number of weeks, starting on a Monday, with room either side.
  assert.equal(riverWithDay(river.today, river.r0).startsWith("Mon"), true);
  assert.equal((river.r1 - river.r0 + 1) % 7, 0);
  assert.equal(river.r0 <= -28 && river.r1 >= 35, true);
});

test("Areas are labels in sentence case; People are current members; Status is the board's columns in use", () => {
  const river = buildRiver(riverFixture("busy"));
  assert.deepEqual(river.lenses.map((lens) => lens.id), ["areas", "people", "status"]);
  assert.deepEqual(river.lenses[0]!.lanes.map((lane) => lane.name), ["Food and drink", "Guests and seating", "Venue and hire", "No area yet"]);
  assert.deepEqual(river.lenses[1]!.lanes.map((lane) => lane.name), ["Aoife Brennan", "Dara Hayes", "Dev Patel", "Orla Byrne", "Tomás Reilly", "No one yet"]);
  assert.deepEqual(river.lenses[2]!.lanes.map((lane) => lane.name), ["To do", "In progress", "Review", "Waiting"]);
  assert.deepEqual(riverLaneStats(river.items, "areas", "food-and-drink", river.today), { open: 7, late: 1, done: 2, next: "Next: Menu tasting, 5 Oct" });
  // No lane wears a warning colour.
  for (const lens of river.lenses) for (const lane of lens.lanes) assert.doesNotMatch(lane.hue, /project-[567]\)/);
  assert.equal(areaName("food-and-drink"), "Food and drink");
  assert.equal(areaName("VIP_guests"), "VIP guests");
});

test("a task is late, due, undated or done by its own date and column; a big date is a task marked as one", () => {
  const river = buildRiver(riverFixture("busy"));
  const by = (id: string) => river.items.find((item) => item.id === id)!;
  assert.deepEqual([by("r-sign").day, by("r-sign").late, by("r-sign").owner?.name], [-3, true, "Dara Hayes"]);
  assert.deepEqual([by("r-big-tasting").kind, by("r-big-tasting").day], ["big", 0]);
  assert.deepEqual([by("r-cloak").day, by("r-cloak").late], [null, false]);
  assert.deepEqual([by("d-7").done, by("d-7").doneDay, by("d-7").late], [true, -1, false]);
  assert.deepEqual([by("r-numbers").waiting, by("r-numbers").statusName], [true, "Waiting"]);
  // Nobody outside the Project's current members is named.
  const input = riverFixture("busy");
  const gone = buildRiver({ ...input, tasks: [{ ...input.tasks[0]!, assignees: ["u-gone"] }] });
  assert.equal(gone.items[0]!.owner, null);
  assert.equal(gone.items[0]!.lanes.people, "none");
});

test("weeks carry what is due ahead and what was finished behind", () => {
  const river = buildRiver(riverFixture("busy"));
  const weeks = riverWeeks(river.items, river.r0, river.r1);
  const at = (start: number) => weeks.find((week) => week.start === start)!;
  assert.equal(riverMonday(river.today, 0), 0, "the fixture's today is a Monday");
  assert.deepEqual(at(0), { start: 0, due: 11, done: 0 });
  assert.deepEqual(at(7), { start: 7, due: 4, done: 0 });
  assert.deepEqual(at(-7), { start: -7, due: 2, done: 3 });
  assert.equal(weeks.reduce((sum, week) => sum + week.due, 0), 17, "every dated open task falls in one week");
});

test("a change the server confirmed shows everywhere at once", () => {
  const river = buildRiver(riverFixture("busy"));
  const finished = riverWith(river.items, "r-sign", { done: true });
  assert.deepEqual(riverCounts(finished), { open: 18, late: 1, undated: 2, doneLastWeek: 4 });
  const dated = riverWith(river.items, "r-cloak", { day: 4 });
  assert.deepEqual(riverCounts(dated), { open: 19, late: 2, undated: 1, doneLastWeek: 3 });
  assert.equal(riverLaneStats(dated, "areas", "venue-and-hire", river.today).open, 6);
  const cleared = riverWith(dated, "r-cloak", { day: null });
  assert.deepEqual(riverCounts(cleared), riverCounts(river.items));
});

test("sparse Project: no labels means no Areas, and the columns in use lead", () => {
  const river = buildRiver(riverFixture("sparse"));
  assert.deepEqual(river.lenses.map((lens) => lens.id), ["status", "people"]);
  assert.deepEqual(river.lenses[0]!.lanes.map((lane) => lane.name), ["To do", "In progress"]);
  assert.deepEqual(river.lenses[1]!.lanes.map((lane) => lane.name), ["No one yet"]);
  assert.deepEqual([river.mark, river.lead, river.destination], ["unset", "No target date set.", null]);
  assert.deepEqual(riverCounts(river.items), { open: 8, late: 1, undated: 5, doneLastWeek: 1 });
});

test("an empty Project and a read across Projects", () => {
  const empty = buildRiver(riverFixture("empty"));
  assert.deepEqual(empty.items, []);
  assert.deepEqual(empty.lenses.map((lens) => [lens.id, lens.lanes.length]), [["status", 0]]);
  const several = buildRiver(riverFixture("several"));
  assert.deepEqual([several.single, several.name, several.lead, several.mark, several.destination], [false, "All projects", "2 projects.", null, null]);
  assert.deepEqual(several.lenses.map((lens) => lens.lanes.map((lane) => lane.name)), [["Mara & Finn’s wedding", "Winter season launch"]]);
  assert.equal(several.tasksHref, "/app/tasks");
});

test("a target date that is today or has passed says so plainly", () => {
  const input = riverFixture("busy");
  const on = (targetDate: string) => buildRiver({ ...input, projects: [{ ...input.projects[0]!, targetDate }] });
  assert.equal(on("2026-10-05").lead, "The target date is today.");
  assert.equal(on("2026-10-02").lead, "The target date was Fri 2 Oct.");
  assert.equal(on("2026-10-02").mark, "past_date");
  assert.equal(on("not a date").destination, null);
});

test("packing: every task keeps its day; labels give way before work does", () => {
  const river = buildRiver(riverFixture("busy"));
  const list = river.items.filter((item) => !item.done && item.day !== null && item.lanes.areas === "food-and-drink");
  const xOf = (day: number) => (day - river.r0) * 36;
  const packed = packRiverLane(list, xOf, { rows: 8, avatars: true, maxX: 4000 });
  assert.equal(packed.placed.length, list.length);
  for (const placed of packed.placed) assert.equal(placed.x, xOf(placed.item.day!));
  assert.equal(packed.placed.find((placed) => placed.item.id === "r-olives")!.badge, "2 days late");
  assert.equal(packed.placed.find((placed) => placed.item.id === "r-menus")!.badge, "Due today");
  // No two marks on one row overlap.
  for (const a of packed.placed) for (const b of packed.placed) if (a !== b && a.row === b.row) assert.notEqual(a.x, b.x);
  // With one row and no room, nothing is dropped: marks stay, words go.
  const tight = packRiverLane(list, (day) => (day - river.r0) * 4, { rows: 1, avatars: true, maxX: 400 });
  assert.equal(tight.placed.length, list.length);
  assert.equal(tight.rows, 1);
  assert.equal(tight.placed.some((placed) => placed.label === 0), true);
});

test("a date set from the week view is labelled exactly as the task panel's calendar labels it", () => {
  const today = "2026-10-05";
  const local = (iso: string) => {
    const [year, month, date] = iso.split("-").map(Number);
    return new Date(year!, month! - 1, date!);
  };
  for (const day of [-30, -1, 0, 1, 2, 5, 6, 7, 8, 27, 40, 120]) {
    assert.equal(riverDueLabel(today, day), formatDueLabelOn(local(riverIso(today, day)), local(today)), `day ${day}`);
  }
  assert.deepEqual([0, 1, 4, 7].map((day) => riverDueLabel(today, day)), ["Today", "Tomorrow", "Fri", "12 Oct"]);
});

test("dates and words", () => {
  const today = "2026-10-05";
  assert.equal(riverIso(today, 4), "2026-10-09");
  assert.equal(riverDayOf(today, "2026-10-09"), 4);
  assert.equal(riverShort(today, -10), "25 Sep");
  assert.equal(riverShort(today, 100), "13 Jan 2027");
  assert.equal(riverWithDay(today, 8), "Tue 13 Oct");
  assert.equal(riverLong(today, 7), "12 October");
  assert.equal(riverMonday(today, 6), 0);
  assert.equal(riverMonday(today, -1), -7);
  assert.deepEqual([0, 1, -1, 5, -3].map(riverRelative), ["today", "tomorrow", "yesterday", "in 5 days", "3 days ago"]);
});
