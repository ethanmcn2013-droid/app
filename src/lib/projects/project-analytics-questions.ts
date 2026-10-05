/**
 * Analytics, "Ask": a library of plain questions the product's own numbers
 * can answer exactly, each answered by one sentence.
 *
 * This is not a language model and nothing here pretends to be one. Typing in
 * the ask box finds a question in the library by its words (keywords, light
 * stemming and a few synonyms, `matchQuestions`); when nothing matches, the
 * page says so and shows the questions it has. An answer is arithmetic over
 * `ProjectAnalytics` (one pure calculation over tasks) and, for how projects
 * are doing, the status and target date their owners set. No forecast is
 * made and no reason is invented: an answer says what is late, open, finished,
 * dated and held, and leaves the judgement to the reader.
 *
 * Pure and client-safe; pinned by `project-files-analytics.test.ts`.
 */

import { formatDays, plural, type ProjectAnalytics } from "@/lib/projects/project-analytics";
import type { WallModel } from "@/lib/projects/project-analytics-wall";
import { daysBetween, formatConsoleDay, formatCountdown } from "@/lib/projects/project-console";
import { targetDatePassed, type ProjectStatus } from "@/lib/projects/project-hub";

export type QuestionId = "shape" | "week" | "who" | "next" | "slip" | "late" | "where" | "long";

export type QuestionGroup = "Where we stand" | "People" | "What goes wrong" | "Patterns";

export const QUESTION_GROUPS: readonly QuestionGroup[] = ["Where we stand", "People", "What goes wrong", "Patterns"];

type QuestionSpec = Readonly<{
  id: QuestionId;
  group: QuestionGroup;
  /** The question as asked across every project. */
  all: string;
  /** The same question about one project, where the words differ. */
  one?: string;
  hint: string;
  /** Keyword stems and their weights. */
  words: Readonly<Record<string, number>>;
}>;

const SPECS: readonly QuestionSpec[] = [
  {
    id: "shape",
    group: "Where we stand",
    all: "Which projects are in the worst shape?",
    one: "Are we on track?",
    hint: "Late work against the dates set",
    words: { track: 5, course: 5, shape: 5, worst: 6, risk: 4, trouble: 5, status: 4, date: 3, deadline: 4, target: 4, ready: 3, okay: 3, fine: 3, struggl: 5, project: 2, doing: 2, behind: 3 },
  },
  {
    id: "week",
    group: "Where we stand",
    all: "What changed this week?",
    hint: "Last week beside this week",
    words: { chang: 5, week: 3, new: 2, differ: 4, happen: 3, update: 3, since: 2, compar: 2, last: 1, done: 4, finish: 4, complet: 4, progress: 3 },
  },
  {
    id: "who",
    group: "People",
    all: "Who has too much on?",
    hint: "Open work for each person",
    words: { who: 3, busy: 5, swamp: 6, much: 3, load: 5, overload: 6, person: 3, people: 3, team: 2, plate: 4, stretch: 4, assign: 4, own: 3, hold: 3, unassign: 5 },
  },
  {
    id: "next",
    group: "People",
    all: "What should we do first next week?",
    hint: "The next 7 days, in order",
    words: { first: 5, next: 4, priorit: 6, start: 3, focus: 5, should: 2, monday: 4, plan: 3, order: 2, important: 4, urgent: 4, due: 4, upcoming: 5, soon: 4, tomorrow: 4, today: 3 },
  },
  {
    id: "slip",
    group: "What goes wrong",
    all: "What keeps slipping?",
    hint: "Dates changed more than once",
    words: { slip: 6, keep: 2, move: 4, moved: 4, delay: 5, push: 4, reschedul: 6, postpon: 5, again: 2, shift: 4, chang: 1 },
  },
  {
    id: "late",
    group: "What goes wrong",
    all: "What is late, and who has it?",
    hint: "Each late task, oldest first",
    words: { late: 6, overdue: 6, behind: 4, miss: 4, past: 3, oldest: 3, why: 1 },
  },
  {
    id: "where",
    group: "Patterns",
    all: "Where is the work sitting?",
    hint: "Tasks by column and priority",
    words: { where: 3, sit: 4, column: 5, stage: 4, status: 2, stuck: 4, wait: 3, board: 3, priorit: 2, pile: 3, bottleneck: 5 },
  },
  {
    id: "long",
    group: "Patterns",
    all: "How long do things usually take us?",
    hint: "Days from added to finished",
    words: { long: 5, take: 4, usual: 4, average: 4, typical: 4, day: 2, quick: 3, fast: 3, slow: 4, duration: 5, time: 3 },
  },
];

export type Question = Readonly<{ id: QuestionId; group: QuestionGroup; label: string; hint: string }>;

/**
 * The library for a scope. A question without its data is left out, not shown
 * empty: with no record of date changes, "What keeps slipping?" goes, and the
 * late question moves up beside how things stand so no group is left with one
 * card.
 */
export function questionsFor(scope: "all" | "one", analytics: ProjectAnalytics | null): Question[] {
  const hasMoves = analytics === null || analytics.moved !== null;
  const specs = hasMoves ? SPECS : SPECS.filter((spec) => spec.id !== "slip");
  const ordered = hasMoves ? specs : [specs[0]!, specs.find((spec) => spec.id === "late")!, ...specs.slice(1).filter((spec) => spec.id !== "late")];
  return ordered.map((spec) => ({
    id: spec.id,
    group: !hasMoves && spec.id === "late" ? "Where we stand" : spec.group,
    label: scope === "one" ? spec.one ?? spec.all : spec.all,
    hint: spec.hint,
  }));
}

/** The `?ask=` value. Null is the list of questions. */
export function parseQuestion(raw: unknown): QuestionId | null {
  return SPECS.find((spec) => spec.id === raw)?.id ?? null;
}

// ── Finding a question by its words ────────────────────────────────────────

const STOP = new Set(["the", "a", "an", "is", "are", "we", "us", "our", "do", "does", "did", "to", "of", "in", "on", "for", "and", "what", "which", "how", "it", "this", "that", "my", "me", "i", "be", "has", "have", "too", "s"]);

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Light stemming: enough for "slipping" to find "slip" and "changes" "chang". */
function stem(word: string): string {
  return word.replace(/(ing|ed|es|s|e)$/, "").replace(/(.)\1$/, "$1");
}

function hits(token: string, key: string): boolean {
  if (token === key) return true;
  const a = stem(token);
  const b = stem(key);
  if (a.length < 3 || b.length < 3) return a === b;
  return a.startsWith(b) || b.startsWith(a);
}

export type QuestionMatch = Readonly<{ id: QuestionId; score: number }>;

/** At or above this a match is offered; below it the box says it has no ready answer. */
export const MATCH_THRESHOLD = 4;

/**
 * The library's questions that share words with what was typed, best first.
 * Empty when nothing clears the threshold: an answer to a different question
 * is worse than none.
 */
export function matchQuestions(input: string, questions: readonly Question[]): QuestionMatch[] {
  const typed = tokens(input);
  if (typed.length === 0) return [];
  const whole = input.trim().toLowerCase();
  return questions
    .map((question) => {
      const spec = SPECS.find((entry) => entry.id === question.id)!;
      const labelWords = tokens(question.label).filter((word) => !STOP.has(word));
      let score = 0;
      for (const token of typed) {
        if (STOP.has(token)) continue;
        let best = 0;
        for (const [key, weight] of Object.entries(spec.words)) if (hits(token, key)) best = Math.max(best, weight);
        // Words in the question itself count, so typing part of it finds it.
        if (best === 0 && token.length >= 3 && labelWords.some((word) => hits(token, word))) best = 3;
        score += best;
      }
      if (whole.length > 3 && question.label.toLowerCase().startsWith(whole)) score += 6;
      return { id: question.id, score };
    })
    .filter((match) => match.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

// ── Answers ────────────────────────────────────────────────────────────────

/** What the owner set on the Project. Both may be absent. */
export type ProjectStanding = Readonly<{ status: ProjectStatus; targetDate: string | null }>;

export const NO_STANDING: ProjectStanding = { status: null, targetDate: null };

/** What an answer is about: every project the reader can open, or one. */
export type AnswerScope =
  | Readonly<{ kind: "all"; wall: WallModel | null }>
  | Readonly<{ kind: "one"; standing: ProjectStanding }>;

export type AnswerPart = Readonly<{
  text: string;
  /** The figure the sentence turns on. */
  strong?: boolean;
  tone?: "late" | "risk";
  /** Drawn as a link to this task. */
  taskId?: string;
}>;

export type AnswerAction = Readonly<{
  label: string;
  kind: "question" | "tasks" | "task" | "timeline" | "projects";
  /** A question id or a task id, by `kind`. */
  target?: string;
}>;

export type Answer = Readonly<{
  id: QuestionId;
  question: string;
  parts: readonly AnswerPart[];
  actions: readonly AnswerAction[];
  /** One line under the chart saying what is drawn. */
  caption: string;
}>;

type Body = Pick<Answer, "parts" | "actions" | "caption">;

const STATUS_WORDS: Readonly<Record<Exclude<ProjectStatus, null>, string>> = {
  "on-track": "on track",
  "at-risk": "at risk",
  paused: "paused",
  complete: "complete",
};

function tasks(n: number): string {
  return `${n} ${plural(n, "task")}`;
}

function inProject(project: string | undefined): string {
  return project ? ` in ${project}` : "";
}

function trackAnswer(a: ProjectAnalytics, standing: ProjectStanding): Body {
  const parts: AnswerPart[] = [];
  const late = a.overdue.count;
  const dueSoon = a.next.count;

  if (late > 0) {
    parts.push({ text: `${tasks(late)} ${plural(late, "is", "are")} late`, strong: true, tone: "late" });
    parts.push({ text: `, the oldest by ${a.overdue.oldestDays} ${plural(a.overdue.oldestDays, "day")}. ` });
  } else {
    parts.push({ text: "Nothing is late.", strong: true });
    parts.push({ text: " " });
  }

  if (a.open.count === 0) {
    parts.push({ text: "Nothing is open either. " });
  } else {
    parts.push({ text: `${tasks(a.open.count)} ${plural(a.open.count, "is", "are")} open` });
    parts.push({ text: dueSoon > 0 ? `, ${dueSoon} due in the next 7 days. ` : ", none due in the next 7 days. " });
  }

  const { finishedThisWeek, addedThisWeek } = a.recent;
  parts.push({
    text:
      finishedThisWeek === 0 && addedThisWeek === 0
        ? "Nothing was finished or added in the last 7 days."
        : `In the last 7 days ${finishedThisWeek} ${plural(finishedThisWeek, "was", "were")} finished and ${addedThisWeek} added.`,
  });

  const target = standing.targetDate?.slice(0, 10) ?? null;
  if (target) {
    if (targetDatePassed(target, standing.status, a.today)) {
      parts.push({ text: " " });
      parts.push({ text: `The target date, ${formatConsoleDay(target, a.today)}, has passed.`, strong: true, tone: "late" });
    } else if (standing.status !== "complete") {
      const days = daysBetween(a.today, target);
      parts.push({ text: " The target date is " });
      parts.push({ text: formatConsoleDay(target, a.today), strong: true });
      parts.push({ text: `, ${formatCountdown(days).toLowerCase()}.` });
    }
  }
  if (standing.status) {
    parts.push({ text: " It is marked " });
    parts.push({ text: STATUS_WORDS[standing.status], strong: true, tone: standing.status === "at-risk" ? "risk" : undefined });
    parts.push({ text: "." });
  }

  return {
    parts,
    actions: [
      late > 0 ? { label: "See what is late", kind: "question", target: "late" } : { label: "Open Tasks", kind: "tasks" },
      { label: "Compare every project", kind: "projects" },
    ],
    caption: `Bars are tasks finished each week over the last ${a.range.phrase}; the line is tasks added. Each week is seven days, the last one ending today.`,
  };
}

function shapeAnswer(wall: WallModel | null): Body {
  const caption = "One row per active project, the ones that need a look first: how its owner marked it, its next date, how much is done and how much is late.";
  const actions: AnswerAction[] = [{ label: "See every project", kind: "projects" }, { label: "See what is late", kind: "question", target: "late" }];
  if (!wall || wall.cards.length === 0) {
    return {
      parts: [{ text: wall ? "There are no active projects." : "Your projects could not be listed just now.", strong: true }],
      actions: [{ label: "See every project", kind: "projects" }],
      caption,
    };
  }
  const looks = wall.cards.filter((card) => card.tone !== "calm");
  const total = wall.cards.length;
  const lateTotal = wall.cards.reduce((sum, card) => sum + card.late, 0);
  const parts: AnswerPart[] = [];
  const describe = (card: (typeof looks)[number]) =>
    `${card.name} is ${card.mark === "past_date" ? "past its target date" : "marked at risk"}${card.late > 0 ? ` with ${card.late} late` : ""}`;
  if (looks.length === 0) {
    parts.push({ text: `None of the ${total === 1 ? "1 active project is" : `${total} active projects is`} marked at risk or past its target date.`, strong: true });
  } else {
    parts.push({
      text: `${looks.length} of ${total} active ${plural(total, "project")} ${plural(looks.length, "needs", "need")} a look.`,
      strong: true,
      tone: looks.some((card) => card.tone === "late") ? "late" : "risk",
    });
    parts.push({ text: ` ${describe(looks[0]!)}${looks[1] ? `; ${describe(looks[1])}` : ""}.` });
  }
  const worstLate = [...wall.cards].sort((x, y) => y.late - x.late || x.name.localeCompare(y.name, "en"))[0]!;
  parts.push({
    text:
      lateTotal === 0
        ? " Nothing is late in any of them."
        : ` ${tasks(lateTotal)} ${plural(lateTotal, "is", "are")} late across them${total > 1 && worstLate.late > 0 ? `, most in ${worstLate.name} (${worstLate.late})` : ""}.`,
  });
  return { parts, actions: lateTotal > 0 ? actions : [actions[0]!], caption };
}

function lateAnswer(a: ProjectAnalytics): Body {
  const late = a.overdue.count;
  const dated = a.upcoming.total;
  if (late === 0 || a.late.length === 0) {
    return {
      parts: [
        { text: "Nothing is late.", strong: true },
        {
          text:
            dated > 0
              ? ` ${tasks(dated)} ${plural(dated, "is", "are")} due in the next 14 days.`
              : a.open.count > 0
                ? " No open task has a date in the next 14 days."
                : " Nothing is open.",
        },
      ],
      actions: [{ label: "See the timeline", kind: "timeline" }, { label: "Open Tasks", kind: "tasks" }],
      caption: "Each bar is a day in the next two weeks; its height is the number of open tasks due that day.",
    };
  }
  const oldest = a.late[0]!;
  const holder =
    oldest.owners.length === 0
      ? ", with no one assigned"
      : `, with ${oldest.owners.slice(0, 2).join(" and ")}${oldest.owners.length > 2 ? " and others" : ""}`;
  const unheld = a.late.filter((task) => task.owners.length === 0).length;
  return {
    parts: [
      { text: `${tasks(late)} ${plural(late, "is", "are")} past ${plural(late, "its", "their")} date.`, strong: true, tone: "late" },
      { text: late === 1 ? " It is " : " The oldest is " },
      { text: oldest.title, strong: true, taskId: oldest.id },
      { text: `${inProject(oldest.project)}, ${oldest.daysLate} ${plural(oldest.daysLate, "day")} late${holder}.` },
      ...(late > 1 && late === a.late.length && unheld > 0 && !(unheld === 1 && oldest.owners.length === 0)
        ? [{ text: ` ${unheld} of them ${plural(unheld, "has", "have")} no one assigned.` }]
        : []),
      ...(dated > 0 ? [{ text: ` ${dated} more ${plural(dated, "is", "are")} due in the next 14 days.` }] : []),
    ],
    actions: [
      { label: "Open the oldest", kind: "task", target: oldest.id },
      { label: "Open Tasks", kind: "tasks" },
    ],
    caption:
      late > a.late.length
        ? `The ${a.late.length} tasks furthest past their date, oldest first, of ${late}, with who holds each. A bar's length is how many days late it is. The record does not say why a task is late, so no reason is given.`
        : "Every open task past its date, oldest first, with who holds each. A bar's length is how many days late it is. The record does not say why a task is late, so no reason is given.",
  };
}

function weekAnswer(a: ProjectAnalytics): Body {
  const { finishedThisWeek: now, finishedWeekBefore: before, finished, addedThisWeek } = a.recent;
  const caption = "Each bar is a day; the last seven are this week and the seven before sit beside them, quieter. Days follow your time zone.";
  const added = ` ${addedThisWeek} ${plural(addedThisWeek, "was", "were")} added.`;
  if (now === 0) {
    return {
      parts: [
        { text: "Nothing was finished in the last 7 days.", strong: true },
        { text: before > 0 ? ` ${tasks(before)} ${plural(before, "was", "were")} finished the week before.` : " Nothing was the week before either." },
        { text: added },
      ],
      actions: [{ label: "Open Tasks", kind: "tasks" }],
      caption,
    };
  }
  const diff = now - before;
  const latest = finished[0];
  return {
    parts: [
      { text: `${tasks(now)} ${plural(now, "was", "were")} finished in the last 7 days`, strong: true },
      {
        text:
          before === 0
            ? ", and none the week before."
            : diff === 0
              ? ", the same as the week before."
              : `, ${Math.abs(diff)} ${diff > 0 ? "more" : "fewer"} than the week before.`,
      },
      { text: added },
      ...(latest
        ? [
            { text: " The latest finished was " },
            { text: latest.title, strong: true, taskId: latest.id },
            { text: `${inProject(latest.project)}, on ${formatConsoleDay(latest.date, a.today)}.` },
          ]
        : []),
    ],
    actions: [{ label: "Open Tasks", kind: "tasks" }],
    caption,
  };
}

function whoAnswer(a: ProjectAnalytics): Body {
  const caption = `Open tasks per person. Red is late, the darker tone is due this week, the rest is later or undated. Finished counts cover the last ${a.range.phrase}. The page counts work; it does not judge how much is too much.`;
  const actions: AnswerAction[] = [{ label: "Open Tasks", kind: "tasks" }];
  const open = a.open.count;
  if (open === 0) {
    return { parts: [{ text: "Nothing is open", strong: true }, { text: ", so no one is holding anything." }], actions, caption };
  }
  const named = a.people.filter((person) => person.id != null && person.open > 0);
  const top = named[0];
  if (!top) {
    return {
      parts: [{ text: `No one is assigned to ${open === 1 ? "the 1 open task" : `any of the ${open} open tasks`}.`, strong: true, tone: "risk" }],
      actions,
      caption,
    };
  }
  const parts: AnswerPart[] = [
    { text: `${top.name} holds the most: ${top.open} of the ${open} open ${plural(open, "task")}`, strong: true },
    { text: top.overdue > 0 ? `, ${top.overdue} of them late.` : "." },
  ];
  if (named.length > 1) {
    const rest = named.slice(1, 3).map((person, index) => (index === 0 ? `${person.name} has ${person.open}` : `${person.name} ${person.open}`));
    parts.push({ text: ` ${rest.join(" and ")}.` });
  }
  if (a.open.unassigned > 0) {
    parts.push({ text: " " });
    parts.push({ text: `${a.open.unassigned} ${plural(a.open.unassigned, "has", "have")} no one assigned.`, strong: true, tone: "risk" });
  }
  return { parts, actions, caption };
}

function nextAnswer(a: ProjectAnalytics): Body {
  const caption = "Open tasks due today or in the six days after, soonest first; on the same day the higher priority comes first. Late tasks are listed under their own question.";
  const { count, tasks: list } = a.next;
  const late = a.overdue.count;
  const lateNote: AnswerPart[] = late > 0 ? [{ text: ` ${tasks(late)} ${plural(late, "is", "are")} already late and ${plural(late, "comes", "come")} before any of it.` }] : [];
  if (count === 0) {
    return {
      parts: [{ text: "Nothing is due in the next 7 days.", strong: true }, ...lateNote],
      actions: late > 0 ? [{ label: "See what is late", kind: "question", target: "late" }, { label: "Open Tasks", kind: "tasks" }] : [{ label: "Open Tasks", kind: "tasks" }],
      caption,
    };
  }
  const first = list[0]!;
  const when = first.inDays === 0 ? "today" : first.inDays === 1 ? "tomorrow" : `on ${formatConsoleDay(first.due, a.today)}`;
  return {
    parts: [
      { text: `${tasks(count)} ${plural(count, "is", "are")} due in the next 7 days.`, strong: true },
      { text: " The first is " },
      { text: first.title, strong: true, taskId: first.id },
      { text: `${inProject(first.project)}, due ${when}${first.owners.length === 0 ? ", with no one assigned" : `, with ${first.owners.slice(0, 2).join(" and ")}`}.` },
      ...lateNote,
    ],
    actions: [
      { label: "Open the first", kind: "task", target: first.id },
      ...(late > 0 ? [{ label: "See what is late", kind: "question" as const, target: "late" }] : []),
      { label: "See the timeline", kind: "timeline" },
    ],
    caption,
  };
}

function slipAnswer(a: ProjectAnalytics): Body {
  const caption = `Tasks whose due date was changed more than once in the last ${a.range.phrase}, most changes first. This counts each recorded change to a date, including the first time one was set; it does not record how far a date moved or why.`;
  const actions: AnswerAction[] = [{ label: "Open Tasks", kind: "tasks" }];
  const moved = a.moved;
  if (!moved) {
    return { parts: [{ text: "The record of date changes could not be read just now.", strong: true }], actions, caption };
  }
  if (moved.repeatCount === 0) {
    return {
      parts: [
        { text: `No task had its date changed more than once in the last ${a.range.phrase}.`, strong: true },
        { text: moved.changes > 0 ? ` ${moved.changes} date ${plural(moved.changes, "change was", "changes were")} recorded, on ${tasks(moved.changedTasks)}.` : " No date changes were recorded at all." },
      ],
      actions,
      caption,
    };
  }
  const top = moved.tasks[0]!;
  return {
    parts: [
      { text: `${tasks(moved.repeatCount)} had ${plural(moved.repeatCount, "its", "their")} date changed more than once in the last ${a.range.phrase}.`, strong: true, tone: "risk" },
      { text: " The most is " },
      { text: top.title, strong: true, taskId: top.id },
      { text: `${inProject(top.project)}, changed ${top.changes} times${top.done ? " before it was finished" : ""}.` },
      { text: ` ${moved.changes} date changes were recorded in all, on ${tasks(moved.changedTasks)}.` },
    ],
    actions: [{ label: "Open that task", kind: "task", target: top.id }, ...actions],
    caption,
  };
}

function whereAnswer(a: ProjectAnalytics): Body {
  const total = a.status.reduce((sum, row) => sum + row.count, 0);
  const done = a.status.filter((row) => row.isDone).reduce((sum, row) => sum + row.count, 0);
  const openRows = a.status.filter((row) => !row.isDone && row.count > 0).sort((x, y) => y.count - x.count);
  const top = openRows[0];
  const caption = "Every task on the board by column, then the open ones by priority. Archived tasks are left out.";
  const actions: AnswerAction[] = [{ label: "Open Tasks", kind: "tasks" }];
  if (!top) {
    return {
      parts: [{ text: total === 0 ? "There is nothing on the board." : `All ${tasks(total)} ${plural(total, "is", "are")} done.`, strong: true }],
      actions,
      caption,
    };
  }
  return {
    parts: [
      { text: `${top.count} of the ${tasks(total)} ${plural(top.count, "is", "are")} in ${top.name}`, strong: true },
      { text: openRows[1] ? `, and ${openRows[1].count} in ${openRows[1].name}.` : "." },
      { text: ` ${done} ${plural(done, "is", "are")} done.` },
    ],
    actions,
    caption,
  };
}

function longAnswer(a: ProjectAnalytics): Body {
  const { medianDays, sample } = a.timeToFinish;
  const caption = `Tasks finished in the last ${a.range.phrase}, by how long each took from added to finished. The marked bar holds the middle one.`;
  const actions: AnswerAction[] = [{ label: "Open Tasks", kind: "tasks" }];
  if (medianDays == null || sample === 0) {
    return {
      parts: [
        { text: `Nothing was finished in the last ${a.range.phrase}`, strong: true },
        { text: ", so there is no time to measure yet." },
      ],
      actions,
      caption,
    };
  }
  const parts: AnswerPart[] = [
    { text: `Half of tasks are finished within ${formatDays(medianDays).toLowerCase()}`, strong: true },
    { text: ` of being added. That is from ${tasks(sample)} finished in the last ${a.range.phrase}.` },
  ];
  if (a.onTime.rate != null) {
    parts.push({ text: " " });
    parts.push({ text: `${a.onTime.onTime} of the ${a.onTime.dated} with a due date`, strong: true });
    parts.push({ text: ` ${plural(a.onTime.onTime, "was", "were")} finished on time.` });
  }
  return { parts, actions, caption };
}

export function answerQuestion(id: QuestionId, analytics: ProjectAnalytics, scope: AnswerScope = { kind: "one", standing: NO_STANDING }): Answer {
  const spec = SPECS.find((entry) => entry.id === id)!;
  const question = scope.kind === "one" ? spec.one ?? spec.all : spec.all;
  const body =
    id === "late"
      ? lateAnswer(analytics)
      : id === "week"
        ? weekAnswer(analytics)
        : id === "who"
          ? whoAnswer(analytics)
          : id === "next"
            ? nextAnswer(analytics)
            : id === "slip"
              ? slipAnswer(analytics)
              : id === "where"
                ? whereAnswer(analytics)
                : id === "long"
                  ? longAnswer(analytics)
                  : scope.kind === "all"
                    ? shapeAnswer(scope.wall)
                    : trackAnswer(analytics, scope.standing);
  // One project has no other project to compare with from inside an answer
  // unless the page lists them; the view drops the action when it does not.
  return { id, question, ...body };
}

/** The answer as one plain string: what a copy or a test reads. */
export function answerText(answer: Answer): string {
  return answer.parts.map((part) => part.text).join("");
}

/** The line under the page title for one project: figures that say what they count. */
export function analyticsSummary(a: ProjectAnalytics): ReadonlyArray<Readonly<{ text: string; tone?: "late" | "risk" }>> {
  const out: Array<{ text: string; tone?: "late" }> = [{ text: `${a.open.count} open` }];
  if (a.overdue.count > 0) out.push({ text: `${a.overdue.count} late`, tone: "late" });
  out.push({ text: `${a.recent.finishedThisWeek} done in the last 7 days` });
  return out;
}

/** The same line across every project: the wall's own summary, then the week. */
export function portfolioSummary(wall: WallModel, a: ProjectAnalytics): ReadonlyArray<Readonly<{ text: string; tone?: "late" | "risk" }>> {
  return [
    ...wall.summary.map((item, index) => (index === 0 ? { ...item, text: `${item.text} ${wall.cards.length === 1 ? "project" : "projects"}` } : item)),
    { text: `${a.recent.finishedThisWeek} done in the last 7 days` },
  ];
}
