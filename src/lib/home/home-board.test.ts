import assert from "node:assert/strict";
import test from "node:test";
import { buildHomeBoard, firstNameOf, formatLongDay, greetingForHour } from "@/lib/home/home-board";
import { HOME_FIXTURE_NOW, homeFixture } from "@/lib/home/home-board.fixture";

const ids = (rows: ReadonlyArray<{ id: string }>) => rows.map((row) => row.id);

test("busy account: only the reader's own work is listed, each task once", () => {
  const board = buildHomeBoard(homeFixture("busy"));
  assert.equal(board.today, "2026-10-05");
  assert.equal(board.dateLabel, "Monday 5 October");
  assert.equal(board.firstName, "Orla");

  assert.deepEqual(ids(board.late), ["t-prices", "t-headcount", "t-brochure"]);
  assert.deepEqual(board.late.map((row) => row.due), ["7 days late", "3 days late", "1 day late"]);
  // A late task that sits in Waiting stays under Late and says so.
  assert.equal(board.late[1]!.note, "in Waiting");
  assert.deepEqual(ids(board.waiting), ["t-lindens"]);

  // Ticked this morning: still listed, as done. A task whose only assignee
  // has left falls to the Project's owner and says nobody holds it.
  assert.deepEqual(ids(board.dueToday), ["t-invoice", "t-left", "t-menus"]);
  assert.equal(board.dueToday[0]!.done, true);
  assert.equal(board.dueToday[1]!.note, "no one assigned");

  assert.deepEqual(ids(board.soon), ["t-seating", "t-marquee", "t-rota"]);
  assert.deepEqual(board.soon.map((row) => row.due), ["Due tomorrow", "Due in 4 days", "Due in 6 days"]);

  // To check: in the check column, put there by someone else. Longest quiet first.
  assert.deepEqual(ids(board.toCheck), ["t-copy", "t-quote"]);
  assert.equal(board.toCheck[0]!.note, "from Seán, no change in 5 days");

  // Someone else's late task, and anything in a wrapped Project, never show.
  const everything = [...board.late, ...board.dueToday, ...board.soon, ...board.toCheck, ...board.waiting].map((row) => row.id);
  assert.equal(everything.includes("t-sign"), false);
  assert.equal(everything.includes("t-thanks"), false);
  assert.equal(new Set(everything).size, everything.length);

  // Three late and two due today still open, plus two to check.
  assert.equal(board.needsYou, 7);
});

test("busy account: the figures are the Projects page's own", () => {
  const board = buildHomeBoard(homeFixture("busy"));
  assert.equal(board.lateEverywhere, 10);
  assert.equal(board.lateWhere, "across your projects");
  assert.equal(board.doneThisWeek, 32);
  assert.equal(board.projectCount, 10);
  assert.deepEqual(
    board.projects.map((project) => [project.id, project.word, project.late, project.date]),
    [
      ["p-winter", "Past its date", 4, "28 Sep"],
      ["p-mara", "At risk", 2, "5 Oct"],
      ["p-barn", "At risk", 3, "10 Oct"],
      ["p-keane", null, 0, "9 Oct"],
      ["p-garden", null, 0, "23 Oct"],
      ["p-newyear", null, 0, "2 Nov"],
      ["p-harvest", null, 1, "7 Nov"],
    ],
  );
  assert.deepEqual(
    { title: board.nextDay?.title, project: board.nextDay?.projectName, days: board.nextDay?.days, day: board.nextDay?.dayLabel, open: board.nextDay?.open, late: board.nextDay?.late },
    { title: "Menu tasting", project: "Mara & Finn’s wedding", days: 0, day: "Monday 5 October", open: 21, late: 2 },
  );
  assert.equal(board.footnote, "3 tasks are due today across your projects. 10 late in all.");
});

test("stuck is the task quiet longest in Waiting, with a nudge only for a current member who is not the reader", () => {
  const board = buildHomeBoard(homeFixture("busy"));
  assert.deepEqual(
    { id: board.stuck?.taskId, rest: board.stuck?.rest, nudge: board.stuck?.nudge, more: board.stuck?.more },
    { id: "t-florist", rest: " has been in Waiting with no change for 7 days.", nudge: "Aoife Brennan", more: 2 },
  );
  // Review mode never sends anything, so it never offers to.
  assert.equal(buildHomeBoard(homeFixture("review")).stuck?.nudge, null);

  // The reader's own waiting task: stuck, but nobody to nudge.
  const input = homeFixture("busy");
  const own = buildHomeBoard({ ...input, tasks: input.tasks.filter((task) => task.id === "t-headcount") });
  assert.equal(own.stuck?.taskId, "t-headcount");
  assert.equal(own.stuck?.nudge, null);
  assert.equal(own.stuck?.more, 0);

  // Two days quiet is not stuck yet, and no Waiting column means no sentence.
  const fresh = buildHomeBoard({ ...input, tasks: input.tasks.filter((task) => task.id === "t-lindens") });
  assert.equal(fresh.stuck, null);
  const noColumn = buildHomeBoard({
    ...input,
    projects: input.projects.map((project) => ({ ...project, columns: project.columns.filter((column) => column.key !== "waiting") })),
  });
  assert.equal(noColumn.stuck, null);
  assert.deepEqual(noColumn.waiting, []);
});

test("sparse account: unassigned work in a Project you own is yours, and undated work is counted, not hidden", () => {
  const board = buildHomeBoard(homeFixture("sparse"));
  assert.deepEqual(ids(board.late), ["s-1"]);
  assert.deepEqual(ids(board.dueToday), ["s-2"]);
  assert.deepEqual(ids(board.soon), ["s-3"]);
  assert.equal(board.late[0]!.note, "no one assigned");
  assert.equal(board.undated, 5);
  assert.equal(board.undatedHref, "/app/tasks?workspaceId=p-test");
  assert.equal(board.needsYou, 2);
  assert.equal(board.lateWhere, "in Test project");
  assert.equal(board.nextDay, null);
  assert.equal(board.stuck, null);
  assert.equal(board.footnote, "1 task is due today across the project. 1 late in all.");

  // The same tasks in a Project the reader only belongs to are not theirs.
  const input = homeFixture("sparse");
  const member = buildHomeBoard({ ...input, projects: input.projects.map((project) => ({ ...project, role: "member" as const })) });
  assert.deepEqual([member.late.length, member.dueToday.length, member.soon.length, member.undated], [0, 0, 0, 0]);
});

test("empty and no-project accounts draw nothing that is not there", () => {
  const empty = buildHomeBoard(homeFixture("empty"));
  assert.deepEqual([empty.needsYou, empty.lateEverywhere, empty.doneThisWeek, empty.projectCount], [0, 0, 0, 1]);
  assert.equal(empty.footnote, null);
  const none = buildHomeBoard(homeFixture("none"));
  assert.equal(none.projectCount, 0);
  assert.equal(none.doneThisWeek, null);
  assert.equal(none.newTaskHref, "/app/tasks?create=task");
});

test("a figure whose read failed is dropped, not guessed", () => {
  const board = buildHomeBoard(homeFixture("partial"));
  assert.equal(board.lateEverywhere, null);
  assert.equal(board.doneThisWeek, null);
  assert.equal(board.nextDay, null);
  // The reader's own lists come from the task read, which did not fail.
  assert.equal(board.late.length > 0, true);
});

test("days are counted in the reader's time zone", () => {
  const input = homeFixture("sparse");
  // 23:30 in Dublin on the 5th is already the 6th in Auckland.
  const late = HOME_FIXTURE_NOW + 14 * 3_600_000;
  assert.equal(buildHomeBoard({ ...input, now: late }).today, "2026-10-05");
  assert.equal(buildHomeBoard({ ...input, now: late, timeZone: "Pacific/Auckland" }).today, "2026-10-06");
  assert.equal(buildHomeBoard({ ...input, now: late }).serverGreeting, "Good evening");
  assert.equal(buildHomeBoard({ ...input, now: late, timeZone: "Pacific/Auckland" }).serverGreeting, "Good morning");
});

test("words", () => {
  assert.equal(formatLongDay("2026-10-03"), "Saturday 3 October");
  assert.deepEqual([0, 4, 5, 11, 12, 17, 18, 23].map(greetingForHour), [
    "Still up",
    "Still up",
    "Good morning",
    "Good morning",
    "Good afternoon",
    "Good afternoon",
    "Good evening",
    "Good evening",
  ]);
  assert.equal(firstNameOf("Orla Byrne"), "Orla");
  assert.equal(firstNameOf("orla@example.com"), null);
  assert.equal(firstNameOf("  "), null);
});
