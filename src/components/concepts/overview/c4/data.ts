/*
 * Sample data for concept 4, "One decision at a time".
 * Today is Thursday 16 July. Dates are stored as day numbers counted from
 * 1 July (1 Aug = 32), which keeps the timeline maths trivial.
 */

export const TODAY = 16;

export type PersonId = "you" | "tomas" | "aoife" | "priya" | "cian" | "mara" | "niamh" | "rory";

export type Person = { id: PersonId; name: string; initials: string; tone: string };

export const PEOPLE: Record<PersonId, Person> = {
  you: { id: "you", name: "You", initials: "DO", tone: "var(--v3-project-1)" },
  tomas: { id: "tomas", name: "Tomás", initials: "TR", tone: "var(--v3-project-3)" },
  aoife: { id: "aoife", name: "Aoife", initials: "AB", tone: "var(--v3-project-8)" },
  priya: { id: "priya", name: "Priya", initials: "PS", tone: "var(--v3-project-2)" },
  cian: { id: "cian", name: "Cian", initials: "CM", tone: "var(--v3-project-4)" },
  mara: { id: "mara", name: "Mara", initials: "MK", tone: "var(--v3-project-6)" },
  niamh: { id: "niamh", name: "Niamh", initials: "NF", tone: "var(--v3-project-5)" },
  rory: { id: "rory", name: "Rory", initials: "RD", tone: "var(--v3-project-7)" },
};

export type ProjectId = "orchard" | "harvest";

export const PROJECTS: Record<ProjectId, { id: ProjectId; name: string; short: string; initial: string; tone: string }> = {
  orchard: { id: "orchard", name: "The Orchard, events", short: "The Orchard", initial: "T", tone: "var(--v3-project-3)" },
  harvest: { id: "harvest", name: "Harvest supper club", short: "Harvest", initial: "H", tone: "var(--v3-project-2)" },
};

export type Kind = "slipped" | "overload" | "risk" | "waiting" | "reply";

export const KIND_LABEL: Record<Kind, string> = {
  slipped: "Something slipped",
  overload: "Someone is overloaded",
  risk: "At risk",
  waiting: "Waiting on you",
  reply: "Reply needed",
};

/* A row on a decision's mini timeline. `start` to `end` in day numbers. */
export type Track = {
  id: string;
  label: string;
  start: number;
  end: number;
  owner: PersonId;
  milestone?: boolean;
};

export type Evidence =
  | { type: "activity"; title: string; meta: string }
  | { type: "message"; who: PersonId; quote: string; meta: string }
  | { type: "task"; title: string; meta: string }
  | { type: "file"; title: string; meta: string };

export type Draft = { to: string; channel: "Messages" | "Email"; body: string };

export type Choice = {
  id: string;
  label: string;
  hint: string;
  /** One plain sentence: what the world looks like after this call. */
  summary: string;
  /** Past tense, for the receipt. */
  filed: string;
  tone: "calm" | "shift" | "risk";
  moves?: Record<string, number>;
  /** Where a track could slip to if this call leaves the risk open. */
  risk?: Record<string, number>;
  owners?: Record<string, PersonId>;
  adds?: Track[];
  /** Change in open tasks per person, besides the tasks this call finishes. */
  load?: Partial<Record<PersonId, number>>;
  draft?: Draft;
  /** Project tasks this call finishes. */
  completes?: string[];
  /** Overrides the guard's driver for this choice; null means nothing blocks the date any more. */
  driver?: string | null;
};

export type DeferOption = { id: string; label: string; detail: string; until: number };

/*
 * The date a decision protects. Every choice is read against it: how many
 * days sit between the work it depends on (the driver) and the date itself.
 */
export type Guard = {
  track: string;
  driver: string;
  short: string;
  /** At or above this many days the date is comfortable. */
  comfortable: number;
  /** "to spare" by default; "to sell" for ticket sales. */
  word?: string;
};

export type Decision = {
  id: string;
  project: ProjectId;
  kind: Kind;
  short: string;
  question: string;
  context: string;
  since: string;
  evidence: Evidence[];
  tracks: Track[];
  guard: Guard;
  /** Whose open tasks the choice panel shows. */
  people: PersonId[];
  choices: Choice[];
  defer: DeferOption[];
  moot?: { by: PersonId; at: string; text: string };
};

const TOMORROW: DeferOption = { id: "tomorrow", label: "Tomorrow morning", detail: "Fri 17 Jul, 08:30", until: 17 };

export const ORCHARD: Decision[] = [
  {
    id: "olives",
    project: "orchard",
    kind: "slipped",
    short: "Olives are late",
    question: "The olives are two days late. What now?",
    context:
      "Tomás owns the olive and tonic order. It was due on Tuesday, and Priya needs it for the kitchen trial of the tasting menu on 22 Jul. His supplier is short on Nocellara until Monday, so he is waiting for your steer.",
    since: "Late since Tue 14 Jul",
    evidence: [
      { type: "activity", title: "Marked blocked", meta: "Tomás, 2 days ago" },
      { type: "message", who: "tomas", quote: "Supplier short on Nocellara until Monday.", meta: "Tue 14 Jul" },
      { type: "task", title: "Order tonic + the good olives", meta: "Due Tue 14 Jul" },
    ],
    tracks: [
      { id: "olives", label: "Olive and tonic order", start: 9, end: 14, owner: "tomas" },
      { id: "trial", label: "Kitchen trial", start: 22, end: 22, owner: "priya", milestone: true },
      { id: "tasting", label: "Menu tasting", start: 32, end: 32, owner: "priya", milestone: true },
      { id: "signoff", label: "Final menu sign-off", start: 39, end: 39, owner: "you", milestone: true },
    ],
    guard: { track: "trial", driver: "olives", short: "Kitchen trial", comfortable: 4 },
    people: ["tomas", "you", "priya"],
    choices: [
      {
        id: "friday",
        label: "Give Tomás until Friday",
        hint: "He can get a half case from Kinsale by then",
        summary: "The order lands Friday, five days before the kitchen trial. Only the order moves.",
        filed: "Gave Tomás until Friday",
        tone: "calm",
        moves: { olives: 17 },
        draft: {
          to: "Tomás",
          channel: "Messages",
          body: "Friday is fine. If Kinsale can't cover the Nocellara, tell me by noon and we'll switch to the Sheridans order.",
        },
      },
      {
        id: "self",
        label: "Take it on yourself",
        hint: "You order direct from Sheridans today",
        summary: "The order is yours and lands today. Tomás drops to 6 open tasks.",
        filed: "Took the olive order",
        tone: "shift",
        moves: { olives: 16 },
        owners: { olives: "you" },
        load: { you: 1, tomas: -1 },
        draft: {
          to: "Tomás",
          channel: "Messages",
          body: "I'll take the olive order off your list. Thanks for flagging the Nocellara early.",
        },
      },
      {
        id: "swap",
        label: "Swap for the Sheridans order",
        hint: "Gordal instead of Nocellara, in by Monday",
        summary: "The order lands Monday, two days before the kitchen trial. Priya updates the menu card.",
        filed: "Swapped to the Sheridans order",
        tone: "shift",
        moves: { olives: 20 },
        adds: [{ id: "menucard", label: "Update tasting menu card", start: 19, end: 21, owner: "priya" }],
        load: { priya: 1 },
        draft: {
          to: "Tomás",
          channel: "Messages",
          body: "Go with the Sheridans Gordal order so it lands Monday. I've asked Priya to update the menu card.",
        },
      },
    ],
    defer: [TOMORROW, { id: "monday", label: "After Tomás hears back", detail: "Mon 20 Jul", until: 20 }],
  },
  {
    id: "runsheet",
    project: "orchard",
    kind: "overload",
    short: "Aoife is stretched",
    question: "The Saturday run-sheet is due today and Aoife has 14 open tasks. Share it out?",
    context:
      "Aoife is building the run-sheet for Saturday's site walk with Mara and Finn, on top of the order of service and five supplier calls. The supplier timings are the slowest part, and anyone on the team could do them.",
    since: "Due today",
    evidence: [
      { type: "activity", title: "14 open, 6 due by Sunday", meta: "Aoife, most on the team" },
      { type: "message", who: "aoife", quote: "I'll get it done, it just might be late tonight.", meta: "yesterday 18:05" },
      { type: "task", title: "Build the Saturday run-sheet", meta: "Due today" },
    ],
    tracks: [
      { id: "runsheet", label: "Run-sheet", start: 13, end: 16, owner: "aoife" },
      { id: "timings", label: "Supplier timings", start: 14, end: 16, owner: "aoife" },
      { id: "walk", label: "Site walk with Mara & Finn", start: 18, end: 18, owner: "you", milestone: true },
      { id: "service", label: "Order of service draft", start: 22, end: 28, owner: "aoife" },
    ],
    guard: { track: "walk", driver: "runsheet", short: "Site walk", comfortable: 2 },
    people: ["aoife", "cian", "priya", "you"],
    choices: [
      {
        id: "cian",
        label: "Hand the supplier timings to Cian",
        hint: "Aoife keeps the run-sheet itself",
        summary: "The run-sheet still lands today. Aoife drops to 10 open tasks; Cian takes 4.",
        filed: "Gave the supplier timings to Cian",
        tone: "calm",
        owners: { timings: "cian" },
        load: { aoife: -4, cian: 4 },
        draft: {
          to: "Cian",
          channel: "Messages",
          body: "Could you take the supplier arrival timings for Saturday's run-sheet? Aoife will share her notes by 11.",
        },
      },
      {
        id: "friday",
        label: "Give Aoife until Friday noon",
        hint: "One more day, same owner",
        summary: "The site walk still happens, but Mara & Finn see the run-sheet a day later.",
        filed: "Gave Aoife until Friday noon",
        tone: "shift",
        moves: { runsheet: 17, timings: 17 },
        draft: {
          to: "Aoife",
          channel: "Messages",
          body: "Take until Friday noon for the run-sheet. No late night needed.",
        },
      },
      {
        id: "priya",
        label: "Split it with Priya",
        hint: "Priya takes the supplier timings",
        summary: "Priya takes the timings, but Aoife is still past a full week and the run-sheet could slip to Friday.",
        filed: "Split the run-sheet with Priya",
        tone: "risk",
        owners: { timings: "priya" },
        risk: { timings: 17, runsheet: 17 },
        load: { aoife: -2, priya: 2 },
      },
      {
        id: "leave",
        label: "Leave it with Aoife",
        hint: "She said she can finish tonight",
        summary: "Nothing moves. Aoife stays at 14 open tasks, with 6 due before Sunday.",
        filed: "Left the run-sheet with Aoife",
        tone: "risk",
        risk: { runsheet: 17, timings: 17 },
      },
    ],
    defer: [
      { id: "noon", label: "At noon today", detail: "Thu 16 Jul, 12:00", until: 16 },
      TOMORROW,
    ],
    moot: { by: "aoife", at: "09:12", text: "She handed the supplier timings to Cian herself." },
  },
  {
    id: "tasting",
    project: "orchard",
    kind: "risk",
    short: "Tasting is stuck",
    question: "The menu tasting has not moved in 15 days. How do you unstick it?",
    context:
      "The tasting on 1 Aug is waiting on a wine pairing quote from Ballymaloe Wines. Rory said on 1 Jul it was nearly ready, and it never arrived. Priya can't finalise the menu without it.",
    since: "No change since 1 Jul",
    evidence: [
      { type: "activity", title: "Last change 15 days ago", meta: "Priya added the draft menu" },
      { type: "message", who: "rory", quote: "Quote is nearly there, you'll have it this week.", meta: "by email, 1 Jul" },
      { type: "task", title: "Menu tasting at The Orchard", meta: "Sat 1 Aug" },
    ],
    tracks: [
      { id: "quote", label: "Wine pairing quote", start: 1, end: 3, owner: "rory" },
      { id: "tasting", label: "Menu tasting", start: 32, end: 32, owner: "priya", milestone: true },
      { id: "signoff", label: "Final menu sign-off", start: 39, end: 39, owner: "you", milestone: true },
      { id: "print", label: "Printed menus", start: 47, end: 51, owner: "aoife" },
    ],
    guard: { track: "tasting", driver: "quote", short: "Tasting", comfortable: 7 },
    people: ["you", "priya"],
    choices: [
      {
        id: "chase",
        label: "Chase Ballymaloe Wines today",
        hint: "Ask Rory for the quote by Monday",
        summary: "Every date holds if Rory replies by Monday. You get a follow-up on 20 Jul.",
        filed: "Chased Ballymaloe Wines",
        tone: "calm",
        moves: { quote: 20 },
        adds: [{ id: "follow", label: "Follow up with Rory", start: 20, end: 20, owner: "you", milestone: true }],
        load: { you: 1 },
        draft: {
          to: "Rory, Ballymaloe Wines",
          channel: "Email",
          body: "Hi Rory, we're still waiting on the wine pairing quote for the Walsh and Kelly tasting on 1 Aug. Could you send it by Monday 20 Jul? Thanks.",
        },
      },
      {
        id: "move",
        label: "Move the tasting to 5 Aug",
        hint: "Buys four days for the quote",
        summary: "Tasting moves to Wed 5 Aug. Sign-off and printed menus slide 4 days; the wedding is not affected.",
        filed: "Moved the tasting to 5 Aug",
        tone: "shift",
        moves: { tasting: 36, signoff: 43, print: 55 },
        draft: {
          to: "Mara & Finn",
          channel: "Messages",
          body: "Could we move your menu tasting to Wednesday 5 August? We're finalising the wine pairing and want it right on the day.",
        },
      },
      {
        id: "without",
        label: "Go ahead without the wine pairing",
        hint: "Pair the wine at a short session later",
        summary: "The tasting stays on 1 Aug with nothing blocking it. A separate wine session goes in for 12 Aug.",
        filed: "Kept the tasting, wine later",
        tone: "shift",
        driver: null,
        adds: [{ id: "wine", label: "Wine pairing session", start: 43, end: 43, owner: "you", milestone: true }],
        load: { you: 1 },
      },
    ],
    defer: [TOMORROW, { id: "monday", label: "Monday, after Rory's deadline", detail: "Mon 20 Jul", until: 20 }],
  },
  {
    id: "seating",
    project: "orchard",
    kind: "waiting",
    short: "Seating plan",
    question: "Priya's final seating plan is ready. Approve it?",
    context:
      "Version 4 seats 140 guests over 14 tables. Priya flagged two conflicts, both Finn's uncles: Declan and Martin share table 6, and Martin sits beside the speeches. Place cards go to the printer on 24 Jul.",
    since: "Waiting since yesterday, 17:40",
    evidence: [
      { type: "file", title: "Seating plan v4.pdf", meta: "Priya, yesterday 17:40" },
      { type: "message", who: "priya", quote: "Two flags, both Finn's uncles. Everything else is settled.", meta: "yesterday 17:42" },
      { type: "task", title: "Approve final seating plan", meta: "In review, due today" },
    ],
    tracks: [
      { id: "seating", label: "Your sign-off", start: 13, end: 16, owner: "you" },
      { id: "share", label: "Plan to Mara & Finn", start: 17, end: 17, owner: "priya", milestone: true },
      { id: "cards", label: "Place cards to the printer", start: 24, end: 24, owner: "aoife", milestone: true },
    ],
    guard: { track: "cards", driver: "share", short: "Place cards", comfortable: 5 },
    people: ["you", "priya", "aoife"],
    choices: [
      {
        id: "martin",
        label: "Approve, and move Martin to table 9",
        hint: "Clears both flags",
        summary: "Both flags clear. Priya makes the swap this afternoon; place cards still print on 24 Jul.",
        filed: "Approved, Martin to table 9",
        tone: "calm",
        completes: ["seating"],
        moves: { share: 16 },
        load: { priya: 1 },
        draft: {
          to: "Priya",
          channel: "Messages",
          body: "Approved. Please move Martin to table 9, then send the plan to Mara and Finn.",
        },
      },
      {
        id: "asis",
        label: "Approve as it is",
        hint: "Both flags stay",
        summary: "The plan goes to Mara & Finn today with both flags as they are.",
        filed: "Approved seating v4 as it is",
        tone: "risk",
        completes: ["seating"],
        moves: { share: 16 },
        draft: {
          to: "Mara & Finn",
          channel: "Messages",
          body: "Here's the final seating plan: 140 guests over 14 tables. Have a look and tell us if anything feels off.",
        },
      },
      {
        id: "back",
        label: "Send it back to Priya",
        hint: "With both flags attached",
        summary: "Sign-off moves to Mon 20 Jul. Place cards still print on 24 Jul, with 3 days between.",
        filed: "Sent seating back to Priya",
        tone: "shift",
        moves: { seating: 20, share: 21 },
        load: { priya: 1 },
      },
    ],
    defer: [TOMORROW, { id: "walk", label: "After the site walk", detail: "Sat 18 Jul", until: 18 }],
  },
  {
    id: "marquee",
    project: "orchard",
    kind: "reply",
    short: "Mara's marquee question",
    question: "Mara asked if the marquee sides can be clear rather than white.",
    context:
      "She wants to see the orchard during dinner. Clear sides are possible and add about €380 to the hire. Tomás places the marquee order on 24 Jul, so the answer needs to land before then.",
    since: "Asked yesterday, 21:14",
    evidence: [
      { type: "message", who: "mara", quote: "Could the sides be clear rather than white? We'd love to see the trees.", meta: "yesterday 21:14" },
      { type: "file", title: "Marquee quote, Cork Hire.pdf", meta: "Tomás, 3 Jul" },
      { type: "task", title: "Marquee hire order", meta: "Due Fri 24 Jul" },
    ],
    tracks: [
      { id: "check", label: "Answer to Mara", start: 16, end: 16, owner: "you", milestone: true },
      { id: "marquee", label: "Marquee order placed", start: 24, end: 24, owner: "tomas", milestone: true },
    ],
    guard: { track: "marquee", driver: "check", short: "Marquee order", comfortable: 3 },
    people: ["you", "tomas"],
    choices: [
      {
        id: "reply",
        label: "Reply to Mara yourself",
        hint: "Yes, about €380 more",
        summary: "Mara gets an answer this morning. The hire order stays on 24 Jul.",
        filed: "Replied to Mara",
        tone: "calm",
        draft: {
          to: "Mara",
          channel: "Messages",
          body: "Yes, clear sides work beautifully in the orchard. They add about €380 to the hire, and we'd confirm by 24 Jul. Shall I add them?",
        },
      },
      {
        id: "tomas",
        label: "Pass it to Tomás",
        hint: "He checks with Cork Hire",
        summary: "Tomás checks with the supplier by Friday; Mara gets a holding note now.",
        filed: "Passed the marquee question to Tomás",
        tone: "calm",
        owners: { check: "tomas" },
        moves: { check: 17 },
        load: { tomas: 1 },
        draft: {
          to: "Mara",
          channel: "Messages",
          body: "Good question. Tomás is checking with the marquee company and will come back to you by Friday.",
        },
      },
      {
        id: "yes",
        label: "Say yes and add them to the order",
        hint: "Budget rises by €380",
        summary: "Clear sides go on the order. Tomás revises it before 24 Jul and the quote rises by €380.",
        filed: "Added clear sides to the order",
        tone: "shift",
        owners: { check: "tomas" },
        load: { tomas: 1 },
        draft: {
          to: "Mara",
          channel: "Messages",
          body: "Yes. Clear sides are going on the marquee order. Tomás will send the revised quote this week.",
        },
      },
    ],
    defer: [TOMORROW, { id: "tomas", label: "After Tomás checks stock", detail: "Fri 17 Jul, 14:00", until: 17 }],
  },
];

export const HARVEST: Decision = {
  id: "tickets",
  project: "harvest",
  kind: "risk",
  short: "Ticket sales are flat",
  question: "Ticket sales have been flat for 9 days. Send the second announcement?",
  context:
    "42 of 60 seats are sold for the supper on 8 Aug. The last sale was on 7 Jul. The second announcement was planned for 22 Jul, and Niamh has a draft ready.",
  since: "Flat since Tue 7 Jul",
  evidence: [
    { type: "activity", title: "42 of 60 seats sold", meta: "Last sale 7 Jul" },
    { type: "message", who: "niamh", quote: "Draft is in Files whenever you want it out.", meta: "Mon 13 Jul" },
    { type: "file", title: "Second announcement.docx", meta: "Niamh, Mon 13 Jul" },
  ],
  tracks: [
    { id: "announce", label: "Second announcement", start: 22, end: 22, owner: "niamh", milestone: true },
    { id: "supper", label: "Harvest supper", start: 39, end: 39, owner: "you", milestone: true },
  ],
  guard: { track: "supper", driver: "announce", short: "Supper", comfortable: 20, word: "to sell" },
  people: ["niamh", "you"],
  choices: [
    {
      id: "send",
      label: "Send the announcement today",
      hint: "Six days earlier than planned",
      summary: "The announcement goes out this afternoon, giving 18 seats 23 days to sell.",
      filed: "Sent the Harvest announcement early",
      tone: "calm",
      moves: { announce: 16 },
      draft: { to: "Niamh", channel: "Messages", body: "Let's send the second announcement today. Your draft is good to go." },
    },
    {
      id: "keep",
      label: "Keep it for 22 Jul",
      hint: "Stick to the plan",
      summary: "Nothing moves. 18 seats get 17 days to sell after the announcement.",
      filed: "Kept the announcement for 22 Jul",
      tone: "risk",
    },
    {
      id: "list",
      label: "Offer tables to the mailing list first",
      hint: "Ten tables of two, for 48 hours",
      summary: "The list gets first refusal today; the public announcement follows on 18 Jul.",
      filed: "Offered Harvest tables to the list",
      tone: "shift",
      moves: { announce: 18 },
      load: { niamh: 1 },
      draft: { to: "Niamh", channel: "Messages", body: "Can you send the mailing list first refusal on ten tables today, then the full announcement Saturday?" },
    },
  ],
  defer: [TOMORROW],
};

/* ── The calm overview ──────────────────────────────────────────────── */

export type TaskStatus = "done" | "review" | "progress" | "todo";

export type ProjectTask = {
  id: string;
  title: string;
  status: TaskStatus;
  due: number;
  owner: PersonId;
  project?: ProjectId;
  done?: string;
};

/* The dated and recently finished tasks the whole picture lists. The counts below cover every task. */
export const TASKS: ProjectTask[] = [
  { id: "openday", title: "Open day, nine couples through", status: "done", due: 15, owner: "aoife", done: "Yesterday" },
  { id: "deposit", title: "Deposit invoice settled, Mara & Finn", status: "done", due: 15, owner: "you", done: "Yesterday" },
  { id: "seating", title: "Approve final seating plan", status: "review", due: 16, owner: "you" },
  { id: "olives", title: "Order tonic + the good olives", status: "progress", due: 14, owner: "tomas" },
  { id: "runsheet", title: "Build the Saturday run-sheet", status: "progress", due: 16, owner: "aoife" },
  { id: "tasting", title: "Menu tasting at The Orchard", status: "progress", due: 32, owner: "priya" },
  { id: "marquee", title: "Marquee hire order", status: "progress", due: 24, owner: "tomas" },
  { id: "service", title: "Order of service draft", status: "todo", due: 28, owner: "aoife" },
];

export const HARVEST_TASKS: ProjectTask[] = [
  { id: "h-venue", title: "Long tables confirmed, Harvest", status: "done", due: 13, owner: "you", done: "Monday", project: "harvest" },
  { id: "announce", title: "Second announcement, Harvest", status: "todo", due: 22, owner: "niamh", project: "harvest" },
  { id: "h-wine", title: "Supper wine order, Harvest", status: "progress", due: 27, owner: "niamh", project: "harvest" },
];

export const MILESTONES = [
  { id: "walk", title: "Site walk with Mara & Finn", due: 18 },
  { id: "cards", title: "Place cards to the printer", due: 24 },
];

/*
 * One model for both the choice panel and the whole picture. Open tasks per
 * person sum to each project's open count, and done plus open is the total.
 */
export type Standing = { done: number; review: number; progress: number; load: Partial<Record<PersonId, number>> };

export const STANDING: Record<ProjectId, Standing> = {
  orchard: { done: 24, review: 2, progress: 18, load: { aoife: 14, tomas: 7, priya: 6, cian: 4, you: 5 } },
  harvest: { done: 9, review: 0, progress: 3, load: { niamh: 4, you: 1 } },
};

export const CLEAN_STANDING: Record<ProjectId, Standing> = {
  orchard: { done: 30, review: 1, progress: 15, load: { aoife: 9, tomas: 6, priya: 6, cian: 5, you: 4 } },
  harvest: { done: 10, review: 0, progress: 2, load: { niamh: 3, you: 1 } },
};

/* ── Date helpers ───────────────────────────────────────────────────── */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayLabel(day: number) {
  return day > 31 ? `${day - 31} Aug` : `${day} Jul`;
}

export function weekday(day: number) {
  // 16 Jul is a Thursday.
  return WEEKDAYS[(((day - TODAY + 4) % 7) + 7) % 7];
}

export function relativeDay(day: number) {
  const d = day - TODAY;
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d > 1 && d < 7) return weekday(day);
  return `${weekday(day)} ${dayLabel(day)}`;
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

export function countWord(n: number) {
  return WORDS[n] ?? String(n);
}

/* ── The calm morning: nothing needs a call ─────────────────────────── */

export const CLEAN_TASKS: ProjectTask[] = [
  { id: "olives", title: "Order tonic + the good olives", status: "done", due: 14, owner: "tomas", done: "Tuesday" },
  { id: "openday", title: "Open day, nine couples through", status: "done", due: 15, owner: "aoife", done: "Yesterday" },
  { id: "deposit", title: "Deposit invoice settled, Mara & Finn", status: "done", due: 15, owner: "you", done: "Yesterday" },
  { id: "runsheet", title: "Build the Saturday run-sheet", status: "progress", due: 17, owner: "aoife" },
  { id: "seating", title: "Final seating plan", status: "progress", due: 20, owner: "priya" },
  { id: "marquee", title: "Marquee hire order", status: "progress", due: 24, owner: "tomas" },
  { id: "service", title: "Order of service draft", status: "todo", due: 28, owner: "aoife" },
  { id: "tasting", title: "Menu tasting at The Orchard", status: "progress", due: 32, owner: "priya" },
];

/* What each person has coming, when nothing is due in the next two weeks. */
export const IDLE: Partial<Record<PersonId, string>> = {
  aoife: "Nothing due in the next two weeks",
  tomas: "Nothing due in the next two weeks",
  priya: "Menu card and seating, no dates this fortnight",
  cian: "Supplier calls, nothing dated yet",
  you: "Nothing dated this fortnight",
  niamh: "Harvest posts, nothing dated yet",
};

/** A full week: past this many open tasks, someone is carrying too much. */
export const CAPACITY = 10;

/* One line per project, for the all-projects picture. */
export const PROJECT_SUMMARY: Record<ProjectId, { next: string; event: string; days: number; note: string }> = {
  orchard: {
    next: "Site walk with Mara & Finn, Sat 18 Jul",
    event: "Wedding, Sat 3 Oct",
    days: 79,
    note: "5 people",
  },
  harvest: {
    next: "Second announcement, Wed 22 Jul",
    event: "Harvest supper, Sat 8 Aug",
    days: 23,
    note: "42 of 60 seats sold",
  },
};
