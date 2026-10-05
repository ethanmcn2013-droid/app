/**
 * Files and Analytics models (5 Oct 2026 port): every word and figure the two
 * pages draw is worked out by pure functions over the rows the server read.
 * These pin them against a busy fixture and the founder's sparse account.
 *
 * Run with: node --import tsx --test src/lib/projects/project-files-analytics.test.ts
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { computeProjectAnalytics, LATE_LIST_LIMIT } from "@/lib/projects/project-analytics";
import {
  MATCH_THRESHOLD,
  analyticsSummary,
  answerQuestion,
  answerText,
  matchQuestions,
  parseQuestion,
  portfolioSummary,
  questionsFor,
  type QuestionId,
} from "@/lib/projects/project-analytics-questions";
import { buildWall, parseWallSort } from "@/lib/projects/project-analytics-wall";
import { consoleFixture } from "@/lib/projects/project-console.fixture";
import {
  EMPTY_SCOPE,
  FORMER_MEMBER,
  addedByLabel,
  describeFiles,
  groupTotal,
  markRuns,
  scopeIsEmpty,
  searchFiles,
} from "@/lib/projects/project-files";
import {
  ANALYTICS_FIXTURE_STANDING,
  FIXTURE_NOW_SECONDS,
  analyticsInputFixture,
  filesFixture,
  portfolioFixture,
  sparseAnalyticsInput,
} from "@/lib/projects/project-files-analytics.fixture";

const BANNED = /\b(sprint|epic|backlog|stakeholder|kanban|burndown|velocity|workflow|dashboard|deliverable|okr|swimlane|ledger|overdue)\b|!|—/i;

// ── Files ───────────────────────────────────────────────────────────────────

test("files: the summary, the ways to narrow and where files live come from the rows", () => {
  const files = filesFixture();
  const overview = describeFiles(files, FIXTURE_NOW_SECONDS);
  assert.deepEqual(overview.summary, ["42 files across 14 tasks", "13 added in the last 7 days"]);
  assert.deepEqual(
    overview.chips.map((chip) => [chip.label, chip.count]),
    [
      ["Added this week", 13],
      ["Documents", 19],
      ["Images", 7],
      ["Sheets", 11],
      ["Links", 5],
      ["Added by Orla Byrne", 16],
      ["Added by Aoife Brennan", 12],
      ["Added by Tom Reilly", 9],
    ],
  );
  assert.equal(overview.counts.document + overview.counts.image + overview.counts.sheet + overview.counts.link, 42);
  assert.deepEqual(overview.stores.map((store) => [store.label, store.count]), [["Uploaded", 24], ["Google Drive", 13], ["Links", 5]]);
  // One file, one task, nothing new: the words still agree in number.
  const one = describeFiles([{ ...files[0]!, addedAt: FIXTURE_NOW_SECONDS - 30 * 86_400 }], FIXTURE_NOW_SECONDS);
  assert.deepEqual(one.summary, ["1 file across 1 task", "none added in the last 7 days"]);
  assert.equal(one.chips.some((chip) => chip.label.startsWith("Added")), false, "no people chips for one person, no week chip for no week");
});

test("files: a search matches words in the name, the task, the person and the kind, and nothing else", () => {
  const files = filesFixture();
  const search = (query: string) => searchFiles(files, { ...EMPTY_SCOPE, query }, FIXTURE_NOW_SECONDS);
  assert.deepEqual(search("seating").map((group) => [group.id, group.files.length]), [["name", 3]]);
  // Name matches come first, then files that sit on a matching task.
  assert.deepEqual(search("marquee").map((group) => [group.title, group.files.length]), [
    ["Named “marquee”", 4],
    ["On a task matching “marquee”", 1],
  ]);
  assert.deepEqual(search("AOIFE").map((group) => group.id), ["person"]);
  assert.equal(groupTotal(search("aoife")), 12);
  // Words may sit in different places; every one must be found.
  assert.equal(groupTotal(search("pdf orla")), 12);
  assert.equal(groupTotal(search("pdf orla zebra")), 0);
  assert.deepEqual(search("what did Mara approve"), [], "a question is not answered: no words match, so nothing is shown");
  // Newest first inside a group.
  const seating = search("seating")[0]!.files.map((file) => file.title);
  assert.deepEqual(seating, ["Seating plan v4", "Seating plan v3", "Seating plan v2"]);
});

test("files: narrowing by kind, person and week combines with the words", () => {
  const files = filesFixture();
  const run = (scope: Partial<typeof EMPTY_SCOPE>) => searchFiles(files, { ...EMPTY_SCOPE, ...scope }, FIXTURE_NOW_SECONDS);
  assert.equal(scopeIsEmpty(EMPTY_SCOPE), true);
  // Nothing chosen: everything, split by how lately it was added.
  assert.deepEqual(run({}).map((group) => [group.title, group.files.length]), [["Added in the last 7 days", 13], ["Earlier", 29]]);
  assert.equal(groupTotal(run({ kind: "image" })), 7);
  assert.equal(groupTotal(run({ recent: true })), 13);
  assert.equal(groupTotal(run({ kind: "image", person: "Tom Reilly" })), 5);
  assert.equal(groupTotal(run({ kind: "image", person: "Tom Reilly", query: "barn" })), 1);
  assert.equal(groupTotal(run({ person: FORMER_MEMBER })), 3);
});

test("files: someone who has left is never named", () => {
  const files = filesFixture();
  const former = files.filter((file) => file.addedByFormer);
  assert.equal(former.length, 3);
  for (const file of former) {
    assert.equal(file.addedByName, null);
    assert.equal(addedByLabel(file), "A former member");
  }
  assert.equal(addedByLabel({ addedByName: null, addedByFormer: false }), null, "no uploader recorded is not a former member");
});

test("files: matched words are marked without changing the text", () => {
  const runs = markRuns("Seating plan v4", ["plan", "seat"]);
  assert.equal(runs.map((run) => run.text).join(""), "Seating plan v4");
  assert.deepEqual(runs.filter((run) => run.hit).map((run) => run.text), ["Seat", "plan"]);
  assert.deepEqual(markRuns("Seating plan", []), [{ text: "Seating plan", hit: false }]);
});

// ── Analytics: the library of questions ─────────────────────────────────────

test("questions: a fixed library in four groups, worded for the scope", () => {
  const a = computeProjectAnalytics(analyticsInputFixture());
  const all = questionsFor("all", a);
  assert.deepEqual(all.map((question) => [question.group, question.label, question.hint]), [
    ["Where we stand", "Which projects are in the worst shape?", "Late work against the dates set"],
    ["Where we stand", "What changed this week?", "Last week beside this week"],
    ["People", "Who has too much on?", "Open work for each person"],
    ["People", "What should we do first next week?", "The next 7 days, in order"],
    ["What goes wrong", "What keeps slipping?", "Dates changed more than once"],
    ["What goes wrong", "What is late, and who has it?", "Each late task, oldest first"],
    ["Patterns", "Where is the work sitting?", "Tasks by column and priority"],
    ["Patterns", "How long do things usually take us?", "Days from added to finished"],
  ]);
  assert.equal(questionsFor("one", a)[0]!.label, "Are we on track?");
  // No record of date changes, no question about them: never an empty promise.
  const unread = computeProjectAnalytics(analyticsInputFixture({ dueChanges: null }));
  assert.equal(questionsFor("all", unread).some((question) => question.id === "slip"), false);
  assert.deepEqual(questionsFor("all", unread).map((question) => [question.group, question.id]), [
    ["Where we stand", "shape"],
    ["Where we stand", "late"],
    ["Where we stand", "week"],
    ["People", "who"],
    ["People", "next"],
    ["Patterns", "where"],
    ["Patterns", "long"],
  ], "three groups, none left with a single card");
  assert.equal(parseQuestion("late"), "late");
  assert.equal(parseQuestion("which seating plan did Mara approve"), null);
  assert.equal(parseQuestion(undefined), null);
});

test("questions: typing finds a question by its words, and admits when it has none", () => {
  const questions = questionsFor("all", computeProjectAnalytics(analyticsInputFixture()));
  const best = (typed: string) => matchQuestions(typed, questions)[0]?.id ?? null;
  assert.equal(best("late"), "late");
  assert.equal(best("overdue"), "late");
  assert.equal(best("who is busy"), "who");
  assert.equal(best("what keeps slipping"), "slip");
  assert.equal(best("rescheduled"), "slip");
  assert.equal(best("how long"), "long");
  assert.equal(best("next week"), "next");
  assert.equal(best("what changed"), "week");
  assert.equal(best("worst"), "shape");
  assert.equal(best("where is everything stuck"), "where");
  // Typing the start of a question finds that question.
  assert.equal(best("Who has too"), "who");
  // Anything the library cannot answer gets no answer at all.
  for (const typed of ["which seating plan did Mara approve", "hello there", "write me a summary of the wedding", "", "   "]) {
    assert.deepEqual(matchQuestions(typed, questions), [], typed);
  }
  for (const match of matchQuestions("late", questions)) assert.ok(match.score >= MATCH_THRESHOLD);
});

test("questions: each answer is a sentence of one busy project's own numbers", () => {
  const a = computeProjectAnalytics(analyticsInputFixture());
  const scope = { kind: "one", standing: ANALYTICS_FIXTURE_STANDING } as const;
  const say = (id: QuestionId) => answerText(answerQuestion(id, a, scope));
  assert.deepEqual(analyticsSummary(a).map((item) => item.text), ["17 open", "4 late", "12 done in the last 7 days"]);
  assert.equal(
    say("shape"),
    "4 tasks are late, the oldest by 12 days. 17 tasks are open, 7 due in the next 7 days. In the last 7 days 12 were finished and 14 added. The target date is Sat 17 Oct, in 12 days. It is marked at risk.",
  );
  assert.equal(
    say("week"),
    "12 tasks were finished in the last 7 days, 6 more than the week before. 14 were added. The latest finished was Send the save-the-dates, on Mon 5 Oct.",
  );
  assert.equal(
    say("who"),
    "Orla Byrne holds the most: 8 of the 17 open tasks, 1 of them late. Aoife Brennan has 4 and Tom Reilly 3. 2 have no one assigned.",
  );
  assert.equal(
    say("next"),
    "7 tasks are due in the next 7 days. The first is Approve the seating plan, due today, with Orla Byrne. 4 tasks are already late and come before any of it.",
  );
  assert.equal(
    say("slip"),
    "3 tasks had their date changed more than once in the last 12 weeks. The most is Agree the winter price list, changed 4 times. 14 date changes were recorded in all, on 8 tasks.",
  );
  assert.equal(
    say("late"),
    "4 tasks are past their date. The oldest is Agree the winter price list, 12 days late, with Aoife Brennan. 1 of them has no one assigned. 9 more are due in the next 14 days.",
  );
  assert.equal(say("where"), "10 of the 35 tasks are in To do, and 3 in In progress. 18 are done.");
  assert.equal(
    say("long"),
    "Half of tasks are finished within 3 days of being added. That is from 51 tasks finished in the last 12 weeks. 29 of the 36 with a due date were finished on time.",
  );
  for (const question of questionsFor("one", a)) {
    const answer = answerQuestion(question.id, a, scope);
    assert.doesNotMatch(answerText(answer) + answer.caption + question.label + question.hint, BANNED, `${question.id}: plain words only`);
    assert.doesNotMatch(answerText(answer) + answer.caption, /\b(AI|likely|forecast|predict|because)\b/i, `${question.id}: no forecast, no invented reason`);
    assert.ok(answer.actions.length >= 1, `${question.id}: an answer ends in something to do`);
    assert.ok(answer.parts.some((part) => part.strong), `${question.id}: the sentence turns on a figure`);
  }
});

test("questions: across every project the same answers name the project a task is in", () => {
  const { input, projects, today } = portfolioFixture();
  const a = computeProjectAnalytics(input);
  const wall = buildWall(projects, today);
  const scope = { kind: "all", wall } as const;
  const say = (id: QuestionId) => answerText(answerQuestion(id, a, scope));
  assert.deepEqual(portfolioSummary(wall, a).map((item) => item.text), [
    "4 active projects",
    "2 need a look",
    "17 open tasks",
    "4 late",
    "12 done in the last 7 days",
  ]);
  // The wall and the calculation count the same work.
  assert.equal(wall.cards.reduce((sum, card) => sum + card.open, 0), a.open.count);
  assert.equal(wall.cards.reduce((sum, card) => sum + card.late, 0), a.overdue.count);
  assert.equal(wall.cards.reduce((sum, card) => sum + (card.week?.done ?? 0), 0), a.recent.finishedThisWeek);
  assert.equal(
    say("shape"),
    "2 of 4 active projects need a look. Winter season launch is past its target date with 1 late; Mara & Finn’s wedding is marked at risk with 2 late. 4 tasks are late across them, most in Mara & Finn’s wedding (2).",
  );
  assert.equal(
    say("late"),
    "4 tasks are past their date. The oldest is Agree the winter price list in Winter season launch, 12 days late, with Aoife Brennan. 1 of them has no one assigned. 9 more are due in the next 14 days.",
  );
  assert.equal(
    say("next"),
    "7 tasks are due in the next 7 days. The first is Approve the seating plan in Mara & Finn’s wedding, due today, with Orla Byrne. 4 tasks are already late and come before any of it.",
  );
  assert.equal(
    say("slip"),
    "3 tasks had their date changed more than once in the last 12 weeks. The most is Agree the winter price list in Winter season launch, changed 4 times. 14 date changes were recorded in all, on 8 tasks.",
  );
  assert.equal(a.late.every((task) => typeof task.project === "string"), true);
  // No projects, or a list that could not be read, is said plainly.
  assert.equal(answerText(answerQuestion("shape", a, { kind: "all", wall: buildWall([], today) })), "There are no active projects.");
  assert.equal(answerText(answerQuestion("shape", a, { kind: "all", wall: null })), "Your projects could not be listed just now.");
  const calm = buildWall(projects.map((project) => ({ ...project, stats: { ...project.stats, status: "on-track" as const, targetDate: null, overdue: 0 } })), today);
  assert.equal(
    answerText(answerQuestion("shape", a, { kind: "all", wall: calm })),
    "None of the 4 active projects is marked at risk or past its target date. Nothing is late in any of them.",
  );
});

test("questions: the lists are ordered, capped and name current members only", () => {
  const a = computeProjectAnalytics(analyticsInputFixture());
  assert.deepEqual(a.late.map((task) => [task.title, task.daysLate, task.owners]), [
    ["Agree the winter price list", 12, ["Aoife Brennan"]],
    ["Reprint the faded welcome sign", 3, ["Tom Reilly", "Orla Byrne"]],
    ["Chase the florist for the final quote", 2, []],
    ["Renew the bar licence", 1, ["Former member"]],
  ]);
  // Next: by date, and on the same day the higher priority first.
  assert.deepEqual(a.next.tasks.map((task) => [task.title, task.inDays]), [
    ["Approve the seating plan", 0],
    ["Agree the menu with the caterer", 1],
    ["Book the guest coach from Kinsale", 2],
    ["Send the band the running order", 2],
    ["Staff rota for Saturday", 4],
    ["Collect the cake on Friday", 4],
    ["Wet weather plan for the ceremony", 6],
  ]);
  assert.equal(a.next.count, 7);
  // Moved: only tasks changed more than once, most first; a single change is not slipping.
  assert.deepEqual(a.moved && a.moved.tasks.map((task) => [task.title, task.changes, task.done]), [
    ["Agree the winter price list", 4, false],
    ["Chase the florist for the final quote", 3, false],
    ["Order the table linen", 2, true],
  ]);
  assert.deepEqual(a.moved && [a.moved.changes, a.moved.changedTasks, a.moved.repeatCount], [14, 8, 3]);
  // A change recorded for a task this read does not hold is counted, never named.
  const stray = computeProjectAnalytics(analyticsInputFixture({ dueChanges: ["gone", "gone", "gone"] }));
  assert.deepEqual(stray.moved, { changes: 3, changedTasks: 1, repeatCount: 0, tasks: [] });

  const many = computeProjectAnalytics(
    analyticsInputFixture({
      tasks: Array.from({ length: 20 }, (_, index) => ({
        id: `late-${index}`,
        title: `Late ${index}`,
        columnKey: "todo",
        done: false,
        archived: false,
        priority: "p2" as const,
        assigneeIds: [],
        createdAt: null,
        completedAt: null,
        dueAt: Date.parse("2026-09-01T12:00:00Z") + index * 86_400_000,
      })),
    }),
  );
  assert.equal(many.overdue.count, 20);
  assert.equal(many.late.length, LATE_LIST_LIMIT);
  assert.match(answerQuestion("late", many).caption, /^The 8 tasks furthest past their date, oldest first, of 20, with who holds each\./);
});

test("questions: the last fourteen days agree with the weekly figures", () => {
  const a = computeProjectAnalytics(analyticsInputFixture());
  assert.equal(a.recent.days.length, 14);
  assert.deepEqual(a.recent.days.map((day) => day.finished), [1, 1, 1, 0, 1, 1, 1, 2, 1, 1, 2, 1, 3, 2]);
  assert.equal(a.recent.days[13]!.isToday, true);
  assert.equal(a.recent.days[13]!.date, a.today);
  assert.equal(a.recent.finishedThisWeek, 12);
  assert.equal(a.recent.finishedWeekBefore, 6);
  // The same rolling week the weekly chart calls its latest.
  assert.equal(a.recent.finishedThisWeek, a.weeks.at(-1)!.finished);
  assert.equal(a.recent.finished.length, 8, "the list is capped");
  assert.equal(a.recent.finished[0]!.title, "Send the save-the-dates");
});

test("questions: a sparse project gets true, short answers and no invented ones", () => {
  const a = computeProjectAnalytics(sparseAnalyticsInput());
  const say = (id: QuestionId) => answerText(answerQuestion(id, a));
  // No status and no target date were set, so neither is mentioned.
  assert.equal(say("shape"), "1 task is late, the oldest by 1 day. 7 tasks are open, 1 due in the next 7 days. In the last 7 days 2 were finished and 9 added.");
  assert.equal(say("week"), "2 tasks were finished in the last 7 days, and none the week before. 9 were added. The latest finished was Second finished task, on Sun 4 Oct.");
  assert.equal(say("who"), "No one is assigned to any of the 7 open tasks.");
  assert.equal(say("next"), "1 task is due in the next 7 days. The first is Try the board, due on Thu 8 Oct, with no one assigned. 1 task is already late and comes before any of it.");
  assert.equal(say("slip"), "No task had its date changed more than once in the last 12 weeks. 2 date changes were recorded, on 2 tasks.");
  assert.equal(say("late"), "1 task is past its date. It is Add a due date, 1 day late, with no one assigned. 1 more is due in the next 14 days.");
  assert.equal(say("where"), "7 of the 9 tasks are in To do. 2 are done.");
  assert.equal(say("long"), "Half of tasks are finished within 2.5 days of being added. That is from 2 tasks finished in the last 12 weeks.");
});

test("questions: nothing late, nothing open and nothing finished each say so", () => {
  const calm = computeProjectAnalytics(analyticsInputFixture({ tasks: analyticsInputFixture().tasks.filter((task) => task.done), dueChanges: [] }));
  assert.equal(calm.open.count, 0);
  const wrapped = { kind: "one", standing: { status: "complete", targetDate: "2026-09-01" } } as const;
  assert.match(answerText(answerQuestion("shape", calm, wrapped)), /^Nothing is late\. Nothing is open either\. .* It is marked complete\.$/);
  assert.doesNotMatch(answerText(answerQuestion("shape", calm, wrapped)), /target date/, "a finished project's passed date is not trouble");
  assert.equal(answerText(answerQuestion("late", calm)), "Nothing is late. Nothing is open.");
  assert.equal(answerText(answerQuestion("who", calm)), "Nothing is open, so no one is holding anything.");
  assert.equal(answerText(answerQuestion("next", calm)), "Nothing is due in the next 7 days.");
  assert.equal(answerText(answerQuestion("slip", calm)), "No task had its date changed more than once in the last 12 weeks. No date changes were recorded at all.");
  assert.equal(answerText(answerQuestion("where", calm)), "All 18 tasks are done.");

  const passed = computeProjectAnalytics(analyticsInputFixture());
  const text = answerText(answerQuestion("shape", passed, { kind: "one", standing: { status: "on-track", targetDate: "2026-09-28" } }));
  assert.match(text, /The target date, Mon 28 Sep, has passed\. It is marked on track\.$/);

  const idle = computeProjectAnalytics(analyticsInputFixture({ tasks: sparseAnalyticsInput().tasks.filter((task) => !task.done) }));
  assert.equal(answerText(answerQuestion("week", idle)), "Nothing was finished in the last 7 days. Nothing was the week before either. 7 were added.");
  assert.equal(answerText(answerQuestion("long", idle)), "Nothing was finished in the last 12 weeks, so there is no time to measure yet.");
});

// ── Analytics: every project ────────────────────────────────────────────────

test("every project: the cards are the console's rows, needs a look first", () => {
  const { projects, today } = consoleFixture();
  const wall = buildWall(projects, today);
  assert.deepEqual(wall.summary.map((item) => item.text), ["10 active", "3 need a look", "89 open tasks", "10 late"]);
  assert.equal(wall.wrapped, 2);
  assert.deepEqual(wall.cards.map((card) => card.id), [
    "p-winter", "p-mara", "p-barn", "p-keane", "p-garden", "p-newyear", "p-harvest", "p-kitchen", "p-website", "p-shared",
  ]);
  const winter = wall.cards[0]!;
  assert.equal(winter.markLabel, "Past its target date");
  assert.equal(winter.tone, "late");
  assert.equal(winter.lead, "Seán Kavanagh leads");
  assert.deepEqual(winter.next && { when: winter.next.when, late: winter.next.late }, { when: "7 days late", late: true });
  assert.equal(winter.late, 4);
  const mara = wall.cards[1]!;
  assert.equal(mara.tone, "risk");
  assert.deepEqual(mara.done && [mara.done.complete, mara.done.total], [23, 44]);
  assert.equal(mara.week?.done, 15);
  assert.equal(mara.week?.days.length, 14);
  assert.equal(mara.oldestLate, "Reprint the faded welcome sign");
  assert.equal(wall.cards.find((card) => card.id === "p-keane")!.lead, "You lead");
  assert.equal(
    wall.weekLine,
    "32 tasks finished across these projects in the last 7 days, most in Mara & Finn’s wedding (15). The week before: 42.",
  );
});

test("every project: the other orders, and a read that failed drops its figure", () => {
  const { projects, today } = consoleFixture();
  assert.deepEqual(buildWall(projects, today, "late").cards.slice(0, 3).map((card) => card.id), ["p-winter", "p-barn", "p-mara"]);
  assert.deepEqual(buildWall(projects, today, "date").cards.slice(0, 3).map((card) => card.id), ["p-winter", "p-mara", "p-keane"]);
  assert.deepEqual(buildWall(projects, today, "name").cards.slice(0, 2).map((card) => card.id), ["p-barn", "p-garden"]);
  assert.equal(parseWallSort("late"), "late");
  assert.equal(parseWallSort("anything"), "look");

  const partial = buildWall(projects.map((project) => ({ ...project, facts: null, stats: null })), today);
  assert.equal(partial.weekLine, null, "no finished-work read, no line about the week");
  for (const card of partial.cards) {
    assert.equal(card.week, null);
    assert.equal(card.done, null);
    assert.equal(card.lead === null || card.lead === "You lead", true, "an owner that was not read is not named");
  }
  assert.deepEqual(buildWall([], today).cards, []);
});
