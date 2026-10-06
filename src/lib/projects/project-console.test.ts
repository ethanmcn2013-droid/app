import assert from "node:assert/strict";
import test from "node:test";
import {
  CONSOLE_DAYS,
  CONSOLE_FILTERS,
  buildConsole,
  consoleEmptyWords,
  consoleGroups,
  daysBetween,
  doneByDay,
  formatConsoleDay,
  formatCountdown,
  initialsOf,
  parseConsoleFilter,
  parseConsoleView,
  type ConsoleProjectInput,
} from "./project-console";
import { consoleFixture } from "./project-console.fixture";

const { today, projects } = consoleFixture();
const model = buildConsole(projects, today);
const row = (id: string) => model.rows.find((r) => r.id === id)!;

test("the address names a view and a tab, and anything else is the default", () => {
  assert.equal(parseConsoleView("cards"), "cards");
  assert.equal(parseConsoleView("list"), "list");
  assert.equal(parseConsoleView("console"), "console");
  assert.equal(parseConsoleView(undefined), "console");
  assert.equal(parseConsoleView(["cards"]), "console");
  assert.equal(parseConsoleFilter("needs-a-look"), "attention");
  assert.equal(parseConsoleFilter("yours"), "mine");
  assert.equal(parseConsoleFilter("wrapped"), "wrapped");
  assert.equal(parseConsoleFilter("events"), "all");
  assert.equal(parseConsoleFilter(undefined), "all");
});

test("how a project is doing is the owner's status plus a passed target date", () => {
  assert.equal(row("p-mara").mark, "at_risk");
  assert.equal(row("p-mara").standing, "attention");
  // Marked on track by its owner, but its target date has gone.
  assert.equal(row("p-winter").mark, "past_date");
  assert.equal(row("p-winter").standing, "attention");
  // The line under the name leads with the passed date, never "On track".
  assert.equal(row("p-winter").sub, "Past its date · was due 28 Sep");
  assert.equal(row("p-winter").markLabel, "Past its target date");
  assert.equal(row("p-keane").mark, "on_track");
  assert.equal(row("p-keane").sub, "On track · target 12 Oct");
  assert.equal(row("p-kitchen").standing, "paused");
  assert.equal(row("p-kitchen").sub, "Paused · target 15 Feb 2027");
  assert.equal(row("p-website").standing, "unset");
  assert.equal(row("p-website").sub, "No status yet");
  // A finished project whose date has passed is simply finished.
  assert.equal(row("p-oconnor").standing, "wrapped");
  assert.equal(row("p-oconnor").mark, "wrapped");
});

test("a passed target date leads the line under the name, and the group and counts agree", () => {
  const base = projects.find((p) => p.id === "p-winter")!;
  const withStatus = (status: "on-track" | "at-risk" | "paused" | "complete" | null) =>
    buildConsole([{ ...base, stats: { ...base.stats!, status } }], today);
  for (const [status, sub] of [
    ["on-track", "Past its date · was due 28 Sep"],
    [null, "Past its date · was due 28 Sep"],
    ["at-risk", "At risk · past its date, was due 28 Sep"],
    ["paused", "Paused · past its date, was due 28 Sep"],
  ] as const) {
    const one = withStatus(status);
    assert.equal(one.rows[0]!.sub, sub);
    assert.equal(one.rows[0]!.mark, "past_date");
    assert.deepEqual(consoleGroups(one, "all").map((group) => [group.label, group.rows.length]), [["Needs a look", 1]]);
    assert.equal(one.counts.attention, 1);
    assert.deepEqual(one.summary[1], { text: "1 needs a look", tone: "risk" });
    assert.doesNotMatch(one.rows[0]!.sub, /On track/);
  }
  // Complete is simply finished, whatever its date.
  const done = withStatus("complete");
  assert.equal(done.rows[0]!.sub, "Wrapped · target 28 Sep");
  assert.equal(done.counts.attention, 0);
  // Not yet passed: the owner's word, then the date.
  assert.equal(row("p-mara").sub, "At risk · target 17 Oct");
});

test("tabs count what they show", () => {
  assert.deepEqual(model.counts, { all: 10, attention: 3, mine: 3, wrapped: 2 });
  for (const filter of CONSOLE_FILTERS) {
    const shown = consoleGroups(model, filter).reduce((sum, group) => sum + group.rows.length, 0);
    assert.equal(shown, model.counts[filter], filter);
  }
});

test("rows are grouped by standing, the most pressing first", () => {
  const groups = consoleGroups(model, "all");
  assert.deepEqual(
    groups.map((group) => [group.label, group.rows.length]),
    [
      ["Needs a look", 3],
      ["On track", 4],
      ["Paused", 1],
      ["No status yet", 2],
    ],
  );
  // Past its date before at risk; then the soonest big date first.
  assert.deepEqual(groups[0]!.rows.map((r) => r.id), ["p-winter", "p-mara", "p-barn"]);
  // A project with no date ahead goes after those with one.
  assert.deepEqual(groups[1]!.rows.map((r) => r.id), ["p-keane", "p-garden", "p-newyear", "p-harvest"]);
  assert.deepEqual(consoleGroups(model, "wrapped").map((group) => group.label), ["Wrapped"]);
  assert.deepEqual(consoleGroups(model, "mine").flatMap((group) => group.rows.map((r) => r.id)), ["p-keane", "p-garden", "p-newyear"]);
});

test("the search narrows by name inside the chosen tab", () => {
  assert.deepEqual(consoleGroups(model, "all", "  WEDDING ").flatMap((group) => group.rows.map((r) => r.id)), ["p-mara"]);
  assert.deepEqual(consoleGroups(model, "wrapped", "wedding").flatMap((group) => group.rows.map((r) => r.id)), ["p-oconnor"]);
  assert.deepEqual(consoleGroups(model, "attention", "kitchen"), []);
});

test("done reads the task counts and says what is left", () => {
  assert.deepEqual(row("p-mara").done, { value: "23 of 44", quiet: false, caption: "21 still open", bar: 23 / 44, barLabel: "23 of 44 tasks done" });
  assert.equal(row("p-website").done.caption, "No tasks yet");
  assert.equal(row("p-website").done.bar, 0);
  assert.equal(row("p-summer").done.caption, "Wrapped");
  assert.equal(row("p-summer").done.bar, 1);
});

test("the next big date is a task marked as one, else the target date", () => {
  assert.equal(row("p-mara").next.value, "Today");
  assert.equal(row("p-mara").next.caption, "Menu tasting · Mon 5 Oct");
  assert.equal(row("p-barn").next.value, "in 5 days");
  assert.equal(row("p-winter").next.value, "7 days late");
  assert.equal(row("p-winter").next.tone, "late");
  assert.equal(row("p-winter").next.bar, 1);
  // No big-date task: the target date stands in, and says so.
  assert.equal(row("p-harvest").next.caption, "Target date · Sat 7 Nov");
  assert.equal(row("p-harvest").next.value, "in 33 days");
  assert.equal(row("p-kitchen").next.caption, "Target date · 15 Feb 2027");
  assert.deepEqual(row("p-website").next, { value: "None", quiet: true, caption: "No big date set", bar: 0, barLabel: "" });
  assert.equal(row("p-summer").next.caption, "Nothing left ahead");
});

test("late shows the count and names the oldest", () => {
  assert.equal(row("p-winter").lateCell.value, "4 tasks");
  assert.equal(row("p-winter").lateCell.caption, "Oldest: Agree the winter price list · 7 days");
  assert.equal(row("p-winter").lateCell.barLabel, "4 of 12 open tasks are late");
  assert.equal(row("p-harvest").lateCell.value, "1 task");
  assert.equal(row("p-harvest").lateCell.caption, "Oldest: Confirm the linen order · 1 day");
  assert.deepEqual(row("p-keane").lateCell, { value: "None", quiet: true, caption: "Nothing late", bar: 0, barLabel: "" });
});

test("lead is the owner, or you", () => {
  assert.deepEqual(row("p-keane").lead, { initials: "OB", name: "You", caption: "You own this" });
  assert.equal(row("p-keane").ledByYou, true);
  assert.deepEqual(row("p-barn").lead, { initials: "TR", name: "Tom Reilly", caption: "You co-own this" });
  assert.deepEqual(row("p-mara").lead, { initials: "AB", name: "Aoife Brennan", caption: "You’re a member" });
  assert.equal(row("p-mara").ledByYou, false);
});

test("a project that cannot be opened says why, and a wrapped one has no reminder", () => {
  assert.equal(row("p-shared").selectable, false);
  assert.match(row("p-shared").sub, /^Two projects share this name/);
  assert.equal(row("p-mara").nudge?.who, "Aoife Brennan");
  assert.equal(row("p-summer").nudge, null);
});

test("the summary line counts active projects only", () => {
  assert.deepEqual(model.summary, [
    { text: "10 active" },
    { text: "3 need a look", tone: "risk" },
    { text: "89 open tasks" },
    { text: "10 late", tone: "late" },
  ]);
  const calm = buildConsole([projects.find((p) => p.id === "p-keane")!], today);
  assert.deepEqual(calm.summary, [{ text: "1 active" }, { text: "4 open tasks" }]);
});

test("the four figures", () => {
  const { attention, nextDate, late, week } = model.cards;
  assert.equal(attention.count, 3);
  assert.equal(attention.active, 10);
  assert.equal(attention.segments.length, 10);
  assert.deepEqual(attention.segments.slice(0, 4).map((s) => s.tone), ["late", "risk", "risk", "calm"]);
  assert.equal(attention.segmentsLabel, "1 past its target date, 2 at risk, 7 not flagged");
  assert.deepEqual(attention.caption, { strong: "Winter season launch", rest: "first · past its target date" });

  // The nearest date still ahead; a late one is not "next".
  assert.deepEqual(nextDate, {
    projectId: "p-mara",
    projectName: "Mara & Finn’s wedding",
    days: 0,
    title: "Menu tasting",
    dateLabel: "Mon 5 Oct",
    complete: 23,
    total: 44,
  });

  assert.equal(late?.total, 10);
  assert.equal(late?.projects, 4);
  assert.deepEqual(late?.segments.map((s) => [s.key, s.weight]), [["p-winter", 4], ["p-barn", 3], ["p-mara", 2], ["p-harvest", 1]]);
  assert.deepEqual(late?.oldest, { projectId: "p-winter", taskId: "t-prices", title: "Agree the winter price list", age: "7 days" });

  assert.equal(week?.total, 32);
  assert.equal(week?.previous, 42);
  assert.equal(week?.rangeLabel, "29 Sep to 5 Oct");
  assert.equal(week?.days.length, 7);
  assert.equal(week?.days[6]!.isToday, true);
  assert.equal(week?.days[6]!.date, today);
  assert.deepEqual(week?.days.map((d) => d.done), [7, 4, 6, 4, 4, 5, 2]);
  assert.deepEqual(week?.busiest, { name: "Mara & Finn’s wedding", done: 15 });
});

test("a figure with no source is dropped, never guessed", () => {
  const noFacts: ConsoleProjectInput[] = projects.map((p) => ({ ...p, facts: null }));
  const partial = buildConsole(noFacts, today);
  assert.equal(partial.cards.week, null);
  // Late still has its counts; it just cannot name the oldest.
  assert.equal(partial.cards.late?.total, 10);
  assert.equal(partial.cards.late?.oldest, null);
  assert.equal(partial.rows.find((r) => r.id === "p-winter")!.lateCell.caption, "Past their dates");
  // With no owner read, a row says so rather than inventing a name.
  assert.deepEqual(partial.rows.find((r) => r.id === "p-mara")!.lead, { initials: null, name: "Owner not shown", caption: "You’re a member" });
  // The target date still gives a next big date.
  assert.equal(partial.cards.nextDate?.title, "Target date");

  const noStats: ConsoleProjectInput[] = projects.map((p) => (p.id === "p-barn" ? { ...p, stats: null, openCount: 11 } : p));
  const unread = buildConsole(noStats, today);
  assert.equal(unread.cards.late, null);
  assert.deepEqual(unread.rows.find((r) => r.id === "p-barn")!.done, {
    value: "11 open",
    quiet: false,
    caption: "The rest shows once it’s open",
    bar: 0,
    barLabel: "",
  });

  const undated = buildConsole([projects.find((p) => p.id === "p-website")!], today);
  assert.equal(undated.cards.nextDate, null);
});

test("an empty account and empty tabs have plain words", () => {
  const empty = buildConsole([], today);
  assert.deepEqual(empty.counts, { all: 0, attention: 0, mine: 0, wrapped: 0 });
  assert.deepEqual(empty.summary, [{ text: "0 active" }, { text: "0 open tasks" }]);
  assert.equal(empty.cards.week, null);
  assert.equal(empty.cards.nextDate, null);
  assert.deepEqual(consoleGroups(empty, "all"), []);
  assert.equal(consoleEmptyWords("all", "").title, "No active projects.");
  assert.equal(consoleEmptyWords("attention", "").calm, true);
  assert.equal(consoleEmptyWords("mine", " barn ").title, "No project called “barn” here.");
  for (const filter of CONSOLE_FILTERS) {
    const words = consoleEmptyWords(filter, "");
    assert.doesNotMatch(`${words.title} ${words.text}`, /!|—/);
  }
});

test("no row or figure uses a word the product does not say", () => {
  const banned = /\b(sprint|epic|backlog|stakeholder|kanban|burndown|velocity|workflow|dashboard|deliverable|okr|milestone|ledger|health)\b|!|—/i;
  const words = JSON.stringify(
    [model.summary, model.cards, model.rows.map((r) => [r.markLabel, r.sub, r.done, r.next, r.lateCell, r.lead])],
    (key, value) => (key === "name" || key === "strong" || key === "projectName" || key === "title" ? undefined : value),
  );
  assert.doesNotMatch(words, banned);
});

test("dates and counts read the same on the server and in the browser", () => {
  assert.equal(daysBetween("2026-10-05", "2026-10-10"), 5);
  assert.equal(daysBetween("2026-10-05", "2026-09-28"), -7);
  assert.equal(daysBetween("2026-10-24", "2026-10-26"), 2); // across the clocks going back
  assert.equal(formatConsoleDay("2026-10-03", "2026-07-16"), "Sat 3 Oct");
  assert.equal(formatConsoleDay("2027-02-15", "2026-10-05"), "15 Feb 2027");
  assert.equal(formatConsoleDay("not a date", "2026-10-05"), "not a date");
  assert.equal(formatCountdown(0), "Today");
  assert.equal(formatCountdown(1), "Tomorrow");
  assert.equal(formatCountdown(12), "in 12 days");
  assert.equal(formatCountdown(-1), "1 day late");
  assert.equal(initialsOf("Orla Byrne"), "OB");
  assert.equal(initialsOf("Orla"), "O");
  assert.equal(initialsOf("Mary Kate O’Brien"), "MO");
  assert.equal(initialsOf("  "), "");
});

test("finished work falls on the reader's own days", () => {
  const now = Date.parse("2026-10-05T09:00:00Z");
  // 23:30 UTC on the 4th is already the 5th in Dublin (UTC+1 in early October).
  const lateEvening = Date.parse("2026-10-04T23:30:00Z");
  const dublin = doneByDay([lateEvening, now, Date.parse("2026-09-22T12:00:00Z"), Date.parse("2026-09-21T12:00:00Z")], now, "Europe/Dublin");
  assert.equal(dublin.length, CONSOLE_DAYS);
  assert.equal(dublin[13], 2);
  assert.equal(dublin[12], 0);
  assert.equal(dublin[0], 1); // 22 Sep is thirteen days back; 21 Sep is outside the fortnight
  const utc = doneByDay([lateEvening, now], now, "UTC");
  assert.equal(utc[13], 1);
  assert.equal(utc[12], 1);
  // A finish stamped after "now" (clock skew) is not counted into a future day.
  assert.deepEqual(doneByDay([now + 3 * 86_400_000], now, "UTC").reduce((a, b) => a + b, 0), 0);
});
