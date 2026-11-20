/*
 * The prepared questions and the local matcher that maps typed words to the
 * nearest one. No model call: keywords, light stemming and a few synonyms.
 */

import type { ProjectData } from "./data";

export type ChartKind = "course" | "slope" | "bars" | "waffle" | "dots" | "range" | "columns" | "week" | "moves";

export type Question = {
  id: string;
  text: string;
  kind: ChartKind;
  /** Starter questions carry a need; follow-ups do not appear on the grid. */
  need?: "Where we stand" | "People" | "What goes wrong" | "Patterns";
  hint: string;
  follow: string[];
  /** Keyword stems and their weights. */
  words: Record<string, number>;
};

export const QUESTIONS: Question[] = [
  {
    id: "on-course",
    text: "Are we on course for {target}?",
    kind: "course",
    need: "Where we stand",
    hint: "Your pace against the date",
    follow: ["first-next-week", "slipping", "left"],
    words: { course: 4, when: 2, track: 4, date: 3, deadline: 4, time: 1, make: 2, finish: 2, wedding: 3, launch: 3, hand: 2, on: 1, ready: 3, late: 1, pace: 3 },
  },
  {
    id: "changed",
    text: "What changed this week?",
    kind: "slope",
    need: "Where we stand",
    hint: "Last week beside this week",
    follow: ["done-week", "getting-better", "late"],
    words: { chang: 5, week: 3, new: 2, differ: 4, happen: 3, update: 3, since: 2, compar: 2, last: 1 },
  },
  {
    id: "who-busy",
    text: "Who has too much on?",
    kind: "bars",
    need: "People",
    hint: "Open work for each person",
    follow: ["first-next-week", "who-did", "late"],
    words: { who: 3, busy: 5, swamp: 6, much: 3, load: 5, overload: 6, person: 3, people: 3, team: 2, too: 1, work: 1, plate: 4, stretch: 4, room: 3, free: 3 },
  },
  {
    id: "first-next-week",
    text: "What should we do first next week?",
    kind: "week",
    need: "People",
    hint: "Next week, in order",
    follow: ["who-busy", "late", "on-course"],
    words: { first: 5, next: 3, priorit: 6, start: 3, focus: 5, should: 2, monday: 4, plan: 3, order: 2, important: 4, urgent: 4, week: 1 },
  },
  {
    id: "slipping",
    text: "What keeps slipping?",
    kind: "bars",
    need: "What goes wrong",
    hint: "How often dates move, by group",
    follow: ["which-outsider", "getting-better", "those-tasks"],
    words: { slip: 6, keep: 2, move: 4, moved: 4, delay: 5, push: 4, reschedul: 6, postpon: 5, again: 2, date: 1 },
  },
  {
    id: "late",
    text: "What is late and why?",
    kind: "dots",
    need: "What goes wrong",
    hint: "Each late task, by reason",
    follow: ["waiting-longest", "who-busy", "first-next-week"],
    words: { late: 6, overdue: 6, behind: 5, why: 2, miss: 4, past: 3 },
  },
  {
    id: "time-goes",
    text: "Where does our time go?",
    kind: "waffle",
    need: "Patterns",
    hint: "100 squares of open time",
    follow: ["waiting-longest", "how-long", "slipping"],
    words: { time: 4, where: 3, spend: 5, go: 1, goes: 2, wait: 3, stuck: 4, sit: 3, hour: 3 },
  },
  {
    id: "how-long",
    text: "How long do things usually take us?",
    kind: "range",
    need: "Patterns",
    hint: "Usual days, by group",
    follow: ["time-goes", "slipping", "waiting-longest"],
    words: { long: 5, take: 4, usual: 4, average: 4, typical: 4, days: 2, quick: 3, fast: 3, slow: 4, duration: 5 },
  },
  {
    id: "which-outsider",
    text: "{outsider}",
    kind: "bars",
    hint: "Moves, by who we wait on",
    follow: ["those-tasks", "waiting-longest", "getting-better"],
    words: { supplier: 6, client: 5, contact: 5, vendor: 5, which: 2, who: 1, slip: 3, most: 2, worst: 3 },
  },
  {
    id: "getting-better",
    text: "Is it getting better?",
    kind: "columns",
    hint: "Moved dates, week by week",
    follow: ["changed", "those-tasks", "on-course"],
    words: { better: 6, worse: 6, improv: 6, trend: 5, getting: 3, over: 1 },
  },
  {
    id: "those-tasks",
    text: "Show me the tasks that moved",
    kind: "moves",
    hint: "Each moved date, first to latest",
    follow: ["which-outsider", "late", "first-next-week"],
    words: { show: 3, task: 2, tasks: 2, those: 3, list: 3, which: 1, moved: 3, move: 2 },
  },
  {
    id: "done-week",
    text: "What did we finish this week?",
    kind: "columns",
    hint: "Finished, week by week",
    follow: ["who-did", "changed", "on-course"],
    words: { finish: 5, done: 5, complet: 5, achiev: 4, shipped: 4, week: 2, did: 2 },
  },
  {
    id: "waiting-longest",
    text: "What are we waiting on longest?",
    kind: "bars",
    hint: "Days waiting, for each task",
    follow: ["late", "which-outsider", "first-next-week"],
    words: { wait: 6, waiting: 6, longest: 3, reply: 5, hear: 4, stuck: 4, chase: 5, hold: 3 },
  },
  {
    id: "who-did",
    text: "Who finished the most?",
    kind: "bars",
    hint: "Finished in 4 weeks, by person",
    follow: ["who-busy", "done-week", "first-next-week"],
    words: { who: 2, finish: 3, most: 3, best: 3, did: 2, contribut: 5, done: 2, helped: 3 },
  },
  {
    id: "left",
    text: "How much is left?",
    kind: "bars",
    hint: "Open tasks, by group",
    follow: ["on-course", "who-busy", "first-next-week"],
    words: { left: 6, remain: 6, open: 3, still: 3, much: 2, many: 2, outstanding: 5, todo: 4 },
  },
  {
    id: "coming-up",
    text: "What is coming up in the next two weeks?",
    kind: "dots",
    hint: "Due dates on a two-week line",
    follow: ["first-next-week", "who-busy", "on-course"],
    words: { coming: 5, when: 1.5, upcoming: 6, soon: 4, due: 4, next: 2, fortnight: 5, ahead: 4, two: 1 },
  },
];

export const STARTERS = QUESTIONS.filter((q) => q.need);
export const MOST_ASKED = "on-course";
export const NEEDS = ["Where we stand", "People", "What goes wrong", "Patterns"] as const;

export function questionById(id: string) {
  return QUESTIONS.find((q) => q.id === id) ?? QUESTIONS[0];
}

export function textFor(q: Question, p: ProjectData) {
  if (q.id === "on-course") {
    if (p.status === "all") return "Are we on course everywhere?";
    if (!p.target) return "Are we on course?";
    return q.text.replace("{target}", `${fmtTarget(p.target.day)}`);
  }
  if (q.id === "which-outsider") return p.outsiderWord.question;
  return q.text;
}

function fmtTarget(d: number) {
  const x = new Date(2026, 8, 25 + d);
  const m = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][x.getMonth()];
  return `${x.getDate()} ${m}`;
}

/* ── Matching ───────────────────────────────────────────────────────────── */

const SYNONYMS: Record<string, string> = {
  overdue: "late",
  behind: "late",
  delayed: "delay",
  slipped: "slip",
  slips: "slip",
  slipping: "slip",
  moving: "move",
  moves: "move",
  busiest: "busy",
  swamped: "busy",
  finished: "finish",
  completed: "complet",
  deadline: "deadline",
  waited: "wait",
  waits: "wait",
  suppliers: "supplier",
  vendors: "vendor",
  clients: "client",
  due: "due",
};

const STOP = new Set(["what", "is", "the", "we", "our", "us", "are", "do", "does", "how", "who", "which", "an", "of", "in", "on", "for", "to", "it", "me", "show", "this", "that", "and", "why", "did", "much", "many", "most", "things", "thing", "any", "can", "you", "tell", "about", "there", "be", "have", "has", "was", "were", "my", "i"]);

function stem(w: string) {
  const s = SYNONYMS[w] ?? w;
  return s.replace(/(ing|ed|es|s)$/, "") || s;
}

export function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function hits(stemmed: string, key: string) {
  const k = stem(key);
  if (stemmed.length < 3 || k.length < 3) return stemmed === k;
  return stemmed.startsWith(k) || k.startsWith(stemmed);
}

export type Match = { q: Question; score: number };

const titleCache = new Map<string, Set<string>>();
function TITLE_WORDS(p: ProjectData) {
  let set = titleCache.get(p.id);
  if (!set) {
    set = new Set(p.moved.flatMap((m) => tokens(`${m.title} ${m.who}`).map(stem)).filter((t) => t.length >= 4 && !STOP.has(t)));
    titleCache.set(p.id, set);
  }
  return set;
}

export function rank(input: string, p: ProjectData): Match[] {
  const ts = tokens(input).map(stem);
  if (ts.length === 0) return [];
  return QUESTIONS.map((q) => {
    let score = 0;
    for (const t of ts) {
      let best = 0;
      for (const [k, w] of Object.entries(q.words)) if (hits(t, k)) best = Math.max(best, w);
      // Words in the question itself count a little, so typing its start finds it.
      if (!best && !STOP.has(t) && tokens(textFor(q, p)).some((w) => hits(t, w))) best = 1.5;
      score += best;
    }
    // A person's name points at who has too much on.
    if (q.id === "who-busy" && ts.some((t) => p.people.some((x) => stem(x.name.toLowerCase()) === t))) score += 4;
    // Names of things in the Project point at the tasks that moved.
    if (q.id === "those-tasks" && ts.some((t) => t.length >= 4 && TITLE_WORDS(p).has(t))) score += 3;
    const whole = textFor(q, p).toLowerCase();
    if (input.trim().length > 3 && whole.startsWith(input.trim().toLowerCase())) score += 6;
    return { q, score };
  })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Confident at 5 or more; "closest question" between 2 and 5; below that a miss. */
export function verdict(m: Match | undefined) {
  if (!m || m.score < 2) return "miss" as const;
  return m.score >= 5 ? ("sure" as const) : ("closest" as const);
}

/** Which words of the question the typed text touched, for soft highlighting. */
export function marked(text: string, input: string) {
  const ts = tokens(input).map(stem).filter((t) => t.length >= 2);
  return text.split(/(\s+)/).map((piece) => {
    const w = piece.toLowerCase().replace(/[^a-z0-9]/g, "");
    const on = w.length > 1 && ts.some((t) => hits(t, w) || (t.length >= 2 && w.startsWith(t)));
    return { piece, on };
  });
}
