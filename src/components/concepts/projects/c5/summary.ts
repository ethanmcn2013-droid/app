/*
 * The living summary: plain sentences written from the project's data.
 * Every fact is a token the page can render as a live, clickable chip.
 * Nothing here is canned per project: change the data and the words change.
 */
import {
  ME,
  STATUS,
  TODAY,
  daysFrom,
  fmtShort,
  person,
  spokenWhen,
  type Milestone,
  type Project,
  type Task,
  type Tone,
} from "./data";

export type TokenKind =
  | "when"
  | "nodate"
  | "status"
  | "count"
  | "task"
  | "person"
  | "milestone"
  | "project"
  | "add-task"
  | "add-milestone"
  | "wrapped";

export type Tok = {
  kind: TokenKind;
  label: string;
  tone: Tone;
  /** Stable identity, so a changed label can animate in place. */
  key: string;
  ref?: string;
  project?: string;
  /** Identity colour, for tokens that name another project. */
  hue?: number;
  /** 0..1, drawn as a small ring inside a progress token. */
  progress?: number;
};

export type Seg = string | Tok;
export type Sentence = { key: string; segs: Seg[] };

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

export function numberWord(n: number, capital = true): string {
  const w = WORDS[n] ?? String(n);
  return capital ? w : w.toLowerCase();
}

/**
 * How a sentence names a task or milestone: its own title, lowercased at the
 * start. Never a separate phrase, so the words in the summary are always the
 * words on the thing they open.
 */
export function phraseOf(item: { title: string }): string {
  return item.title.charAt(0).toLowerCase() + item.title.slice(1);
}

function nameOf(id: string): string {
  return id === ME ? "you" : person(id).name;
}

export type Facts = {
  done: number;
  total: number;
  late: (Task & { by: number })[];
  waiting?: Task;
  next?: Milestone;
  days?: number;
  progress: number;
};

export function factsOf(p: Project): Facts {
  const listedDone = p.tasks.filter((task) => task.done).length;
  const done = listedDone + (p.doneExtra ?? 0);
  const total = p.tasks.length + (p.doneExtra ?? 0);
  const late = p.tasks
    .filter((task) => !task.done && task.due && daysFrom(task.due) < 0)
    .map((task) => ({ ...task, by: -daysFrom(task.due as string) }))
    .sort((a, b) => b.by - a.by);
  const waiting = p.tasks.find((task) => !task.done && task.waitingOn);
  const reviewIds = new Set(p.milestones.filter((m) => m.review).map((m) => m.id));
  const next = [...p.milestones]
    .filter((m) => !m.done && !reviewIds.has(m.id) && daysFrom(m.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    done,
    total,
    late,
    waiting,
    next,
    days: p.date ? daysFrom(p.date) : undefined,
    progress: total === 0 ? 0 : done / total,
  };
}

function tok(kind: TokenKind, label: string, tone: Tone, key: string, ref?: string, project?: string): Tok {
  return { kind, label, tone, key, ref, project };
}

function projectTok(p: Project, key: string): Tok {
  return { kind: "project", label: p.name, tone: "hue", key, project: p.id, hue: p.hue };
}

/** "you", or the person's name. */
function subjectOf(id: string): { name: string; has: string } {
  return id === ME ? { name: "You", has: "have" } : { name: person(id).name, has: "has" };
}

function plural(phrase: string): boolean {
  return /[^s]s$/.test(phrase);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Whose thing it is, as one noun phrase: "Sam’s tonic and olive order", "your quote". */
function ownedPhrase(task: Task): string {
  const phrase = phraseOf(task);
  if (task.waitingOn === ME && task.who !== ME) return `the ${phrase}`;
  return task.who === ME ? `your ${phrase}` : `${person(task.who).name}’s ${phrase}`;
}

function daysWord(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** How much a token earns its place as a live word, when a paragraph has too many. */
const KEEP: Record<TokenKind, number> = {
  "add-task": 90,
  "add-milestone": 90,
  nodate: 90,
  wrapped: 85,
  status: 80,
  task: 70,
  project: 65,
  count: 60,
  person: 50,
  milestone: 40,
  when: 30,
};

/**
 * One paragraph may carry one fill, the most urgent thing in it, and at most
 * four live words in all. Everything else reads as plain prose: the facts it
 * repeats (the date, the next milestone) are one line away on the page.
 */
function oneFill(sentences: Sentence[], max = 4, keep: Record<TokenKind, number> = KEEP): Sentence[] {
  const toks = sentences.flatMap((s) => s.segs.filter((x): x is Tok => typeof x !== "string"));
  const rank = (t: Tok) =>
    t.kind === "add-task" || t.kind === "add-milestone" || t.kind === "nodate"
      ? 0
      : t.tone === "danger"
        ? 3
        : t.tone === "review" || t.tone === "accent"
          ? 2
          : t.tone === "warning"
            ? 1
            : 0;
  let best: Tok | undefined;
  for (const t of toks) if (rank(t) > 0 && (!best || rank(t) > rank(best))) best = t;
  const kept = new Set(
    [...toks]
      .map((t, i) => ({ t, i, w: t === best ? 1000 : keep[t.kind] }))
      .sort((a, b) => b.w - a.w || a.i - b.i)
      .slice(0, max)
      .map((x) => x.t),
  );
  return sentences.map((s) => ({
    ...s,
    segs: s.segs.map((x) => {
      if (typeof x === "string" || x === best) return x;
      if (!kept.has(x)) return x.label;
      if (x.kind === "add-task" || x.kind === "add-milestone" || x.kind === "nodate") return x;
      return { ...x, tone: x.kind === "person" && x.ref === ME ? ("you" as Tone) : ("neutral" as Tone) };
    }),
  }));
}

/** The full living summary for one project page. */
export function projectSentences(p: Project): Sentence[] {
  if (p.wrapped) return wrappedSentences(p);
  const f = factsOf(p);
  const out: Sentence[] = [];
  const status = STATUS[p.status];
  const statusTok = tok("status", status.phrase, status.tone, "status");

  if (f.total === 0 && p.milestones.length === 0) {
    out.push({ key: "empty", segs: ["Nothing to report yet."] });
    out.push({
      key: "empty-add",
      segs: [
        "Add the first ",
        tok("add-task", "task", "accent", "add-task"),
        " or ",
        tok("add-milestone", "milestone", "accent", "add-milestone"),
        ".",
      ],
    });
    return out;
  }

  // When, with how much is done.
  const countTok: Tok = {
    ...tok("count", f.done === f.total ? `all ${f.total}` : `${f.done} of ${f.total}`, "neutral", "count"),
    progress: f.progress,
  };
  const tail: Seg[] =
    f.total === 0 ? ["."] : [", with ", countTok, " tasks done."];
  if (f.days === undefined) {
    out.push({ key: "when", segs: ["This project has ", tok("nodate", "no date yet", "neutral", "when"), ...tail] });
  } else if (f.days > 1) {
    out.push({ key: "when", segs: [`${p.name} is `, tok("when", `${f.days} days away`, "hue", "when"), ...tail] });
  } else if (f.days === 1 || f.days === 0) {
    out.push({ key: "when", segs: [`${p.name} is `, tok("when", f.days === 1 ? "tomorrow" : "today", "hue", "when"), ...tail] });
  } else {
    out.push({ key: "when", segs: [`${p.name} was `, tok("when", `${-f.days} days ago`, "hue", "when"), " and is still open", ...tail] });
  }
  if (f.total === 0) {
    // Nothing to be on track with yet: say so, and make the status the way in.
    const segs: Seg[] =
      p.status === "on-track"
        ? ["Work has ", tok("status", "not started", "neutral", "status"), ": "]
        : ["It is marked ", statusTok, ". No tasks yet: "];
    out.push({ key: "status", segs: [...segs, tok("add-task", "add the first task", "accent", "add-task"), "."] });
    if (f.next && !f.next.day) {
      out.push({
        key: "next",
        segs: ["The first milestone is ", tok("milestone", phraseOf(f.next), "hue", "next", f.next.id), ` ${spokenWhen(f.next.date)}.`],
      });
    }
    return oneFill(out);
  }

  // How it is going, checked against the facts: a status never contradicts a late task.
  const oldest = f.late[0];
  const lateSegs: Seg[] = [];
  if (f.late.length === 1) {
    lateSegs.push(
      tok("task", ownedPhrase(oldest), "danger", "late", oldest.id),
      ` ${plural(phraseOf(oldest)) ? "are" : "is"} ${daysWord(oldest.by)} overdue.`,
    );
  } else if (f.late.length > 1) {
    lateSegs.push(
      tok("count", `${numberWord(f.late.length, false)} things`, "danger", "late", "late"),
      " are late. The oldest is ",
      tok("task", ownedPhrase(oldest), "neutral", "late-oldest", oldest.id),
      `, ${daysWord(oldest.by)} overdue.`,
    );
  }
  const owner = subjectOf(p.owner);
  if (p.status === "on-track") {
    if (f.late.length === 0) {
      if (f.done < f.total) out.push({ key: "status", segs: [`${owner.name} ${owner.has} it `, statusTok, " and nothing is late."] });
      else out.push({ key: "status", segs: [`${owner.name} ${owner.has} it `, statusTok, "."] });
    } else if (f.late.length === 1) {
      out.push({ key: "status", segs: [`${owner.name} ${owner.has} it `, statusTok, ", but one thing is late: ", ...lateSegs] });
    } else {
      out.push({ key: "status", segs: [`${owner.name} ${owner.has} it `, statusTok, ", but ", ...lateSegs] });
    }
  } else if (p.status === "on-hold") {
    out.push({ key: "status", segs: ["It is ", statusTok, "."] });
  } else {
    const segs: Seg[] = ["It is marked ", statusTok];
    if (f.late.length === 0) segs.push(", though nothing is late yet.");
    else if (f.late.length === 1) segs.push(": ", ...lateSegs);
    else segs.push(". ", tok("count", `${numberWord(f.late.length)} things`, "danger", "late", "late"), ...lateSegs.slice(1));
    out.push({ key: "status", segs });
  }

  // Who it waits on.
  if (f.waiting?.waitingOn) {
    const on = f.waiting.waitingOn;
    const w = f.waiting;
    const lateBy = f.late.find((l) => l.id === w.id)?.by;
    const alreadySaid = f.late.length === 1 && lateBy !== undefined;
    const verb = plural(phraseOf(w)) ? "are" : "is";
    const segs: Seg[] = [
      "The ",
      tok("task", phraseOf(w), on === ME ? "review" : "neutral", "waiting", w.id),
      ` ${verb} waiting on `,
      tok("person", nameOf(on), on === ME ? "accent" : "neutral", "waiting-who", on),
    ];
    if (lateBy !== undefined && !alreadySaid) segs.push(`, ${daysWord(lateBy)} past its date.`);
    else segs.push(".");
    out.push({ key: "waiting", segs });
  }

  // What comes next.
  if (f.next && !f.next.day) {
    out.push({
      key: "next",
      segs: ["Next up is ", tok("milestone", phraseOf(f.next), "hue", "next", f.next.id), ` ${spokenWhen(f.next.date)}.`],
    });
  }

  return oneFill(out);
}

/** On the portfolio, the live words are the projects themselves: each opens its page. */
const KEEP_PORTFOLIO: Record<TokenKind, number> = { ...KEEP, project: 95 };

function wrappedSentences(p: Project): Sentence[] {
  const w = p.wrapped!;
  const timing = w.early > 0 ? `${w.early} ${w.early === 1 ? "day" : "days"} early` : "on the day";
  return [
    {
      key: "wrapped",
      segs: [`${p.name} wrapped on ${fmtShort(w.on)}, `, tok("wrapped", timing, "success", "wrapped"), "."],
    },
    {
      key: "tasks",
      segs: [
        tok("count", `${w.tasks} tasks`, "neutral", "count"),
        " were done by ",
        tok("person", `${w.people} people`, "neutral", "people", "people"),
        ".",
      ],
    },
    { key: "closing", segs: [w.closing] },
  ];
}

/** One line for the rail preview and the portfolio gallery. */
export function oneLiner(p: Project): string {
  if (p.wrapped) {
    const w = p.wrapped;
    return `Wrapped ${fmtShort(w.on)}, ${w.tasks} tasks, ${w.early > 0 ? `${w.early} days early` : "on the day"}.`;
  }
  const f = factsOf(p);
  if (f.total === 0 && p.milestones.length === 0) return "Nothing to report yet.";
  const when =
    f.days === undefined ? "No date yet" : f.days === 0 ? "Today" : f.days === 1 ? "Tomorrow" : `In ${f.days} days`;
  const status =
    f.total === 0 && p.status === "on-track"
      ? "not started"
      : p.status === "on-track" && f.late.length > 0
      ? `on track, ${f.late.length === 1 ? "one thing" : `${numberWord(f.late.length, false)} things`} late`
      : STATUS[p.status].phrase;
  let issue: string;
  if (f.waiting?.waitingOn === ME) issue = `The ${phraseOf(f.waiting)} is waiting on you.`;
  else if (f.late.length > 0) issue = `${capitalise(ownedPhrase(f.late[0]))} is ${daysWord(f.late[0].by)} overdue.`;
  else if (f.waiting?.waitingOn) issue = `Waiting on ${nameOf(f.waiting.waitingOn)} for the ${phraseOf(f.waiting)}.`;
  else if (f.next) issue = `Next up is ${phraseOf(f.next)} ${spokenWhen(f.next.date)}.`;
  else issue = `${f.done} of ${f.total} tasks are done.`;
  return `${when}, ${status}. ${issue}`;
}

/** The portfolio page, written the same way. Each project is named once, in full. */
export function portfolioSentences(projects: Project[]): Sentence[] {
  const running = projects.filter((p) => !p.wrapped);
  const out: Sentence[] = [];
  if (running.length === 0) {
    out.push({ key: "none", segs: ["Nothing is running right now. ", tok("add-task", "Start a project", "accent", "new"), "."] });
    return out;
  }
  out.push({
    key: "running",
    segs: [
      tok("count", `${numberWord(running.length)} ${running.length === 1 ? "project" : "projects"}`, "neutral", "running"),
      ` ${running.length === 1 ? "is" : "are"} running.`,
    ],
  });

  const troubled = (p: Project) => p.status === "at-risk" || p.status === "blocked";
  const named = new Set<string>();

  // Projects that need the viewer within the week, with their state folded in.
  const needs = running
    .map((p) => ({ p, task: p.tasks.find((t) => !t.done && t.waitingOn === ME) }))
    .filter((x): x is { p: Project; task: Task } => Boolean(x.task && (!x.task.due || daysFrom(x.task.due) <= 7)));
  if (needs.length > 0) {
    const segs: Seg[] = [`${numberWord(needs.length)} ${needs.length === 1 ? "needs" : "need"} you this week: `];
    needs.forEach(({ p, task }, i) => {
      named.add(p.id);
      if (i > 0) segs.push(i === needs.length - 1 ? " and " : ", ");
      segs.push("the ", tok("task", phraseOf(task), "review", `need-${p.id}`, task.id, p.id), " for ", projectTok(p, `need-p-${p.id}`));
      if (troubled(p)) segs.push(", which is ", tok("status", STATUS[p.status].phrase, STATUS[p.status].tone, `need-s-${p.id}`, undefined, p.id));
    });
    segs.push(".");
    out.push({ key: "needs", segs });
  } else {
    out.push({ key: "needs", segs: ["Nothing is waiting on you this week."] });
  }

  // Projects in trouble that have not been named yet.
  const trouble = running.filter((p) => troubled(p) && !named.has(p.id));
  if (trouble.length > 0) {
    const segs: Seg[] = [];
    trouble.forEach((p, i) => {
      named.add(p.id);
      if (i > 0) segs.push(i === trouble.length - 1 ? " and " : ", ");
      segs.push(projectTok(p, `trouble-${p.id}`), ` is `, tok("status", STATUS[p.status].phrase, STATUS[p.status].tone, `trouble-s-${p.id}`, undefined, p.id));
    });
    segs.push(".");
    out.push({ key: "trouble", segs });
  }

  const dated = running
    .filter((p) => p.date && daysFrom(p.date) >= 0)
    .sort((a, b) => (a.date as string).localeCompare(b.date as string));
  if (dated[0]) {
    const first = dated[0];
    const d = daysFrom(first.date as string);
    const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
    out.push({
      key: "next",
      // Already named above: the second mention is plain words, not another live link.
      segs: named.has(first.id)
        ? [`${first.name} comes first, ${when}.`]
        : ["The soonest date is ", projectTok(first, "next-project"), `, ${when}.`],
    });
  }

  const recent = projects
    .filter((p) => p.wrapped && daysFrom(p.wrapped.on) > -30)
    .sort((a, b) => (b.wrapped as { on: string }).on.localeCompare((a.wrapped as { on: string }).on))[0];
  if (recent?.wrapped) {
    out.push({
      key: "wrapped",
      segs: [
        projectTok(recent, "wrapped-project"),
        recent.wrapped.early > 0 ? ` wrapped ${recent.wrapped.early} days early.` : " wrapped on the day.",
      ],
    });
  }
  return oneFill(out, 5, KEEP_PORTFOLIO);
}


export { TODAY };
