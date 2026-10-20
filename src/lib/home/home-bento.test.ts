import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_WEEKS, buildHomeBento, launchAction, launchStatus, weekdayOfOrdinal } from "@/lib/home/home-bento";
import { homeBentoFixture } from "@/lib/home/home-bento.fixture";

const model = (state: Parameters<typeof homeBentoFixture>[0] = "busy") => buildHomeBento({ ...homeBentoFixture(state), greetingHour: 9 });

test("weekdays count from Monday, and 1 January 1970 was a Thursday", () => {
  assert.equal(weekdayOfOrdinal(0), 3);
  assert.equal(weekdayOfOrdinal(Math.round(Date.parse("2026-10-19T00:00:00Z") / 86_400_000)), 0);
  assert.equal(weekdayOfOrdinal(-1), 2);
});

test("busy account: greeting, date, and the soonest target date leads", () => {
  const home = model();
  assert.equal(home.greeting, "Good morning, Orla");
  assert.equal(home.dateLabel, "Tuesday 20 October");
  assert.deepEqual(home.launches.map((l) => l.id), ["p-menu", "p-ping", "p-web"]);

  const lead = home.launches[0]!;
  assert.equal(lead.daysLeft, 17);
  assert.equal(lead.done, 5);
  assert.equal(lead.behind, true);
  assert.equal(launchStatus(lead), "2 tasks behind plan");
  assert.equal(launchAction(lead), "Catch up: 3 due this week");
  // A stage whose date has passed without being done would lead; here the next one does.
  assert.deepEqual(lead.stages.map((s) => s.state), ["done", "next", "later", "later"]);
  assert.equal(lead.nextStage?.title, "Tasting");
  // The line ends on today's live count.
  assert.deepEqual(lead.series.at(-1), [lead.todayX, 100 - (5 / 11) * 100]);

  assert.equal(launchStatus(home.launches[1]!), "On track · 1 task ahead");
});

test("the week compares like with like: last week up to the same weekday", () => {
  const { week } = model();
  assert.equal(week.todayIndex, 1);
  assert.deepEqual(week.days.map((d) => d.thisWeek), [5, 4, null, null, null, null, null]);
  assert.deepEqual(week.days.map((d) => d.lastWeek), [2, 2, 1, 0, 1, 0, 0]);
  assert.deepEqual([week.thisSum, week.lastBy, week.lastTotal, week.tone], [9, 4, 6, "ahead"]);
});

test("Monday with nothing done yet is a new week, not a bad one", () => {
  const home = model("monday");
  assert.equal(home.week.tone, "fresh");
  assert.equal(home.week.thisSum, 0);
  assert.equal(home.dueThisWeekTotal, 8, "every Project's due tasks, not only those with a target date");
});

test("the activity year is 53 Monday-first weeks ending this week, and streaks count whole weeks", () => {
  const { activity } = model();
  assert.equal(activity.cells.length, ACTIVITY_WEEKS * 7);
  assert.equal(weekdayOfOrdinal(Math.round(Date.parse(`${activity.cells[0]!.date}T00:00:00Z`) / 86_400_000)), 0);
  assert.equal(activity.cells.filter((c) => c.today).length, 1);
  assert.equal(activity.cells.filter((c) => c.future).length, 5);
  assert.equal(activity.yearTotal, activity.weeks.reduce((a, b) => a + b, 0));
  assert.equal(activity.weeks[activity.currentWeek], 9);
  assert.deepEqual(activity.busiest, { date: "2026-09-30", count: 14 });
  assert.ok(activity.streakWeeks >= 1 && activity.streakWeeks <= activity.bestRun);
});

test("start cards say what they count, and nothing that was not read", () => {
  const busy = model().start;
  assert.deepEqual(busy.tasks, { value: 30, caption: "open across 5 projects" });
  assert.deepEqual(busy.projects, { value: 5, caption: "active, 1 finished" });
  assert.deepEqual(busy.chat, { value: 4, caption: "new mentions and replies in 2 chats" });

  const unread = model("unread");
  assert.equal(unread.historyKnown, false);
  assert.equal(unread.start.files, null);
  assert.equal(unread.dueThisWeekTotal, 0);

  const off = model("chatoff").start;
  assert.deepEqual([off.chat, off.chatAvailable], [null, false]);
});

test("no Projects, and Projects with no target date", () => {
  const none = model("none");
  assert.equal(none.hasProjects, false);
  assert.deepEqual(none.launches, []);
  assert.equal(none.activity.yearTotal, 0);
  assert.equal(none.activity.streakWeeks, 0);
  assert.equal(model("notarget").launches.length, 0);
});

test("a launch that has passed, has no span, or has no tasks is left out", () => {
  const base = homeBentoFixture("busy");
  const lead = base.launches[1]!;
  const home = buildHomeBento({
    ...base,
    launches: [
      { ...lead, id: "past", target: "2026-10-01" },
      { ...lead, id: "flat", start: "2026-11-06" },
      { ...lead, id: "empty", total: 0, complete: 0 },
      { ...lead, id: "today", target: "2026-10-20" },
    ],
  });
  assert.deepEqual(home.launches.map((l) => [l.id, l.daysLeft]), [["today", 0]]);
});

test("without a finish history a launch draws only what is known: none at the start, the live count today", () => {
  const base = homeBentoFixture("busy");
  const home = buildHomeBento({ ...base, launches: [{ ...base.launches[1]!, completions: [] }] });
  const l = home.launches[0]!;
  assert.deepEqual(l.series, [[0, 100], [l.todayX, 100 - (5 / 11) * 100]]);
});
