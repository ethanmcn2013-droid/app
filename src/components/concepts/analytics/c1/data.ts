/*
 * The Friday letter: sample data.
 *
 * Every letter is authored as short paragraphs in a tiny markup so the
 * voice stays human:
 *   {visible words|noteId:mark}  a phrase that lights up a mark in its sidenote
 *   [[glyphId]]                  a word-sized chart set into the sentence
 *
 * Concept only: invented data, no backend.
 */

export type Tone = "accent" | "warning" | "neutral";

export type NoteChart =
  | { type: "weeks"; values: number[]; added?: number[]; starts: string[]; current: number; unit: string }
  | {
      type: "trail";
      /** Day numbers are days since 1 Sep 2026 (1 Sep = 0). */
      today: number;
      items: { name: string; points: { day: number; label: string; movedOn?: string }[] }[];
    }
  | {
      type: "people";
      rows: { name: string; done: number; soon: number; later: number }[];
      soonLabel: string;
    }
  | { type: "units"; rows: { name: string; lit: number; total: number }[]; tone: Tone; litLabel: string; restLabel: string; allLabel?: string }
  | {
      type: "days";
      days: { label: string; count: number; weekend: boolean; nobody?: number }[];
      ranges: Record<string, [number, number]>;
    }
  | { type: "bars"; rows: { name: string; value: number; unit: string }[]; tone: Tone; allLabel?: string }
  | { type: "figure"; value: string; unit: string }
  | { type: "course"; behind: number[]; starts: string[]; current: number };

export type Fact = { label: string; value: string; how: string };

export type Note = {
  id: string;
  title: string;
  chart: NoteChart;
  /** Default mark lit when nothing is hovered. */
  mark?: string;
  caption: string;
  facts: Fact[];
};

export type Glyph =
  | { type: "spark"; values: number[]; current: number }
  | { type: "trail"; stops: number }
  | { type: "squares"; total: number; lit: number; tone: Tone }
  | { type: "strip"; values: number[]; lit: [number, number] };

export type Para = { id: string; topic: string; text: string; note?: string };

export type Action = { id: string; label: string; done: string; kind?: "primary" | "link" };

export type Letter = {
  key: string;
  /** Monday of the week the letter covers, e.g. "21 Sep". */
  week: string;
  written: string;
  mood: string;
  /** Things finished Monday to Friday: the five-dot week signature. */
  dots: [number, number, number, number, number];
  status: string;
  headline: string;
  dateline: string;
  notice?: string;
  lede: string;
  paras: Para[];
  short: [string, string, string];
  actions: Action[];
  signoff: string;
  notes: Record<string, Note>;
  glyphs: Record<string, Glyph>;
};

export type ProjectState = "letters" | "empty";

export type Project = {
  id: string;
  name: string;
  kind: string;
  swatch: number;
  team: string[];
  group: "main" | "other";
  state: ProjectState;
  letters: Letter[];
  empty?: { title: string; body: string; created: string };
};

/* ── shared helpers ───────────────────────────────────────────────── */

const ORCHARD_STARTS = [
  "22 Jun", "29 Jun", "6 Jul", "13 Jul", "20 Jul", "27 Jul", "3 Aug",
  "10 Aug", "17 Aug", "24 Aug", "31 Aug", "7 Sep", "14 Sep", "21 Sep",
];
const ORCHARD_DONE = [3, 5, 4, 6, 2, 7, 5, 8, 4, 6, 9, 7, 8, 11];
const ORCHARD_ADDED = [9, 8, 8, 7, 6, 8, 6, 7, 5, 6, 5, 5, 4, 6];

const ORCHARD_BEHIND = [0, 0, 2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
const WEDDING_BEHIND = [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];

const WEDDING_DONE = [1, 2, 2, 3, 1, 4, 3, 5, 2, 4, 6, 4, 5, 7];
const WEDDING_ADDED = [6, 5, 5, 4, 3, 5, 4, 4, 3, 4, 3, 3, 2, 3];

const ON_COURSE_HOW =
  "On course means the open tasks, at your pace over the last four weeks, finish before the dates they are due.";

function spreadDots(total: number, seed: number): [number, number, number, number, number] {
  const weights = [3, 5, 2, 4, 3].map((w, i) => w + ((seed * 7 + i * 3) % 4));
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => Math.floor((w / sum) * total));
  let left = total - raw.reduce((a, b) => a + b, 0);
  let i = seed % 5;
  while (left > 0) {
    raw[i % 5] += 1;
    left -= 1;
    i += 2;
  }
  return raw as [number, number, number, number, number];
}

function weeksNote(
  values: number[],
  added: number[] | undefined,
  starts: string[],
  current: number,
  unit: string,
  caption: string,
): Note {
  const slice = values.slice(0, current + 1);
  const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
  return {
    id: "done",
    title: `Finished each week`,
    chart: { type: "weeks", values: slice, added: added?.slice(0, current + 1), starts: starts.slice(0, current + 1), current, unit },
    mark: `w${current}`,
    caption,
    facts: [
      { label: `Finished, week of ${starts[current]}`, value: String(values[current]), how: "Tasks moved to done between Monday and Friday." },
      ...(added ? [{ label: "Added the same week", value: String(added[current]), how: "New tasks created in the project that week." }] : []),
      { label: `Weekly average since ${starts[0]}`, value: avg.toFixed(1), how: `Every finished task divided by ${slice.length} ${slice.length === 1 ? "week" : "weeks"}.` },
    ],
  };
}

function statusNote(status: string, detail: string, behind?: number[], starts?: string[], current?: number): Note {
  return {
    id: "status",
    title: "Where things stand",
    chart:
      behind && starts && current != null && current > 0
        ? { type: "course", behind: behind.slice(0, current + 1), starts: starts.slice(0, current + 1), current }
        : { type: "figure", value: status, unit: "" },
    mark: current != null ? `w${current}` : undefined,
    caption: detail,
    facts: [{ label: "Where things stand", value: status, how: ON_COURSE_HOW }],
  };
}

type PastWeek = {
  mood: string;
  status: string;
  lede: string;
  done: string;
  changed?: string;
  who: string;
  ahead: string;
  short: [string, string, string];
  notice?: string;
};

function pastLetter(
  project: { name: string; teamLine: string; values: number[]; added?: number[]; behind?: number[]; starts: string[]; unit: string; headlineFor: (week: string) => string },
  index: number,
  w: PastWeek,
): Letter {
  const early = index === 0;
  const notes: Record<string, Note> = {
    done: weeksNote(
      project.values,
      project.added,
      project.starts,
      index,
      project.unit,
      early ? "One week so far. Trends start once there are a few weeks to compare." : "The highlighted bar is the week this letter covers.",
    ),
    status: statusNote(w.status, ON_COURSE_HOW, project.behind, project.starts, index),
  };
  if (early) {
    notes.done = {
      ...notes.done,
      title: "Your first week",
      chart: { type: "figure", value: String(project.values[0]), unit: `finished, ${project.added?.[0] ?? "a few"} added` },
    };
  }
  const glyphs: Record<string, Glyph> = early
    ? {}
    : { spark: { type: "spark", values: project.values.slice(Math.max(0, index - 13), index + 1), current: Math.min(index, 13) } };
  const paras: Para[] = [
    { id: "done", topic: "What got done", text: w.done, note: "done" },
    ...(w.changed ? [{ id: "changed", topic: "What changed", text: w.changed }] : []),
    { id: "who", topic: "Who carried it", text: w.who },
    { id: "ahead", topic: "Looking ahead", text: w.ahead, note: "status" },
  ];
  const week = project.starts[index];
  return {
    key: `w${index}`,
    week,
    written: fridayOf(week),
    mood: w.mood,
    dots: spreadDots(project.values[index], index),
    status: w.status,
    headline: project.headlineFor(week),
    dateline: `Written ${fridayOf(week)}`,
    notice: w.notice,
    lede: w.lede,
    paras,
    short: w.short,
    actions: [],
    signoff: project.teamLine,
    notes,
    glyphs,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "21 Sep" (a Monday in 2026) → "Friday 25 September". */
export function fridayOf(week: string): string {
  const [d, m] = week.split(" ");
  const date = new Date(Date.UTC(2026, MONTHS.indexOf(m), Number(d) + 4));
  return `Friday ${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]}`;
}

/* ── The Orchard (events venue) ───────────────────────────────────── */

const orchardPast: PastWeek[] = [
  {
    mood: "The first letter",
    status: "Just started",
    notice: "It is early, so this letter only covers what happened, not trends.",
    lede: "Your first week on Signal. You finished 3 things and put most of the autumn on the page.",
    done: "You finished {3 things|done:w0}: the September wedding list is written, the insurance renewal is paid and the tent supplier has the dates. You also added 9 tasks, which is what a first week should look like.",
    who: "Orla did most of the setting up. Cian and Niamh each finished one thing.",
    ahead: "Nothing is due next week. Once a few weeks have passed I will tell you whether the pace fits the dates. For now, {nothing is late|status:x}.",
    short: ["Your first week: 3 things finished, 9 added.", "Nothing is late.", "Trends start in a few weeks."],
  },
  {
    mood: "A steady start",
    status: "On course",
    lede: "A steady second week. You finished 5 things and nothing slipped.",
    done: "You finished {5 things|done:w1} [[spark]], including the first call with Mara and Finn and the table plan for the Byrne christening.",
    who: "Niamh took the christening and finished all three of its tasks. Orla handled the rest.",
    ahead: "Next week has 6 things due. At this pace, {you are on course|status:x}.",
    short: ["5 things finished, nothing slipped.", "The christening is ready.", "Next week has 6 things due."],
  },
  {
    mood: "Things piled up",
    status: "2 weeks behind",
    lede: "More came in than went out. You finished 4 things and added 8, so the pile grew.",
    done: "You finished {4 things|done:w2} [[spark]]. The wine order went in and the parking plan is agreed with the council.",
    changed: "Two supplier dates moved when the caterer went on holiday a week early.",
    who: "Cian was out for three days, so Orla and Niamh covered. Nobody was idle; there was just more to do than people.",
    ahead: "At this pace the open work finishes about two weeks after it is due, so {you are 2 weeks behind|status:x}. It is July: a couple of good weeks will close it.",
    short: ["4 finished, 8 added: the pile grew.", "Two supplier dates moved.", "About 2 weeks behind, which is fixable."],
  },
  {
    mood: "Catching up",
    status: "1 week behind",
    lede: "Better. You finished 6 things, the most so far, and the gap closed by a week.",
    done: "You finished {6 things|done:w3} [[spark]], and the caterer dates are back where they were.",
    who: "Cian is back and finished three of the six.",
    ahead: "You are {1 week behind|status:x} now. Nothing on the list is urgent.",
    short: ["6 finished, the most so far.", "The caterer dates are back.", "1 week behind, and closing."],
  },
  {
    mood: "Quiet",
    status: "On course",
    lede: "A quiet week: 2 things done, nothing late. Quiet is fine.",
    done: "You finished {2 things|done:w4} [[spark]], the lowest week so far, but nothing was due and half the suppliers are away.",
    who: "Everyone had a lighter week. Orla finished both.",
    ahead: "With less due, the old gap has gone and {you are on course|status:x}. Next week picks up: 7 things are due.",
    short: ["A quiet week: 2 things done.", "Nothing is late.", "7 things are due next week."],
  },
  {
    mood: "A good week",
    status: "On course",
    lede: "A good week. You finished 7 things and the Mara and Finn plan is taking shape.",
    done: "You finished {7 things|done:w5} [[spark]]: the band shortlist, the florist brief and the first draft of the day's running order.",
    who: "Niamh and Orla shared most of it. Cian set up the supplier list for October.",
    ahead: "You are {on course|status:x}. Next week is steady, with 5 things due.",
    short: ["7 things finished.", "The wedding plan is taking shape.", "On course."],
  },
  {
    mood: "Steady",
    status: "On course",
    lede: "A steady week, with 5 things finished and no surprises.",
    done: "You finished {5 things|done:w6} [[spark]], including the band deposit and the tent layout.",
    who: "Work was spread evenly: Cian 2, Niamh 2, Orla 1.",
    ahead: "Still {on course|status:x}. The venue walk-through with Mara and Finn is on Thursday.",
    short: ["5 finished, no surprises.", "Band deposit paid.", "Walk-through on Thursday."],
  },
  {
    mood: "A good week",
    status: "On course",
    lede: "Your best week so far: 8 things finished, and the walk-through went well.",
    done: "You finished {8 things|done:w7} [[spark]]. The walk-through is done and Mara and Finn chose the orchard for the ceremony.",
    who: "Niamh ran the walk-through and finished 4 of the 8.",
    ahead: "You are {on course|status:x}, and ahead on the venue tasks.",
    short: ["8 finished, the best week so far.", "Ceremony will be in the orchard.", "On course."],
  },
  {
    mood: "Two things slipped",
    status: "1 week behind",
    lede: "A slower week. You finished 4 things and two supplier dates slipped, but nothing is in danger.",
    done: "You finished {4 things|done:w8} [[spark]], half of last week. The cake order and the linen hire are done.",
    changed: "The band contract moved from 20 to 28 Aug while their agent was away, and the florist deposit moved by a week.",
    who: "Cian carried both slipped tasks. Neither was his fault: both are waiting on replies.",
    ahead: "That puts you about {1 week behind|status:x}. Chasing the band on Monday would close most of it.",
    short: ["4 finished, two supplier dates slipped.", "The band contract moved to 28 Aug.", "About 1 week behind."],
  },
  {
    mood: "Back on track",
    status: "On course",
    lede: "Back on track. You finished 6 things and the band contract is signed.",
    done: "You finished {6 things|done:w9} [[spark]]. The band contract is signed and the florist has her deposit.",
    who: "Cian closed both of last week's slipped tasks. Orla started on the guest list.",
    ahead: "You are {on course|status:x} again. Guest replies are due in three weeks.",
    short: ["6 finished, band contract signed.", "Both slipped tasks closed.", "On course again."],
  },
  {
    mood: "The best week yet",
    status: "On course",
    lede: "Your best week yet: 9 things finished, and the menu tasting is the only loose end.",
    done: "You finished {9 things|done:w10} [[spark]], including the seating plan draft, the tent order and the Hegarty birthday.",
    changed: "The menu tasting moved from 11 to 18 Sep, its first move.",
    who: "Niamh finished 4, Orla 3, Cian 2.",
    ahead: "You are {on course|status:x}. Six weeks to the wedding.",
    short: ["9 finished, the best week yet.", "The menu tasting moved to 18 Sep.", "Six weeks to the wedding."],
  },
  {
    mood: "Steady",
    status: "On course",
    lede: "A steady week: 7 things finished and nothing moved.",
    done: "You finished {7 things|done:w11} [[spark]], with the first guest replies in (98 so far).",
    who: "Orla handled the guest replies. Cian booked the portable toilets, which he would like noted.",
    ahead: "{On course|status:x}. The next big date is the menu tasting on 18 Sep.",
    short: ["7 finished, nothing moved.", "98 guest replies in.", "Menu tasting on 18 Sep."],
  },
  {
    mood: "A good week",
    status: "On course",
    lede: "A good week. You finished 8 things and the guest list is nearly closed.",
    done: "You finished {8 things|done:w12} [[spark]]: the evening food, the signage and most of the guest replies.",
    who: "Niamh and Orla finished 3 each, Cian 2.",
    ahead: "You are {on course|status:x}. The tasting is on Friday, if the caterer confirms.",
    short: ["8 finished.", "Guest list nearly closed.", "Tasting on Friday, if confirmed."],
  },
];

const orchardHeadline = (week: string) => `The week of ${week} at The Orchard`;

const orchardCurrent: Letter = {
  key: "w13",
  week: "21 Sep",
  written: "Friday 25 September",
  mood: "A strong week",
  dots: [2, 3, 1, 4, 1],
  status: "On course",
  headline: "This week at The Orchard",
  dateline: "Friday 25 September · 22 days to Mara & Finn",
  lede: "A strong week. You finished {11 things|done:w13}, the most of any week since June, and the wedding is on course.",
  paras: [
    {
      id: "done",
      topic: "What got done",
      note: "done",
      text: "Final guest numbers are in (142), the evening music is chosen, and the florist signed off. Week by week it looks like this [[spark]], and the last month is your best stretch so far: {35 things in four weeks|done:last4}, against 23 in the four before.",
    },
    {
      id: "changed",
      topic: "What changed",
      note: "moves",
      text: "Two dates moved. The {menu tasting|moves:Menu tasting} slipped from 18 to 29 Sep [[trail]], the second time it has moved, and {tent hire|moves:Tent hire} went from 2 to 6 Oct. Neither touches the day itself, but the tasting now sits 18 days before the wedding, which leaves little room to change the menu afterwards.",
    },
    {
      id: "who",
      topic: "Who carried it",
      note: "people",
      text: "{Niamh finished 6|people:Niamh} of the 11 [[niamh]], and Orla and Cian shared the rest. {Cian has 9 open|people:Cian}, 4 of them due next week [[cian]], which is a lot for one person. {Orla has 4 open|people:Orla} and room to take some.",
    },
    {
      id: "slips",
      topic: "What keeps slipping",
      note: "groups",
      text: "{Supplier tasks|groups:Suppliers} slip more than anything else: 5 of the last 7 moved at least once. {Guest and venue tasks|groups:Guests,Venue} almost never do. The pattern is nearly always the same, waiting on a reply, so it may help to chase suppliers a week earlier than feels necessary.",
    },
    {
      id: "ahead",
      topic: "Looking ahead",
      note: "days",
      text: "{Next week is the heaviest|days:next} before the wedding [[strip]]: 13 tasks due, {2 of them with nobody on them yet|days:nobody}. {The week after|days:after} is lighter, with 9.",
    },
  ],
  short: [
    "A strong week: 11 things finished, the most since June.",
    "The menu tasting slipped again, to 29 Sep.",
    "Next week is the heaviest before the wedding, and Cian has too much of it.",
  ],
  actions: [
    { id: "move", label: "Move 2 of Cian's tasks to Orla", done: "Done. The linen count and the chair hire now sit with Orla.", kind: "primary" },
    { id: "tasting", label: "Confirm the tasting date with the caterer", done: "Sent. Kitchen & Co. will get a note asking to confirm 29 Sep." },
    { id: "plan", label: "Open next week's plan", done: "Opening next week's plan.", kind: "link" },
  ],
  signoff: "Signal, for The Orchard team",
  notes: {
    done: {
      ...weeksNote(ORCHARD_DONE, ORCHARD_ADDED, ORCHARD_STARTS, 13, "finished", "Every week since you started."),
    },
    moves: {
      id: "moves",
      title: "Dates that moved",
      chart: {
        type: "trail",
        today: 24,
        items: [
          {
            name: "Menu tasting",
            points: [
              { day: 10, label: "11 Sep" },
              { day: 17, label: "18 Sep", movedOn: "3 Sep" },
              { day: 28, label: "29 Sep", movedOn: "22 Sep" },
            ],
          },
          {
            name: "Tent hire",
            points: [
              { day: 31, label: "2 Oct" },
              { day: 35, label: "6 Oct", movedOn: "23 Sep" },
            ],
          },
        ],
      },
      caption: "Each dot is a date the task was due. The filled dot is where it sits now.",
      facts: [
        { label: "Menu tasting", value: "11 → 18 → 29 Sep", how: "Moved twice, on 3 Sep and 22 Sep. 11 days later in total." },
        { label: "Tent hire", value: "2 → 6 Oct", how: "Moved once, on 23 Sep." },
        { label: "Days from tasting to wedding", value: "18", how: "29 Sep to Sat 17 Oct." },
      ],
    },
    people: {
      id: "people",
      title: "Who did what",
      chart: {
        type: "people",
        soonLabel: "due next week",
        rows: [
          { name: "Niamh", done: 6, soon: 4, later: 1 },
          { name: "Orla", done: 3, soon: 3, later: 1 },
          { name: "Cian", done: 2, soon: 4, later: 5 },
        ],
      },
      caption: "Finished this week, then still open. The amber part is due next week.",
      facts: [
        { label: "Niamh", value: "6 finished · 5 open", how: "4 of the open ones are due next week." },
        { label: "Orla", value: "3 finished · 4 open", how: "3 due next week." },
        { label: "Cian", value: "2 finished · 9 open", how: "4 due next week. The most open of anyone." },
      ],
    },
    groups: {
      id: "groups",
      title: "What moves, by kind",
      chart: {
        type: "units",
        tone: "warning",
        litLabel: "moved",
        restLabel: "kept its date",
        rows: [
          { name: "Suppliers", lit: 5, total: 7 },
          { name: "Guests", lit: 1, total: 6 },
          { name: "Venue", lit: 1, total: 5 },
          { name: "Paperwork", lit: 0, total: 4 },
        ],
      },
      caption: "The last few finished tasks in each group, one square each.",
      facts: [
        { label: "Suppliers", value: "5 of 7 moved", how: "The last 7 finished supplier tasks." },
        { label: "Guests", value: "1 of 6 moved", how: "The last 6 finished guest tasks." },
        { label: "Venue", value: "1 of 5 moved", how: "The last 5 finished venue tasks." },
        { label: "Paperwork", value: "0 of 4 moved", how: "The last 4 finished paperwork tasks." },
      ],
    },
    days: {
      id: "days",
      title: "Due in the next two weeks",
      mark: "next",
      chart: {
        type: "days",
        ranges: { next: [0, 6], after: [7, 13], nobody: [0, 6] },
        days: [
          { label: "Mon 28 Sep", count: 2, weekend: false },
          { label: "Tue 29 Sep", count: 3, weekend: false, nobody: 1 },
          { label: "Wed 30 Sep", count: 1, weekend: false },
          { label: "Thu 1 Oct", count: 4, weekend: false, nobody: 1 },
          { label: "Fri 2 Oct", count: 2, weekend: false },
          { label: "Sat 3 Oct", count: 1, weekend: true },
          { label: "Sun 4 Oct", count: 0, weekend: true },
          { label: "Mon 5 Oct", count: 1, weekend: false },
          { label: "Tue 6 Oct", count: 2, weekend: false },
          { label: "Wed 7 Oct", count: 3, weekend: false },
          { label: "Thu 8 Oct", count: 1, weekend: false },
          { label: "Fri 9 Oct", count: 2, weekend: false },
          { label: "Sat 10 Oct", count: 0, weekend: true },
          { label: "Sun 11 Oct", count: 0, weekend: true },
        ],
      },
      caption: "Tasks due each day. Weekends are shaded.",
      facts: [
        { label: "Due 28 Sep to 4 Oct", value: "13", how: "Open tasks with a due date that week." },
        { label: "With nobody on them", value: "2", how: "Due next week, no one assigned." },
        { label: "Due 5 to 11 Oct", value: "9", how: "Open tasks with a due date that week." },
      ],
    },
  },
  glyphs: {
    spark: { type: "spark", values: ORCHARD_DONE, current: 13 },
    trail: { type: "trail", stops: 3 },
    niamh: { type: "squares", total: 11, lit: 6, tone: "accent" },
    cian: { type: "squares", total: 9, lit: 4, tone: "warning" },
    strip: { type: "strip", values: [2, 3, 1, 4, 2, 1, 0, 1, 2, 3, 1, 2, 0, 0], lit: [0, 6] },
  },
};

const orchard: Project = {
  id: "orchard",
  name: "The Orchard",
  kind: "Events venue",
  swatch: 3,
  team: ["Orla", "Cian", "Niamh"],
  group: "main",
  state: "letters",
  letters: [
    orchardCurrent,
    ...orchardPast
      .map((w, i) =>
        pastLetter(
          { name: "The Orchard", teamLine: "Signal, for The Orchard team", values: ORCHARD_DONE, added: ORCHARD_ADDED, behind: ORCHARD_BEHIND, starts: ORCHARD_STARTS, unit: "finished", headlineFor: orchardHeadline },
          i,
          w,
        ),
      )
      .reverse(),
  ],
};

/* ── Mara & Finn (one wedding inside The Orchard) ─────────────────── */

const weddingCurrent: Letter = {
  key: "w13",
  week: "21 Sep",
  written: "Friday 25 September",
  mood: "On course, just",
  dots: [1, 2, 1, 2, 1],
  status: "On course",
  headline: "This week for Mara & Finn",
  dateline: "Friday 25 September · 22 days to go",
  lede: "Three weeks to go, and the wedding is on course, just. {19 things are left|left:all}, and at your recent pace that is about three weeks of work.",
  paras: [
    {
      id: "done",
      topic: "What got done",
      note: "done",
      text: "You finished {7 things|done:w13} for the wedding this week [[spark]], the most so far. The three that mattered: guest numbers are final at 142, the evening band has its set list, and the florist signed off on the arch.",
    },
    {
      id: "left",
      topic: "What is left",
      note: "left",
      text: "Of the 19 left, {the food is the one to watch|left:Food}: 5 tasks, and they all wait on the menu tasting, now on 29 Sep [[trail]]. {Flowers and music are nearly done|left:Flowers,Music}. {The day itself|left:On the day} has 7 small tasks that cannot start until the week of the wedding, which is normal.",
    },
    {
      id: "couple",
      topic: "Mara and Finn's part",
      note: "people",
      text: "Mara and Finn have {3 things of their own|people:Mara & Finn} [[couple]]: the seating plan, the readings and the music for the meal. The seating plan is due next Friday, and the table names cannot be printed without it.",
    },
    {
      id: "ahead",
      topic: "Looking ahead",
      note: "days",
      text: "{Next week has 8 wedding tasks due|days:next} [[strip]]. {The final week|days:final} is the busiest, as always, but most of it is setting up on the day before.",
    },
  ],
  short: [
    "On course, just: 19 things left, about three weeks of work.",
    "The food waits on the tasting, now 29 Sep.",
    "Mara and Finn owe the seating plan by next Friday.",
  ],
  actions: [
    { id: "remind", label: "Remind Mara and Finn about the seating plan", done: "Sent. They will get a note with a link to the plan.", kind: "primary" },
    { id: "tasting", label: "Confirm the tasting date", done: "Sent. Kitchen & Co. will get a note asking to confirm 29 Sep." },
    { id: "timeline", label: "Open the wedding timeline", done: "Opening the timeline.", kind: "link" },
  ],
  signoff: "Signal, for the Mara & Finn wedding",
  notes: {
    done: weeksNote(WEDDING_DONE, WEDDING_ADDED, ORCHARD_STARTS, 13, "finished", "Wedding tasks only."),
    left: {
      id: "left",
      title: "What is left, by part of the day",
      chart: {
        type: "units",
        tone: "accent",
        litLabel: "done",
        restLabel: "left",
        allLabel: "19 tasks left across five parts of the day",
        rows: [
          { name: "Food", lit: 3, total: 8 },
          { name: "Flowers", lit: 8, total: 10 },
          { name: "Music", lit: 5, total: 7 },
          { name: "Guests", lit: 12, total: 15 },
          { name: "On the day", lit: 0, total: 7 },
        ],
      },
      caption: "One square per task. Filled squares are done.",
      facts: [
        { label: "Tasks left before the day", value: "19", how: "Open wedding tasks, whoever they belong to." },
        { label: "Food", value: "3 of 8 done", how: "Waiting on the menu tasting." },
        { label: "On the day", value: "0 of 7 done", how: "These start in the wedding week." },
      ],
    },
    people: {
      id: "people",
      title: "Who has what",
      chart: {
        type: "people",
        soonLabel: "due next week",
        rows: [
          { name: "Niamh", done: 4, soon: 3, later: 3 },
          { name: "Orla", done: 2, soon: 2, later: 2 },
          { name: "Cian", done: 1, soon: 2, later: 2 },
          { name: "Mara & Finn", done: 0, soon: 1, later: 2 },
        ],
      },
      caption: "Finished this week, then still open. The amber part is due next week.",
      facts: [{ label: "Mara & Finn", value: "3 open", how: "Seating plan (due 2 Oct), readings, music for the meal." }],
    },
    days: {
      id: "days",
      title: "Wedding tasks due, three weeks",
      mark: "next",
      chart: {
        type: "days",
        ranges: { next: [0, 6], final: [14, 20] },
        days: [
          ["Mon 28 Sep", 1], ["Tue 29 Sep", 2], ["Wed 30 Sep", 1], ["Thu 1 Oct", 1], ["Fri 2 Oct", 2], ["Sat 3 Oct", 1], ["Sun 4 Oct", 0],
          ["Mon 5 Oct", 1], ["Tue 6 Oct", 1], ["Wed 7 Oct", 0], ["Thu 8 Oct", 1], ["Fri 9 Oct", 0], ["Sat 10 Oct", 0], ["Sun 11 Oct", 0],
          ["Mon 12 Oct", 0], ["Tue 13 Oct", 1], ["Wed 14 Oct", 0], ["Thu 15 Oct", 1], ["Fri 16 Oct", 5], ["Sat 17 Oct", 2], ["Sun 18 Oct", 0],
        ].map(([label, count]) => ({ label: label as string, count: count as number, weekend: /^S/.test(label as string) })),
      },
      caption: "Wedding tasks due each day, up to Sat 17 Oct.",
      facts: [
        { label: "Due next week", value: "8", how: "Wedding tasks due 28 Sep to 4 Oct." },
        { label: "Due in the wedding week", value: "9", how: "Mostly setting up on Fri 16 Oct." },
      ],
    },
  },
  glyphs: {
    spark: { type: "spark", values: WEDDING_DONE, current: 13 },
    trail: { type: "trail", stops: 3 },
    couple: { type: "squares", total: 3, lit: 0, tone: "accent" },
    strip: { type: "strip", values: [1, 2, 1, 1, 2, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 5, 2, 0], lit: [0, 6] },
  },
};

const weddingPast: PastWeek[] = [
  { mood: "Plans on paper", status: "On course", lede: "The wedding plan is on paper, with 38 tasks from the first call.", done: "You finished {5 things|done:w0} for the wedding.", who: "Orla wrote most of the plan.", ahead: "{On course|status:x}.", short: ["38 tasks planned.", "5 finished.", "On course."], notice: "It is early, so this letter only covers what happened, not trends." },
];

const WEDDING_STARTS = ORCHARD_STARTS;
const wedding: Project = {
  id: "wedding",
  name: "Mara & Finn wedding",
  kind: "Wedding at The Orchard",
  swatch: 8,
  team: ["Orla", "Cian", "Niamh", "Mara", "Finn"],
  group: "main",
  state: "letters",
  letters: [
    weddingCurrent,
    ...[
      { mood: "A good week", status: "On course", lede: "Five things done for the wedding, and the guest list is nearly closed.", done: "You finished {5 things|done:w12} [[spark]], most of them guest replies and the evening food.", who: "Orla chased the last guest replies.", ahead: "{On course|status:x}, with the tasting set for 18 Sep.", short: ["5 finished.", "Guest list nearly closed.", "Tasting on 18 Sep."] },
      { mood: "Steady", status: "On course", lede: "A steady week for the wedding: 4 things done, nothing moved.", done: "You finished {4 things|done:w11} [[spark]], and 98 guests have replied.", who: "Orla handled replies; Niamh the flowers.", ahead: "{On course|status:x}.", short: ["4 finished.", "98 replies in.", "On course."] },
      { mood: "The tasting moved", status: "On course", lede: "Six things done, but the menu tasting moved for the first time.", done: "You finished {6 things|done:w10} [[spark]], including the seating plan draft.", changed: "The menu tasting moved from 11 to 18 Sep.", who: "Niamh finished 3.", ahead: "{On course|status:x}, six weeks out.", short: ["6 finished.", "Tasting moved to 18 Sep.", "Six weeks to go."] },
      { mood: "Back on track", status: "On course", lede: "The band contract is signed, and the wedding is back on course.", done: "You finished {4 things|done:w9} [[spark]].", who: "Cian closed the band contract.", ahead: "{On course|status:x} again.", short: ["4 finished.", "Band contract signed.", "On course."] },
      { mood: "One slip", status: "1 week behind", lede: "A slower week, and the band contract slipped to 28 Aug.", done: "You finished {2 things|done:w8} [[spark]].", changed: "The band contract moved from 20 to 28 Aug.", who: "Cian is waiting on the band's agent.", ahead: "About {1 week behind|status:x}.", short: ["2 finished.", "Band contract slipped.", "1 week behind."] },
    ].map((w, k) =>
      pastLetter(
        { name: "Mara & Finn", teamLine: "Signal, for the Mara & Finn wedding", values: WEDDING_DONE, added: WEDDING_ADDED, behind: WEDDING_BEHIND, starts: WEDDING_STARTS, unit: "finished", headlineFor: (week) => `The week of ${week} for Mara & Finn` },
        12 - k,
        w as PastWeek,
      ),
    ),
    ...weddingPast.map((w) =>
      pastLetter(
        { name: "Mara & Finn", teamLine: "Signal, for the Mara & Finn wedding", values: WEDDING_DONE, added: WEDDING_ADDED, behind: WEDDING_BEHIND, starts: WEDDING_STARTS, unit: "finished", headlineFor: (week) => `The week of ${week} for Mara & Finn` },
        0,
        w,
      ),
    ),
  ],
};

/* ── Riverside survey (final-year student group) ──────────────────── */

const RIVER_STARTS = ["3 Aug", "10 Aug", "17 Aug", "24 Aug", "31 Aug", "7 Sep", "14 Sep", "21 Sep"];
const RIVER_DONE = [2, 3, 1, 4, 5, 3, 4, 4];

const riverCurrent: Letter = {
  key: "w7",
  week: "21 Sep",
  written: "Friday 25 September",
  mood: "Calm, one gap",
  dots: [0, 2, 1, 0, 1],
  status: "On course",
  headline: "This week on the Riverside survey",
  dateline: "Friday 25 September · 10 weeks to hand-in",
  lede: "Your hand-in is 10 weeks away. Nothing is urgent, but {the survey section has not started|parts:Survey}.",
  paras: [
    {
      id: "done",
      topic: "What got done",
      note: "done",
      text: "The ethics form went in on Tuesday, Emma finished the literature notes and Kofi set up the shared reference list. That is {4 things|done:w7}, about your usual week [[spark]].",
    },
    {
      id: "parts",
      topic: "Where each part stands",
      note: "parts",
      text: "{The literature review|parts:Literature review} is 7 of 9 done and {the method|parts:Method} is halfway. {The survey|parts:Survey} has 6 tasks and none are started [[survey]]. It is also the part that takes longest, because you have to wait for people to answer it.",
    },
    {
      id: "who",
      topic: "Who is doing what",
      note: "people",
      text: "Work is spread fairly evenly. {Emma|people:Emma} and {Kofi|people:Kofi} finished the most this month. {Dara's part|people:Dara} comes later in the plan, so a quiet few weeks from him is expected, not a worry.",
    },
    {
      id: "ahead",
      topic: "Looking ahead",
      note: "days",
      text: "The next two weeks are light, with {5 tasks due|days:all} [[strip]]. That makes them a good time to start the survey: if it goes out by 12 Oct, there are seven weeks left for answers and writing up.",
    },
  ],
  short: [
    "10 weeks to hand-in, and nothing is urgent.",
    "The survey has not started, and it takes the longest.",
    "The next two weeks are light: a good time to start it.",
  ],
  actions: [
    { id: "plan", label: "Plan the survey section", done: "Added a draft plan: 6 steps from writing questions to closing the survey.", kind: "primary" },
    { id: "owner", label: "Ask Saoirse to lead the survey", done: "Sent. Saoirse will get a note asking if she can lead it." },
    { id: "timeline", label: "Open the hand-in timeline", done: "Opening the timeline.", kind: "link" },
  ],
  signoff: "Signal, for the Riverside survey group",
  notes: {
    done: weeksNote(RIVER_DONE, undefined, RIVER_STARTS, 7, "finished", "Every week since the group started in August."),
    parts: {
      id: "parts",
      title: "Each part of the project",
      chart: {
        type: "units",
        tone: "accent",
        litLabel: "done",
        restLabel: "not done",
        rows: [
          { name: "Literature review", lit: 7, total: 9 },
          { name: "Method", lit: 3, total: 6 },
          { name: "Survey", lit: 0, total: 6 },
          { name: "Findings", lit: 0, total: 5 },
          { name: "Write-up", lit: 1, total: 8 },
        ],
      },
      caption: "One square per task. Findings and write-up follow the survey, so they are meant to wait.",
      facts: [
        { label: "Survey tasks started", value: "0 of 6", how: "Tasks in the survey group that are in progress or done." },
        { label: "Literature review", value: "7 of 9 done", how: "Tasks in that group moved to done." },
      ],
    },
    people: {
      id: "people",
      title: "Finished in the last four weeks",
      chart: {
        type: "bars",
        tone: "accent",
        rows: [
          { name: "Emma", value: 5, unit: "" },
          { name: "Kofi", value: 4, unit: "" },
          { name: "Saoirse", value: 3, unit: "" },
          { name: "Ruairí", value: 3, unit: "" },
          { name: "Dara", value: 1, unit: "" },
        ],
      },
      caption: "Tasks each person finished since 31 Aug.",
      facts: [{ label: "Finished since 31 Aug", value: "16", how: "Emma 5, Kofi 4, Saoirse 3, Ruairí 3, Dara 1." }],
    },
    days: {
      id: "days",
      title: "Due in the next two weeks",
      mark: "all",
      chart: {
        type: "days",
        ranges: { all: [0, 13] },
        days: [
          ["Mon 28 Sep", 1], ["Tue 29 Sep", 0], ["Wed 30 Sep", 0], ["Thu 1 Oct", 1], ["Fri 2 Oct", 0], ["Sat 3 Oct", 0], ["Sun 4 Oct", 0],
          ["Mon 5 Oct", 0], ["Tue 6 Oct", 2], ["Wed 7 Oct", 0], ["Thu 8 Oct", 0], ["Fri 9 Oct", 1], ["Sat 10 Oct", 0], ["Sun 11 Oct", 0],
        ].map(([label, count]) => ({ label: label as string, count: count as number, weekend: /^S/.test(label as string) })),
      },
      caption: "Tasks due each day. Weekends are shaded.",
      facts: [{ label: "Due in the next two weeks", value: "5", how: "Open tasks with a due date before 12 Oct." }],
    },
  },
  glyphs: {
    spark: { type: "spark", values: RIVER_DONE, current: 7 },
    survey: { type: "squares", total: 6, lit: 0, tone: "accent" },
    strip: { type: "strip", values: [1, 0, 0, 1, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0], lit: [0, 13] },
  },
};

const riverPast: PastWeek[] = [
  { mood: "Getting going", status: "Just started", notice: "It is early, so this letter only covers what happened, not trends.", lede: "Your group is set up and the plan has 34 tasks.", done: "You finished {2 things|done:w0}: the topic is agreed and the supervisor meeting is booked.", who: "Saoirse set up the plan.", ahead: "Nothing is due for two weeks, and {nothing is late|status:x}.", short: ["Group set up, 34 tasks.", "Topic agreed.", "Nothing late."] },
  { mood: "Summer pace", status: "On course", lede: "A summer week: 3 things done.", done: "You finished {3 things|done:w1} [[spark]].", who: "Emma and Kofi did most of it.", ahead: "{On course|status:x}.", short: ["3 finished.", "Summer pace.", "On course."] },
  { mood: "Quiet", status: "On course", lede: "A quiet week: 1 thing done, nothing late. Quiet is fine in August.", done: "You finished {1 thing|done:w2} [[spark]], the reading list.", who: "Only Ruairí was around.", ahead: "{On course|status:x}.", short: ["1 finished.", "Nothing late.", "Quiet is fine."] },
  { mood: "Picking up", status: "On course", lede: "Term is close and it shows: 4 things done.", done: "You finished {4 things|done:w3} [[spark]].", who: "Emma finished two.", ahead: "{On course|status:x}.", short: ["4 finished.", "Term is close.", "On course."] },
  { mood: "A good week", status: "On course", lede: "Your best week: 5 things done.", done: "You finished {5 things|done:w4} [[spark]], including the first draft of the method.", who: "Kofi and Saoirse wrote the method draft.", ahead: "{On course|status:x}.", short: ["5 finished.", "Method drafted.", "On course."] },
  { mood: "Steady", status: "On course", lede: "A steady week: 3 things done.", done: "You finished {3 things|done:w5} [[spark]].", who: "Spread across four of you.", ahead: "{On course|status:x}. The ethics form is due soon.", short: ["3 finished.", "Ethics form soon.", "On course."] },
  { mood: "Steady", status: "On course", lede: "A steady week: 4 things done, and the literature review is nearly there.", done: "You finished {4 things|done:w6} [[spark]].", who: "Emma led the literature review.", ahead: "{On course|status:x}.", short: ["4 finished.", "Literature review nearly done.", "On course."] },
];

const riverside: Project = {
  id: "riverside",
  name: "Riverside survey, final year",
  kind: "Student group",
  swatch: 2,
  team: ["Saoirse", "Dara", "Ruairí", "Emma", "Kofi"],
  group: "main",
  state: "letters",
  letters: [
    riverCurrent,
    ...riverPast
      .map((w, i) =>
        pastLetter(
          { name: "Riverside survey", teamLine: "Signal, for the Riverside survey group", values: RIVER_DONE, behind: [0, 0, 0, 0, 0, 0, 0, 0], starts: RIVER_STARTS, unit: "finished", headlineFor: (week) => `The week of ${week} on the Riverside survey` },
          i,
          w,
        ),
      )
      .reverse(),
  ],
};

/* ── Brightwater (agency rebrand, a harder week) ──────────────────── */

const BRIGHT_STARTS = ["10 Aug", "17 Aug", "24 Aug", "31 Aug", "7 Sep", "14 Sep", "21 Sep"];
const BRIGHT_DONE = [4, 6, 7, 5, 8, 9, 5];
const BRIGHT_ADDED = [12, 7, 6, 5, 4, 6, 8];

const brightCurrent: Letter = {
  key: "w6",
  week: "21 Sep",
  written: "Friday 25 September",
  mood: "A harder week",
  dots: [1, 2, 0, 1, 1],
  status: "Slightly behind",
  headline: "This week at Brightwater",
  dateline: "Friday 25 September · 38 days to the Hollis Café launch",
  lede: "A harder week. {Three things are late|late:all}, and the launch is 38 days away. None of it is serious yet, and two of the three can be fixed by Tuesday.",
  paras: [
    {
      id: "done",
      topic: "What got done",
      note: "done",
      text: "You finished {5 things|done:w6} [[spark]], down from 9 last week, but they were big ones: the logo is signed off and the new menu copy is written.",
    },
    {
      id: "late",
      topic: "What is late",
      note: "late",
      text: "{Booking the menu photography|late:Book menu photography} is 5 days late, and it matters most: the photographer needs two weeks' notice, and the menus cannot go to print without the photos. {The signage quote|late:Signage quote} is 3 days late and {the colour proofs|late:Colour proofs for print} are 1 day late.",
    },
    {
      id: "who",
      topic: "Who is carrying it",
      note: "people",
      text: "{Priya|people:Priya} is waiting on Hollis Café for the proofs, so that one is not hers to fix. {Jonah has 7 open|people:Jonah} [[jonah]], and 3 of them are late or due on Monday. {Ciara|people:Ciara} finished her part of the brand book and has space.",
    },
    {
      id: "changed",
      topic: "What changed",
      note: "moves",
      text: "One date moved: {the soft-launch tasting|moves:Soft-launch tasting} went from 24 to 28 Oct [[trail]], at the café's request. Five days before launch is tight but workable.",
    },
    {
      id: "ahead",
      topic: "Looking ahead",
      note: "status",
      text: "The launch date still works {if the photography is booked by Wednesday|status:x}. After that, the print deadline on 16 Oct starts to squeeze everything behind it.",
    },
  ],
  short: [
    "Three things are late; the launch is 38 days away.",
    "Book the menu photography by Wednesday, and the date still works.",
    "Jonah has too much; Ciara has space.",
  ],
  actions: [
    { id: "photo", label: "Book the photographer", done: "Opened the task. The photographer's details are in the notes.", kind: "primary" },
    { id: "chase", label: "Ask Hollis Café for the proofs", done: "Sent. The café will get a note asking for the proofs by Monday." },
    { id: "move", label: "Move the signage quote to Ciara", done: "Done. The signage quote now sits with Ciara." },
  ],
  signoff: "Signal, for the Brightwater team",
  notes: {
    done: weeksNote(BRIGHT_DONE, BRIGHT_ADDED, BRIGHT_STARTS, 6, "finished", "Every week since the rebrand started."),
    late: {
      id: "late",
      title: "Days late",
      chart: {
        type: "bars",
        tone: "warning",
        allLabel: "3 tasks late, 9 days late in total",
        rows: [
          { name: "Book menu photography", value: 5, unit: "days" },
          { name: "Signage quote", value: 3, unit: "days" },
          { name: "Colour proofs for print", value: 1, unit: "day" },
        ],
      },
      caption: "Open tasks past their due date, as of Friday morning.",
      facts: [
        { label: "Late tasks", value: "3", how: "Open tasks with a due date before today." },
        { label: "Longest late", value: "5 days", how: "Book menu photography, due 20 Sep." },
      ],
    },
    people: {
      id: "people",
      title: "Who has what",
      chart: {
        type: "people",
        soonLabel: "late or due Monday",
        rows: [
          { name: "Jonah", done: 1, soon: 3, later: 4 },
          { name: "Priya", done: 1, soon: 1, later: 3 },
          { name: "Tadhg", done: 1, soon: 1, later: 3 },
          { name: "Ciara", done: 2, soon: 0, later: 2 },
        ],
      },
      caption: "Finished this week, then still open. The amber part is late or due Monday.",
      facts: [{ label: "Jonah", value: "7 open", how: "3 late or due Monday 28 Sep." }],
    },
    moves: {
      id: "moves",
      title: "Dates that moved",
      chart: {
        type: "trail",
        today: 24,
        items: [
          { name: "Soft-launch tasting", points: [{ day: 53, label: "24 Oct" }, { day: 57, label: "28 Oct", movedOn: "23 Sep" }] },
        ],
      },
      caption: "The filled dot is where it sits now. Launch is 2 Nov.",
      facts: [{ label: "Soft-launch tasting", value: "24 → 28 Oct", how: "Moved once, on 23 Sep, at the café's request." }],
    },
    status: {
      id: "status",
      title: "Where things stand",
      chart: { type: "figure", value: "Slightly behind", unit: "" },
      caption: "At your recent pace the work fits before 2 Nov, but only if the photography is booked this week.",
      facts: [{ label: "Where things stand", value: "Slightly behind", how: ON_COURSE_HOW }],
    },
  },
  glyphs: {
    spark: { type: "spark", values: BRIGHT_DONE, current: 6 },
    jonah: { type: "squares", total: 7, lit: 3, tone: "warning" },
    trail: { type: "trail", stops: 2 },
  },
};

const brightPast: PastWeek[] = [
  { mood: "Kick-off", status: "Just started", notice: "It is early, so this letter only covers what happened, not trends.", lede: "The rebrand is set up: 42 tasks, four people, launch on 2 Nov.", done: "You finished {4 things|done:w0}, including the kick-off with the café.", who: "Tadhg ran the kick-off.", ahead: "{Nothing is late|status:x}.", short: ["42 tasks set up.", "Kick-off done.", "Launch 2 Nov."] },
  { mood: "Moving", status: "On course", lede: "Six things done, and the moodboard is approved.", done: "You finished {6 things|done:w1} [[spark]].", who: "Ciara finished the moodboard.", ahead: "{On course|status:x}.", short: ["6 finished.", "Moodboard approved.", "On course."] },
  { mood: "A good week", status: "On course", lede: "Seven things done, with the first logo round shown to the café.", done: "You finished {7 things|done:w2} [[spark]].", who: "Jonah and Ciara shared it.", ahead: "{On course|status:x}.", short: ["7 finished.", "First logo round shown.", "On course."] },
  { mood: "Steady", status: "On course", lede: "A steady week: 5 things done.", done: "You finished {5 things|done:w3} [[spark]].", who: "Spread evenly.", ahead: "{On course|status:x}.", short: ["5 finished.", "Steady.", "On course."] },
  { mood: "A good week", status: "On course", lede: "Eight things done, and the café chose a logo.", done: "You finished {8 things|done:w4} [[spark]].", who: "Jonah finished three.", ahead: "{On course|status:x}.", short: ["8 finished.", "Logo chosen.", "On course."] },
  { mood: "The best week yet", status: "On course", lede: "Your best week: 9 things done.", done: "You finished {9 things|done:w5} [[spark]], including the colour palette and type choices.", who: "Ciara and Jonah.", ahead: "{On course|status:x}, but the photography booking is due Sunday.", short: ["9 finished.", "Palette and type set.", "Photography due Sunday."] },
];

const brightwater: Project = {
  id: "brightwater",
  name: "Brightwater, rebrand for Hollis Café",
  kind: "Agency project",
  swatch: 5,
  team: ["Tadhg", "Ciara", "Jonah", "Priya"],
  group: "main",
  state: "letters",
  letters: [
    brightCurrent,
    ...brightPast
      .map((w, i) =>
        pastLetter(
          { name: "Brightwater", teamLine: "Signal, for the Brightwater team", values: BRIGHT_DONE, added: BRIGHT_ADDED, behind: [0, 0, 0, 0, 0, 0, 0], starts: BRIGHT_STARTS, unit: "finished", headlineFor: (week) => `The week of ${week} at Brightwater` },
          i,
          w,
        ),
      )
      .reverse(),
  ],
};

/* ── Garden fundraiser (no dates set) ─────────────────────────────── */

const gardenCurrent: Letter = {
  key: "w2",
  week: "21 Sep",
  written: "Friday 25 September",
  mood: "No dates yet",
  dots: [0, 1, 0, 2, 0],
  status: "Cannot tell yet",
  headline: "This week on the garden fundraiser",
  dateline: "Friday 25 September",
  notice: "None of the open tasks have dates, so I cannot tell you if you are on course. Add dates to the big ones.",
  lede: "You finished {3 things|done:w2} this week, and the plan is growing. What I cannot tell you yet is whether it fits the time you have.",
  paras: [
    {
      id: "done",
      topic: "What got done",
      note: "done",
      text: "The raffle licence is in, the bank account is open and the committee agreed a target of €4,000. That is three weeks in a row with something finished [[spark]].",
    },
    {
      id: "dates",
      topic: "What would help",
      note: "undated",
      text: "There are {12 open tasks|undated:all} and none has a date [[undated]]. You do not need dates on all of them. The three that look biggest, going by how much sits under them, are {booking the hall|undated:Book the hall}, {asking local businesses for raffle prizes|undated:Raffle prizes} and {printing the posters|undated:Posters}. Give those dates and next Friday I can tell you if you are on course.",
    },
  ],
  short: [
    "3 things finished this week.",
    "None of the 12 open tasks has a date.",
    "Date the three big ones and next week's letter can say if you are on course.",
  ],
  actions: [
    { id: "dates", label: "Add dates to the big three", done: "Opened the three tasks side by side, each with a date field ready.", kind: "primary" },
    { id: "plan", label: "Open the plan", done: "Opening the plan.", kind: "link" },
  ],
  signoff: "Signal, for the garden committee",
  notes: {
    done: weeksNote([2, 1, 3], undefined, ["7 Sep", "14 Sep", "21 Sep"], 2, "finished", "Every week since the committee started."),
    undated: {
      id: "undated",
      title: "Open tasks by size",
      chart: {
        type: "bars",
        tone: "neutral",
        allLabel: "12 open tasks, none with a date",
        rows: [
          { name: "Book the hall", value: 6, unit: "steps" },
          { name: "Raffle prizes", value: 5, unit: "steps" },
          { name: "Posters", value: 4, unit: "steps" },
          { name: "Volunteers rota", value: 2, unit: "steps" },
          { name: "Eight smaller tasks", value: 1, unit: "step each" },
        ],
      },
      caption: "Size is the number of checklist steps under each task. None has a date.",
      facts: [
        { label: "Open tasks", value: "12", how: "Tasks not yet done." },
        { label: "Open tasks with a date", value: "0", how: "Without dates there is nothing to measure the pace against." },
      ],
    },
  },
  glyphs: {
    spark: { type: "spark", values: [2, 1, 3], current: 2 },
    undated: { type: "squares", total: 12, lit: 0, tone: "neutral" },
  },
};

const garden: Project = {
  id: "garden",
  name: "Garden fundraiser",
  kind: "Community group",
  swatch: 4,
  team: ["Bríd", "Tom", "Aoife"],
  group: "other",
  state: "letters",
  letters: [gardenCurrent],
};

/* ── Hollis Café opening night (brand new, empty) ─────────────────── */

const opening: Project = {
  id: "opening",
  name: "Hollis Café, opening night",
  kind: "New project",
  swatch: 6,
  team: ["Tadhg", "Priya"],
  group: "other",
  state: "empty",
  letters: [],
  empty: {
    title: "No letter yet",
    body: "Your first one arrives on Friday 2 October, once there is a week of work to write about.",
    created: "Started on Wednesday with 4 tasks",
  },
};

export const PROJECTS: Project[] = [orchard, wedding, riverside, brightwater, garden, opening];

/* ── markup parsing ───────────────────────────────────────────────── */

export type Piece =
  | { kind: "text"; text: string }
  | { kind: "ref"; text: string; note: string; mark: string }
  | { kind: "glyph"; id: string };

export function parse(text: string): Piece[] {
  const out: Piece[] = [];
  const re = /\{([^|}]+)\|([a-z]+):([^}]+)\}|\[\[([a-z0-9]+)\]\]/gi;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: text.slice(last, at) });
    if (m[4]) out.push({ kind: "glyph", id: m[4] });
    else out.push({ kind: "ref", text: m[1], note: m[2], mark: m[3] });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export function plain(text: string): string {
  return parse(text)
    .map((p) => (p.kind === "glyph" ? "" : p.text))
    .join("")
    .replace(/\s+([,.:;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
