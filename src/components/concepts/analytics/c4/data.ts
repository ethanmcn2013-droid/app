/**
 * Analytics concept 4, "Project replay": sample history.
 *
 * Every Project is a list of tasks with a full life: when it was added, when
 * someone started it, each stretch it spent waiting on someone outside the
 * team, when it finished, and every time its date moved. The replay derives
 * every snapshot, number and sentence from these records (see model.ts), so
 * the board, the chart and the captions can never disagree.
 *
 * Days are indexes from the Project's first tracked day. Generation is seeded
 * so the server and the browser build the same history.
 */

export type Status = "todo" | "doing" | "waiting" | "done";

export type GroupDef = { id: string; name: string; tone: number };
export type PersonDef = {
  id: string;
  name: string;
  tone: number;
  joined: number;
  away?: { from: number; to: number };
};
export type Wait = { from: number; to: number; on: string };
export type Move = { day: number; to: number };

export type Task = {
  id: string;
  title: string;
  group: string;
  person: string;
  created: number;
  started: number | null;
  waits: Wait[];
  done: number | null;
  /** The first date it was given. */
  due: number;
  /** Each time the date moved: on which day, and to which date. */
  moves: Move[];
};

export type Milestone = { day: number; label: string };

export type Moment = {
  id: string;
  day: number;
  /** Short label for the pin tooltip and the chapter list. */
  label: string;
  /** The caption sentence, starting with the date. */
  sentence: string;
  /** The task this moment is about, if one. */
  taskId?: string;
};

export type ReplayProject = {
  id: string;
  name: string;
  kindLabel: string;
  tile: number;
  /** ISO date of day 0. */
  start: string;
  /** The last day the replay can reach: today, or the day it finished. */
  last: number;
  /** Today's index (may equal last). */
  today: number;
  /** Where the scrubber's axis ends (a due date after the finish, say). */
  axisEnd: number;
  groups: GroupDef[];
  people: PersonDef[];
  tasks: Task[];
  milestones: Milestone[];
  moments: Moment[];
  /** Present when the Project existed before its history was tracked. */
  tracked?: { began: string; note: string };
  /** Present when every task is finished. */
  finish?: { day: number; due: number };
  /** The big date the Project is working towards, if it is past the axis. */
  bigDay?: { day: number; label: string };
  /** One square per task, or one per five. */
  block: 1 | 5;
};

/* ── seeded randomness ─────────────────────────────────────────────── */

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) =>
    lo + Math.floor(next() * (hi - lo + 1));
  const pick = <T>(items: readonly T[]) =>
    items[Math.floor(next() * items.length)];
  const weighted = (pairs: readonly (readonly [string, number])[]) => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let roll = next() * total;
    for (const [v, w] of pairs) {
      roll -= w;
      if (roll <= 0) return v;
    }
    return pairs[pairs.length - 1][0];
  };
  return { next, int, pick, weighted };
}

type Rng = ReturnType<typeof rng>;

/* ── a generic life for a task ─────────────────────────────────────── */

type LifeSpec = {
  created: number;
  due: number;
  duration: [number, number];
  lead: [number, number];
  waitChance: number;
  waitOn: readonly string[];
  waitLength: [number, number];
  earliestStart?: number;
};

function live(r: Rng, s: LifeSpec) {
  const dur = r.int(s.duration[0], s.duration[1]);
  const lead = r.int(s.lead[0], s.lead[1]);
  let started = Math.max(s.created, s.earliestStart ?? 0, s.due - dur - lead);
  const roll = r.next();
  if (roll < 0.18) started = Math.max(s.created, started - r.int(3, 12));
  else if (roll > 0.72) started += r.int(2, 9); // it was left late
  const waits: Wait[] = [];
  let done = started + dur;
  if (r.next() < s.waitChance) {
    const from = started + Math.max(1, Math.floor(dur / 2));
    const len = r.int(s.waitLength[0], s.waitLength[1]);
    waits.push({ from, to: from + len, on: r.pick(s.waitOn) });
    done += len;
  }
  return { started, waits, done };
}

/** Push every event of a task that lands inside [from, to] past the gap. */
function shiftPast(t: Task, from: number, to: number, r: Rng) {
  const after = to + 1;
  const bump = (d: number) => (d >= from && d <= to ? after + r.int(0, 2) : d);
  if (t.started !== null && t.started >= from && t.started <= to) {
    const delta = bump(t.started) - t.started;
    t.started += delta;
    t.waits = t.waits.map((w) => ({
      ...w,
      from: w.from + delta,
      to: w.to + delta,
    }));
    if (t.done !== null) t.done += delta;
  }
  if (t.done !== null && t.done >= from && t.done <= to) t.done = bump(t.done);
  if (t.done !== null && t.started !== null && t.done < t.started)
    t.done = t.started;
}

/** Cut the story at the last visible day: anything later has not happened. */
function clip(t: Task, last: number): Task {
  const started = t.started !== null && t.started <= last ? t.started : null;
  const done = t.done !== null && t.done <= last ? t.done : null;
  const waits = started === null ? [] : t.waits.filter((w) => w.from <= last);
  const moves = t.moves.filter((m) => m.day <= last && m.day >= t.created);
  return { ...t, started, done, waits, moves };
}

function addSlips(
  r: Rng,
  t: Task,
  today: number,
  chanceOne: number,
  chanceTwo: number,
) {
  const end = t.done ?? today;
  if (end - t.created < 4) return;
  const roll = r.next();
  if (t.done !== null && t.done > t.due + 1 && r.next() < 0.55) {
    // It ran over: someone moved the date on the day it was due.
    t.moves.push({
      day: Math.max(t.created + 1, t.due - r.int(0, 2)),
      to: t.done + r.int(0, 3),
    });
    return;
  }
  if (roll < chanceTwo) {
    const d1 = t.created + Math.max(1, Math.floor((end - t.created) * 0.35));
    const d2 = t.created + Math.max(2, Math.floor((end - t.created) * 0.75));
    const to1 = t.due + r.int(4, 9);
    t.moves.push({ day: d1, to: to1 }, { day: d2, to: to1 + r.int(5, 12) });
  } else if (roll < chanceTwo + chanceOne) {
    const d1 =
      t.created + Math.max(1, Math.floor((end - t.created) * r.next()));
    t.moves.push({ day: d1, to: t.due + r.int(3, 10) });
  }
}

/* ── Mara & Finn wedding ───────────────────────────────────────────── */

const WEDDING_TITLES: Record<string, string[]> = {
  venue: [
    "Get the venue floor plan",
    "Walk-through with the venue",
    "Book the photographer",
    "Book the florist",
    "Confirm ceremony room layout",
    "Plan the wet-weather option",
    "Book the hair and make-up trial",
    "Confirm the bar licence",
    "Hire the vintage car",
    "Book the rooms for family",
    "Check the accessible entrance",
    "Choose table flowers",
    "Book the marquee lighting",
    "Confirm heaters for the tent",
    "Agree the setup times",
    "Sort the parking plan",
    "Shot list for the photographer",
    "Order the arch flowers",
    "Confirm candle rules with the venue",
    "Book the portable toilets",
    "Plan the table layout",
    "Confirm the dance floor size",
    "Chairs and linen count",
    "Order signage for the drive",
    "Order the welcome sign",
    "Book hair and make-up for the day",
    "Plan the drop-off route",
    "Confirm the late finish",
    "Book the cleaning crew",
  ],
  food: [
    "Shortlist caterers",
    "Book the caterer",
    "Pay the caterer deposit",
    "First tasting",
    "Order the cake",
    "Cake tasting",
    "Pick the wine",
    "Choose the canapés",
    "Confirm dietary needs",
    "Vegan options with the caterer",
    "Children's menu",
    "Book the coffee cart",
    "Plan the late-night food",
    "Choose the cocktails",
    "Order the prosecco for the drinks",
    "Confirm the bar staff",
    "Pick the dessert table",
    "Confirm the cheese board",
    "Book the cake stand",
    "Order the favours",
    "Plan the kids' table snacks",
    "Glassware count",
    "Confirm serving times",
    "Order the ice",
    "Plan for leftovers",
  ],
  guests: [
    "Draft the guest list",
    "Collect addresses",
    "Save the dates",
    "Design the invitations",
    "Print the invitations",
    "Post the invitations",
    "Set up the reply form",
    "Gift list online",
    "Book the guest block at the hotel",
    "Send the travel guide",
    "Chase missing replies",
    "Confirm plus-ones",
    "Plan the shuttle bus",
    "Plan the rehearsal dinner",
    "Invite for the rehearsal dinner",
    "Confirm the readers",
    "Seating plan first draft",
    "Welcome bags",
    "Kids' activity pack",
    "Order the umbrellas",
    "Seating plan final",
    "Table names",
    "Place cards",
    "Guest book",
    "Plan the morning-after brunch",
    "Thank-you card list",
  ],
  music: [
    "Book the band",
    "Book the DJ",
    "Book the string trio",
    "Book the singer for the church",
    "Ceremony music",
    "Walk-down song",
    "First dance song",
    "Dance lessons",
    "Confirm the piper",
    "Book dance lesson two",
    "Playlist for dinner",
    "Do-not-play list",
    "Pick the cake-cutting song",
    "Confirm the PA for speeches",
    "Speech microphones",
    "Power check for the band",
    "Band sound check time",
    "Confirm the band's meal",
    "Send the band the timings",
    "Last song of the night",
  ],
  paper: [
    "Give notice to the registrar",
    "Get the birth certs",
    "Book the registrar",
    "Pre-marriage course",
    "Wedding insurance",
    "Pay the venue deposit",
    "Pay the band deposit",
    "Dress fitting one",
    "Suit fitting",
    "Rings: book the fitting",
    "Budget check-in",
    "Track deposits",
    "Marriage licence form",
    "Choose the readings",
    "Book the honeymoon",
    "Vows first draft",
    "Dress fitting two",
    "Order of service",
    "Print the order of service",
    "Collect the rings",
    "Name change forms",
    "Timeline for the day",
    "Send timings to suppliers",
    "Final dress fitting",
    "Vows final",
    "Emergency kit",
  ],
};

const MENU_CHANGE = [
  "Rework the main course",
  "New tasting for the menu change",
  "Reprice the menu",
  "Swap the wine pairing",
  "Reorder the canapés",
  "Update dietary cards",
  "Confirm new menu with the venue",
  "Tell guests about the new menu",
  "Print the new menu cards",
];

const FINAL_NUMBERS = [
  "Send final numbers to the caterer",
  "Final numbers to the venue",
  "Final numbers for the cake",
  "Final count for the shuttle",
  "Final count for the favours",
  "Update the seating plan with final numbers",
];

const WAIT_ON: Record<string, string[]> = {
  venue: ["the venue", "the florist", "the photographer", "the hire company"],
  food: ["the caterer", "the caterer", "the baker", "the wine merchant"],
  guests: ["replies from guests", "the printer", "the hotel"],
  music: ["the band", "the DJ", "the string trio"],
  paper: ["the registrar", "the parish", "the jeweller", "the insurer"],
};

function wedding(): ReplayProject {
  const r = rng(20261017);
  const today = 95;
  const bigDay = 117; // 17 Oct
  const groups: GroupDef[] = [
    { id: "venue", name: "Venue", tone: 1 },
    { id: "food", name: "Food", tone: 2 },
    { id: "guests", name: "Guests", tone: 3 },
    { id: "music", name: "Music", tone: 4 },
    { id: "paper", name: "Paperwork", tone: 5 },
  ];
  const people: PersonDef[] = [
    { id: "orla", name: "Orla", tone: 3, joined: 0 },
    {
      id: "cian",
      name: "Cian",
      tone: 2,
      joined: 0,
      away: { from: 56, to: 67 },
    },
    { id: "niamh", name: "Niamh", tone: 4, joined: 7 },
    { id: "aoife", name: "Aoife", tone: 1, joined: 45 },
    { id: "dara", name: "Dara", tone: 6, joined: 61 },
  ];
  const who: Record<string, (created: number) => [string, number][]> = {
    venue: (c) => [
      ["orla", 6],
      ["cian", 4],
      ...(c >= 45 ? ([["aoife", 2]] as [string, number][]) : []),
    ],
    food: () => [
      ["cian", 7],
      ["orla", 3],
    ],
    guests: (c) => [
      ["niamh", 5],
      ["orla", 3],
      ...(c >= 45 ? ([["aoife", 4]] as [string, number][]) : []),
    ],
    music: (c) => [
      ["niamh", 7],
      ["orla", 1],
      ...(c >= 61 ? ([["dara", 5]] as [string, number][]) : []),
    ],
    paper: () => [
      ["orla", 8],
      ["niamh", 2],
    ],
  };

  const tasks: Task[] = [];
  let seq = 0;
  const id = () => `w${++seq}`;

  for (const g of groups) {
    const list = WEDDING_TITLES[g.id];
    const firstBatch = Math.round(list.length * 0.42);
    list.forEach((title, i) => {
      const created =
        i < firstBatch
          ? 0
          : Math.min(
              94,
              Math.round(
                1 +
                  ((i - firstBatch + r.next() * 0.9) /
                    (list.length - firstBatch)) *
                    92,
              ),
            );
      const share = i / list.length;
      const due =
        i < firstBatch
          ? Math.round(12 + share * 100 + r.int(-4, 6))
          : Math.min(bigDay - 2, created + r.int(10, 44));
      const person = r.weighted(who[g.id](created));
      const life = live(r, {
        created,
        due,
        duration: [1, 6],
        lead: [0, 10],
        waitChance: g.id === "guests" ? 0.22 : 0.42,
        waitOn: WAIT_ON[g.id],
        waitLength: [2, 9],
        earliestStart: person === "niamh" ? 7 : 0,
      });
      tasks.push({
        id: id(),
        title,
        group: g.id,
        person,
        created,
        due,
        moves: [],
        ...life,
      });
    });
  }

  // Invitations went out on 20 Jul.
  const post = tasks.find((t) => t.title === "Post the invitations");
  if (post) Object.assign(post, { started: 26, waits: [], done: 28, due: 28 });
  const print = tasks.find((t) => t.title === "Print the invitations");
  if (print)
    Object.assign(print, {
      started: 17,
      waits: [{ from: 18, to: 24, on: "the printer" }],
      done: 25,
      due: 24,
    });

  // Tent hire: the task that kept slipping.
  tasks.push({
    id: "tent",
    title: "Confirm tent hire",
    group: "venue",
    person: "orla",
    created: 0,
    started: 9,
    waits: [
      { from: 13, to: 30, on: "the tent company" },
      { from: 58, to: 79, on: "the tent company" },
    ],
    done: 83,
    due: 20,
    moves: [
      { day: 19, to: 41 },
      { day: 70, to: 84 },
    ],
  });

  // Menu change on 3 Aug: nine new tasks in two days, most for Cian.
  MENU_CHANGE.forEach((title, i) => {
    const created = i < 6 ? 42 : 43;
    const person = i === 3 || i === 7 ? "orla" : "cian";
    const due = 50 + i * 3 + r.int(0, 4);
    const life = live(r, {
      created,
      due,
      duration: [2, 5],
      lead: [0, 6],
      waitChance: 0.5,
      waitOn: ["the caterer"],
      waitLength: [3, 7],
    });
    tasks.push({
      id: id(),
      title,
      group: "food",
      person,
      created,
      due,
      moves: [],
      ...life,
    });
  });

  // Final numbers on 10 Sep: six tasks, all closed within two days.
  FINAL_NUMBERS.forEach((title, i) => {
    const person = i < 3 ? "cian" : i < 5 ? "niamh" : "aoife";
    tasks.push({
      id: id(),
      title,
      group: i < 3 ? "food" : "guests",
      person,
      created: 80,
      started: 80,
      waits: [],
      done: i < 4 ? 80 : 81,
      due: 82,
      moves: [],
    });
  });

  // Cian was away 17 to 28 Aug: nothing of his moved.
  for (const t of tasks)
    if (t.person === "cian" && t.id !== "tent") shiftPast(t, 56, 67, r);

  for (const t of tasks) if (t.id !== "tent") addSlips(r, t, today, 0.12, 0.05);

  const clipped = tasks.map((t) => clip(t, today));

  return {
    id: "wedding",
    name: "Mara & Finn wedding",
    kindLabel: "Wedding",
    tile: 8,
    start: "2026-06-22",
    last: today,
    today,
    axisEnd: today,
    groups,
    people,
    tasks: clipped,
    milestones: [
      { day: 28, label: "Invitations sent" },
      { day: 42, label: "Menu changed" },
      { day: 80, label: "Final numbers" },
    ],
    moments: [],
    bigDay: { day: bigDay, label: "Wedding, 17 Oct" },
    block: 1,
  };
}

/* ── Riverside survey (student group, finished) ────────────────────── */

const RIVERSIDE: [string, string][] = [
  ["read", "Read the brief together"],
  ["read", "Pick the stretch of river"],
  ["read", "Find three past surveys"],
  ["read", "Summarise the council report"],
  ["read", "Read the water quality paper"],
  ["read", "Agree who does what"],
  ["read", "Book a tutor check-in"],
  ["read", "List the questions for residents"],
  ["field", "Draft the resident survey"],
  ["field", "Test the survey on two friends"],
  ["field", "Print 60 survey sheets"],
  ["field", "Borrow the water testing kit"],
  ["field", "Plan the walking route"],
  ["field", "Ask the rowing club for access"],
  ["field", "Survey day one: north bank"],
  ["field", "Survey day two: south bank"],
  ["field", "Water samples at five points"],
  ["field", "Photos of each point"],
  ["field", "Return the testing kit"],
  ["data", "Type up the survey sheets"],
  ["data", "Clean up the spreadsheet"],
  ["data", "Chart the water results"],
  ["data", "Map the survey points"],
  ["data", "Compare with the council report"],
  ["data", "Find the three main findings"],
  ["write", "Outline the report"],
  ["write", "Write the introduction"],
  ["write", "Write the method"],
  ["write", "Write the findings"],
  ["write", "Write the conclusion"],
  ["write", "Make the slides"],
  ["write", "Check the references"],
  ["write", "Add the tutor's changes"],
  ["write", "Redo the map legend"],
  ["write", "Second pass on findings"],
  ["write", "Proofread the whole thing"],
  ["write", "Practise the talk"],
  ["write", "Hand it in"],
];

function riverside(): ReplayProject {
  const r = rng(4411);
  const finishDay = 69; // 26 Aug
  const dueDay = 72; // 29 Aug
  const checkIn = 52; // 9 Aug
  const groups: GroupDef[] = [
    { id: "read", name: "Reading", tone: 3 },
    { id: "field", name: "Fieldwork", tone: 1 },
    { id: "data", name: "Analysis", tone: 2 },
    { id: "write", name: "Write-up", tone: 6 },
  ];
  const people: PersonDef[] = [
    { id: "ava", name: "Ava", tone: 3, joined: 0 },
    { id: "tomas", name: "Tomás", tone: 2, joined: 0 },
    { id: "leah", name: "Leah", tone: 4, joined: 0 },
    { id: "sam", name: "Sam", tone: 1, joined: 0 },
  ];
  const owners = ["ava", "tomas", "leah", "sam"];
  const tasks: Task[] = RIVERSIDE.map(([group, title], i) => {
    const late = i >= 32; // added after the tutor check-in
    const created = late ? checkIn + 1 + (i - 32) : i < 20 ? 0 : r.int(3, 20);
    const person = owners[(i + (i >> 2)) % 4];
    let started: number | null;
    let done: number | null;
    const waits: Wait[] = [];
    if (i < 3) {
      // The slow start: a handful done in the first month.
      started = r.int(2, 9);
      done = started + r.int(4, 12);
    } else if (!late) {
      // The burst before the check-in: most of the work lands in three weeks.
      started = 30 + Math.round((i / 32) * 14) + r.int(-2, 2);
      done = Math.min(checkIn - 1, started + r.int(1, 5));
      if (title.startsWith("Ask the rowing"))
        waits.push({
          from: started + 1,
          to: started + 6,
          on: "the rowing club",
        });
      if (title.startsWith("Survey day")) done = started + 1;
      if (i >= 25) done = Math.min(finishDay - 2, started + r.int(8, 16));
    } else {
      started = created + r.int(1, 4);
      done = Math.min(finishDay, started + r.int(2, 7));
    }
    if (title === "Hand it in") {
      started = finishDay - 1;
      done = finishDay;
    }
    if (title === "Book a tutor check-in") {
      started = 12;
      waits.push({ from: 13, to: 19, on: "the tutor" });
      done = 20;
    }
    const due = late
      ? created + 8
      : i < 8
        ? 21
        : i < 19
          ? 45
          : i < 25
            ? 55
            : dueDay - 3;
    return {
      id: `r${i + 1}`,
      title,
      group,
      person,
      created,
      started,
      waits,
      done,
      due,
      moves: [],
    };
  });
  for (const t of tasks) addSlips(r, t, finishDay, 0.1, 0);
  const slow = tasks.find((t) => t.title === "Find three past surveys");
  if (slow)
    slow.moves = [
      { day: 12, to: 26 },
      { day: 22, to: 38 },
    ];
  return {
    id: "riverside",
    name: "Riverside survey",
    kindLabel: "Student group",
    tile: 3,
    start: "2026-06-18",
    last: finishDay,
    today: finishDay,
    axisEnd: dueDay,
    groups,
    people,
    tasks,
    milestones: [
      { day: checkIn, label: "Tutor check-in" },
      { day: dueDay, label: "Due" },
    ],
    moments: [],
    finish: { day: finishDay, due: dueDay },
    block: 1,
  };
}

/* ── Brightwater rebrand (agency, large, tracked mid-way) ──────────── */

const BW_PARTS: Record<string, { things: string[]; verbs: string[] }> = {
  identity: {
    things: [
      "logo lockups",
      "colour palette",
      "type scale",
      "icon set",
      "brand voice",
      "photo style",
      "pattern library",
      "brand guide",
      "favicon",
      "email signature",
      "social avatars",
      "business cards",
    ],
    verbs: ["Draft", "Review", "Refine", "Sign off", "Export"],
  },
  web: {
    things: [
      "home page",
      "menu page",
      "booking flow",
      "about page",
      "events page",
      "gift cards page",
      "footer",
      "contact form",
      "gallery",
      "image set",
      "page speed",
      "search listing",
    ],
    verbs: ["Wireframe", "Design", "Build", "Test", "Launch"],
  },
  signage: {
    things: [
      "shop front sign",
      "door vinyl",
      "window menu",
      "wayfinding",
      "terrace board",
      "van wrap",
      "staff badges",
      "till screen",
    ],
    verbs: ["Measure", "Design", "Quote", "Approve", "Install"],
  },
  social: {
    things: [
      "launch post",
      "opening week reel",
      "staff profiles",
      "menu teaser",
      "story highlights",
      "review replies",
      "listing photos",
      "launch giveaway",
      "press kit",
      "local press note",
    ],
    verbs: ["Plan", "Write", "Shoot", "Schedule", "Post"],
  },
  print: {
    things: [
      "takeaway bags",
      "coffee cups",
      "napkins",
      "loyalty cards",
      "flyers",
      "gift vouchers",
      "letterhead",
      "stickers",
    ],
    verbs: ["Design", "Proof", "Order", "Check delivery of"],
  },
  menu: {
    things: [
      "breakfast menu",
      "lunch menu",
      "dinner menu",
      "drinks list",
      "kids' menu",
      "allergen key",
      "specials board",
      "dessert card",
      "wine list",
      "menu photos",
      "table talkers",
      "online menu",
    ],
    verbs: ["Rewrite", "Lay out", "Price", "Photograph", "Proof", "Print"],
  },
};

function brightwater(): ReplayProject {
  const r = rng(9031);
  const today = 95;
  const scopeDay = 49; // 10 Aug
  const groups: GroupDef[] = [
    { id: "identity", name: "Identity", tone: 5 },
    { id: "web", name: "Website", tone: 3 },
    { id: "signage", name: "Signage", tone: 1 },
    { id: "print", name: "Print", tone: 4 },
    { id: "social", name: "Social", tone: 6 },
    { id: "menu", name: "Menu redesign", tone: 2 },
  ];
  const people: PersonDef[] = [
    { id: "jess", name: "Jess", tone: 3, joined: 0 },
    { id: "marco", name: "Marco", tone: 2, joined: 0 },
    { id: "priya", name: "Priya", tone: 4, joined: 0 },
    { id: "tom", name: "Tom", tone: 1, joined: 0 },
    { id: "eva", name: "Eva", tone: 5, joined: 50 },
    { id: "kai", name: "Kai", tone: 6, joined: 56 },
  ];
  const owners: Record<string, [string, number][]> = {
    identity: [
      ["jess", 6],
      ["priya", 3],
    ],
    web: [
      ["marco", 6],
      ["tom", 3],
      ["kai", 2],
    ],
    signage: [
      ["tom", 5],
      ["priya", 3],
    ],
    print: [
      ["priya", 5],
      ["jess", 2],
    ],
    social: [
      ["jess", 3],
      ["tom", 2],
      ["kai", 3],
    ],
    menu: [
      ["eva", 5],
      ["jess", 2],
      ["kai", 3],
      ["priya", 1],
    ],
  };
  const tasks: Task[] = [];
  let seq = 0;
  for (const g of groups) {
    const { things, verbs } = BW_PARTS[g.id];
    const isMenu = g.id === "menu";
    things.forEach((thing, ti) => {
      verbs.forEach((verb, vi) => {
        const rounds = !isMenu && vi === 1 ? (ti % 3 === 0 ? 3 : 2) : 1;
        for (let k = 0; k < rounds; k++) {
          const title = `${verb} ${thing}${k ? " (second round)" : ""}`;
          const progress =
            (ti / things.length) * 0.6 + (vi / verbs.length) * 0.4;
          let created: number;
          if (isMenu)
            created = scopeDay + (ti < 8 ? r.int(0, 3) : r.int(4, 40));
          else
            created =
              progress < 0.36
                ? 0
                : Math.min(
                    94,
                    Math.round((progress - 0.36) * 140 + r.int(-6, 10)),
                  );
          created = Math.max(0, created);
          const due = isMenu
            ? created + r.int(10, 40)
            : Math.round(-20 + progress * 150 + r.int(-5, 8));
          let person = r.weighted(owners[g.id]);
          if (!isMenu && person === "kai" && created < 56) person = "marco";
          const life = live(r, {
            created,
            due: Math.max(created + 3, due),
            duration: [1, 5],
            lead: [0, 8],
            waitChance: g.id === "print" || g.id === "signage" ? 0.5 : 0.3,
            waitOn:
              g.id === "print"
                ? ["the printer"]
                : g.id === "signage"
                  ? ["the sign maker", "the landlord"]
                  : ["the client"],
            waitLength: [2, 8],
          });
          // Work done before tracking began sits in Done on day one.
          if (created === 0 && progress < 0.24) {
            life.started = 0;
            life.done = 0;
            life.waits = [];
          }
          tasks.push({
            id: `b${++seq}`,
            title,
            group: g.id,
            person,
            created,
            due: Math.max(created + 3, due),
            moves: [],
            ...life,
          });
        }
      });
    });
  }
  for (const t of tasks) addSlips(r, t, today, 0.12, 0.03);
  return {
    id: "brightwater",
    name: "Brightwater rebrand",
    kindLabel: "Agency",
    tile: 2,
    start: "2026-06-22",
    last: today,
    today,
    axisEnd: today,
    groups,
    people,
    tasks: tasks.map((t) => clip(t, today)),
    milestones: [
      { day: scopeDay, label: "Menu redesign added" },
      { day: 77, label: "Website live" },
    ],
    moments: [],
    tracked: { began: "4 May", note: "History starts 22 Jun" },
    block: 5,
  };
}

/* ── Harbour lights launch (brand new) ─────────────────────────────── */

function harbour(): ReplayProject {
  const titles: [string, string][] = [
    ["plan", "Pick the launch date"],
    ["plan", "Agree the budget"],
    ["plan", "List the partners"],
    ["venue", "Walk the harbour with the council"],
    ["venue", "Ask about power on the pier"],
    ["venue", "Book the lighting crew"],
    ["word", "Write the press note"],
    ["word", "Brief the photographer"],
    ["word", "Design the poster"],
    ["plan", "Plan the opening night"],
    ["venue", "Check the insurance"],
    ["word", "Set up the sign-up page"],
  ];
  const tasks: Task[] = titles.map(([group, title], i) => ({
    id: `h${i + 1}`,
    title,
    group,
    person: ["sive", "ruairi", "sive"][i % 3],
    created: 0,
    started: i === 0 || i === 3 ? 0 : null,
    waits: [],
    done: null,
    due: 7 + i * 3,
    moves: [],
  }));
  return {
    id: "harbour",
    name: "Harbour lights launch",
    kindLabel: "Event",
    tile: 5,
    start: "2026-09-25",
    last: 0,
    today: 0,
    axisEnd: 0,
    groups: [
      { id: "plan", name: "Planning", tone: 5 },
      { id: "venue", name: "On site", tone: 1 },
      { id: "word", name: "Getting the word out", tone: 4 },
    ],
    people: [
      { id: "sive", name: "Síve", tone: 3, joined: 0 },
      { id: "ruairi", name: "Ruairí", tone: 2, joined: 0 },
    ],
    tasks,
    milestones: [],
    moments: [],
    block: 1,
  };
}

export const RAW_PROJECTS: ReplayProject[] = [
  wedding(),
  riverside(),
  brightwater(),
  harbour(),
];
