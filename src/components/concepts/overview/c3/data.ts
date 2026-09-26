/**
 * Health atlas sample data. Invented, front-end only.
 *
 * Today is Thursday 16 July. "Last week" is Thursday 9 July.
 * Tone scale: 0 steady, 1 worth a look, 2 watch, 3 needs attention,
 * "early" too early to say.
 */

export type Level = 0 | 1 | 2 | 3;
export type Tone = Level | "early";
export type DimId = "schedule" | "decisions" | "workload" | "replies" | "momentum" | "files";
export type FactKind = "task" | "file" | "message" | "person" | "metric" | "decision";
export type FactTone = Tone | "good";

export type Fact = {
  kind: FactKind;
  title: string;
  meta: string;
  status: string;
  tone: FactTone;
  href?: string;
};

export type CellState = {
  tone: Tone;
  label: string;
  /** After a remedy: the sentence rewritten to match the new state. */
  why?: string;
  /** After a remedy: evidence rows that changed, by index. */
  facts?: Record<number, { status?: string; meta?: string; tone?: FactTone }>;
  /** After a remedy: the causes that still apply, when they change. */
  causes?: string[];
};

export type Effect = {
  cells?: Record<string, CellState>;
  /** Per-person change to [this week, next week, later]. */
  people?: Record<string, [number, number, number]>;
  toast: string;
};

export type Remedy = {
  id: string;
  label: string;
  reason: string;
  icon: "move" | "message" | "calendar" | "decide" | "hand" | "sign" | "plan";
  effect: Effect;
};

export type Cell = CellState & {
  why: string;
  facts: Fact[];
  last: CellState;
  causes: string[];
  remedies: Remedy[];
};

export type Row = {
  id: string;
  name: string;
  initials: string;
  color: string;
  next: string;
  kind: string;
  cells: Record<DimId, Cell>;
};

export type Dimension = {
  id: DimId;
  name: string;
  short: string;
  hint: string;
  judged: string;
};

export type Person = {
  id: string;
  name: string;
  initials: string;
  hue: string;
  /** Open tasks due [this week, next week, later]. */
  load: [number, number, number];
  overdue: number;
  on: string[];
  isYou?: boolean;
};

export type Cause = { id: string; label: string; person?: string };

export const TODAY = "Thursday 16 July";
export const LAST_WEEK = "Thursday 9 July";
export const CAPACITY = 10;

export const DIMENSIONS: Dimension[] = [
  {
    id: "schedule",
    name: "Schedule",
    short: "Schedule",
    hint: "On time or slipping",
    judged:
      "Steady when everything due in the next seven days has started. Watch when something due soon has not started. Needs attention when anything is past its date.",
  },
  {
    id: "decisions",
    name: "Decisions",
    short: "Decisions",
    hint: "Waiting on someone",
    judged:
      "Counts choices someone is waiting on. Worth a look after two days, needs attention after five, or sooner when a date depends on it.",
  },
  {
    id: "workload",
    name: "Workload",
    short: "Workload",
    hint: "Shared out evenly",
    judged:
      "Compares each person's open tasks with room for about ten at a time. Anyone above that on this project raises the flag.",
  },
  {
    id: "replies",
    name: "Client replies",
    short: "Replies",
    hint: "Clients and suppliers",
    judged:
      "Looks at messages and quotes sent out with no answer yet. Three days is worth a look. Five or more, with a date riding on it, needs attention.",
  },
  {
    id: "momentum",
    name: "Momentum",
    short: "Momentum",
    hint: "Movement in 7 days",
    judged:
      "Watches whether tasks, tickets and files moved in the last seven days. A key item standing still for more than a week raises the flag.",
  },
  {
    id: "files",
    name: "Files and sign-off",
    short: "Sign-off",
    hint: "Approvals outstanding",
    judged: "Counts files sent for approval and not yet signed. It grows warmer as the date that depends on them gets closer.",
  },
];

export const PEOPLE: Person[] = [
  { id: "dara", name: "Dara", initials: "DO", hue: "var(--v3-project-1)", load: [2, 3, 3], overdue: 0, on: ["orchard", "burren", "winter"], isYou: true },
  { id: "aoife", name: "Aoife", initials: "AK", hue: "var(--v3-project-8)", load: [3, 6, 5], overdue: 1, on: ["orchard", "harvest"] },
  { id: "niamh", name: "Niamh", initials: "NB", hue: "var(--v3-project-3)", load: [1, 2, 2], overdue: 0, on: ["burren", "harvest"] },
  { id: "tomas", name: "Tomás", initials: "TR", hue: "var(--v3-project-5)", load: [2, 3, 2], overdue: 1, on: ["orchard", "kestrel"] },
  { id: "priya", name: "Priya", initials: "PS", hue: "var(--v3-project-2)", load: [1, 1, 2], overdue: 0, on: ["kestrel", "winter"] },
];

export const CAUSES: Record<string, Cause> = {
  aoife: { id: "aoife", label: "Aoife's load", person: "aoife" },
  tomas: { id: "tomas", label: "Tomás", person: "tomas" },
  you: { id: "you", label: "Waiting on you", person: "dara" },
  "mara-finn": { id: "mara-finn", label: "Mara and Finn" },
  menu: { id: "menu", label: "The menu choices" },
  promo: { id: "promo", label: "No promotion since 3 July" },
  kestrel: { id: "kestrel", label: "Ruth at Kestrel" },
  parents: { id: "parents", label: "Parents and guardians" },
  niamh: { id: "niamh", label: "Niamh", person: "niamh" },
};

/* ── helpers ─────────────────────────────────────────────────────── */

const f = (kind: FactKind, title: string, meta: string, status: string, tone: FactTone): Fact => ({
  kind,
  title,
  meta,
  status,
  tone,
});

function cell(
  tone: Tone,
  label: string,
  why: string,
  facts: Fact[],
  last: CellState,
  causes: string[] = [],
  remedies: Remedy[] = [],
): Cell {
  return { tone, label, why, facts, last, causes, remedies };
}

const same = (tone: Tone, label: string): CellState => ({ tone, label });

const early = (why: string, facts: Fact[]): Cell =>
  cell("early", "Too early to say", why, facts, same("early", "Too early to say"));

/* ── shared remedies ─────────────────────────────────────────────── */

const moveTasting: Remedy = {
  id: "move-tasting",
  label: "Move the tasting to 5 Aug",
  reason: "Gives Mara and Finn until Tuesday to choose, and frees Aoife this week.",
  icon: "calendar",
  effect: {
    cells: {
      "orchard:schedule": {
        tone: 1,
        label: "1 late",
        why: "With the tasting now on 5 August, only the olive order is late, and the run-sheet can start on Monday.",
        facts: { 1: { status: "Moved", meta: "Aoife · now due Tue 21 Jul", tone: "good" }, 2: { status: "Next week", meta: "Aoife · now due Mon 20 Jul", tone: "good" } },
      },
      "orchard:momentum": {
        tone: 2,
        label: "Replanned",
        why: "The tasting is replanned for 5 August, so it is moving again, but the chef still waits on the menu choices.",
        facts: { 0: { status: "Replanned", meta: "Moved to Wed 5 Aug today", tone: 1 } },
      },
      "ws-food:schedule": {
        tone: 1,
        label: "1 late",
        why: "With the tasting now on 5 August, the menu can be confirmed next week. Only the olive order is late.",
        facts: { 1: { status: "Next week", meta: "Aoife · now due Mon 27 Jul", tone: "good" } },
      },
      "ws-food:momentum": {
        tone: 2,
        label: "Replanned",
        why: "The tasting is replanned for 5 August, so it is moving again, but it still waits on the menu choices.",
      },
    },
    people: { aoife: [-1, 1, 0] },
    toast: "Moved the tasting to Wednesday 5 August.",
  },
};

const askTomas: Remedy = {
  id: "ask-tomas",
  label: "Ask Tomás about the olives",
  reason: "He has not updated the order since Monday. A note with the supplier's number is ready.",
  icon: "message",
  effect: {
    cells: {
      "orchard:schedule": {
        tone: 2,
        label: "1 late, 1 chased",
        why: "Tomás has been asked about the olives, so that late task is being chased. The table plan draft is still a day late.",
        facts: { 0: { status: "Chased", meta: "Tomás · asked today", tone: 2 } },
      },
      "ws-food:schedule": {
        tone: 2,
        label: "Chased",
        why: "Tomás has been asked about the olives today. The tasting menu is still due tomorrow and has not started.",
        facts: { 0: { status: "Chased", meta: "Tomás · asked today", tone: 2 } },
      },
    },
    toast: "Sent Tomás a note about the olives.",
  },
};

const rebalanceAoife: Remedy = {
  id: "rebalance-aoife",
  label: "Move 3 tasks from Aoife to Priya",
  reason: "Priya has the most room this fortnight and already knows the Harvest suppliers.",
  icon: "move",
  effect: {
    cells: {
      "orchard:workload": {
        tone: 2,
        label: "Aoife 110%",
        why: "Aoife now holds 11 open tasks, three due this week, against room for about ten. Priya has taken three of the later ones.",
        facts: { 0: { status: "110%", meta: "11 open · 3 due this week · 1 late", tone: 2 }, 2: { status: "With Priya", meta: "Priya · Harvest supper club", tone: "good" } },
      },
      "harvest:replies": {
        tone: 1,
        label: "Priya chasing",
        why: "Priya has taken over both supplier quotes today. The wine order still closes on 24 July.",
        facts: { 0: { meta: "Priya · from today" }, 1: { meta: "Priya · from today" } },
        causes: [],
      },
      "ws-food:workload": {
        tone: 1,
        label: "Aoife 4 tasks",
        why: "Aoife now holds four food tasks after three moved to Priya. It is still the heaviest workstream for her.",
      },
    },
    people: { aoife: [0, -2, -1], priya: [0, 2, 1] },
    toast: "Moved 3 of Aoife's tasks to Priya.",
  },
};

const pushAoife: Remedy = {
  id: "push-aoife",
  label: "Push 2 of Aoife's tasks to next week",
  reason: "Neither has a date that depends on it: the welcome sign and the thank-you cards.",
  icon: "calendar",
  effect: {
    cells: {
      "orchard:workload": {
        tone: 2,
        label: "Aoife 1 due",
        why: "Aoife still holds 14 open tasks, but only one is due this week now that the welcome sign and thank-you cards are next week.",
        facts: { 0: { meta: "14 open · 1 due this week · 1 late" } },
      },
    },
    people: { aoife: [-2, 2, 0] },
    toast: "Pushed 2 of Aoife's tasks to next week.",
  },
};

const nudgeMaraFinn: Remedy = {
  id: "nudge-mara-finn",
  label: "Send a gentle nudge to Mara and Finn",
  reason: "Short, friendly, with the three menu options attached again.",
  icon: "message",
  effect: {
    cells: {
      "orchard:replies": {
        tone: 1,
        label: "Nudged today",
        why: "Mara and Finn were nudged today with the three menu options. The tasting on 1 August still depends on their answer.",
        facts: { 0: { status: "Nudged", meta: "Sent Fri 10 Jul · nudged today", tone: 1 } },
      },
      "ws-food:replies": {
        tone: 1,
        label: "Nudged today",
        why: "Mara and Finn were nudged today about the menu. The tasting still depends on their answer.",
      },
    },
    toast: "Nudged Mara and Finn about the menu.",
  },
};

const decideSeating: Remedy = {
  id: "decide-seating",
  label: "Decide the seating plan now",
  reason: "Aoife has narrowed it to layout B or C. Both fit 112 guests.",
  icon: "decide",
  effect: {
    cells: {
      "orchard:decisions": {
        tone: 0,
        label: "Seating chosen",
        why: "You chose seating layout C, so Aoife can finish the table plan. The only open question, welcome drinks, is a day old.",
        facts: { 0: { status: "Layout C", meta: "Decided by you · today", tone: "good" } },
      },
      "ws-venue:decisions": {
        tone: 0,
        label: "Seating chosen",
        why: "You chose seating layout C, so no one on the venue is waiting on a choice.",
      },
    },
    toast: "Chose seating layout C. Aoife has been told.",
  },
};

/* ── all projects ────────────────────────────────────────────────── */

export const PROJECTS: Row[] = [
  {
    id: "orchard",
    name: "The Orchard, events",
    initials: "TO",
    color: "var(--v3-project-4)",
    kind: "Mara and Finn's wedding",
    next: "Menu tasting, 1 Aug",
    cells: {
      schedule: cell(
        3,
        "2 late",
        "Schedule is slipping because two tasks are past their date and the run-sheet due today has not started.",
        [
          f("task", "Order tonic and the good olives", "Tomás · due Tue 14 Jul", "2 days late", 3),
          f("task", "Print the table plan draft", "Aoife · due Wed 15 Jul", "1 day late", 3),
          f("task", "Build the Saturday run-sheet", "Aoife · due today", "Not started", 2),
        ],
        same(1, "Tight"),
        ["aoife", "tomas"],
        [moveTasting, askTomas],
      ),
      decisions: cell(
        2,
        "Waiting on you",
        "Aoife has been waiting four days for you to choose the seating plan, and the table plan draft depends on it.",
        [
          f("decision", "Seating plan: layout B or C", "Asked by Aoife · Sun 12 Jul", "4 days", 2),
          f("decision", "Welcome drinks: prosecco or cider", "Asked by Tomás · yesterday", "1 day", 1),
          f("decision", "Band finish time", "Answered by you · Tue", "Settled", "good"),
        ],
        same(1, "1 waiting"),
        ["you"],
        [
          decideSeating,
          {
            id: "hand-seating",
            label: "Hand the seating plan to Niamh",
            reason: "She seated the Doyle wedding in the same barn last year.",
            icon: "hand",
            effect: {
              cells: {
                "orchard:decisions": {
                  tone: 1,
                  label: "With Niamh",
                  why: "Niamh has the seating plan now. She seated the Doyle wedding in the same barn, and the table plan waits on her.",
                  facts: { 0: { status: "With Niamh", meta: "Handed to Niamh · today", tone: 1 } },
                },
              },
              people: { niamh: [1, 0, 0] },
              toast: "Handed the seating plan to Niamh.",
            },
          },
        ],
      ),
      workload: cell(
        3,
        "Aoife 140%",
        "Aoife holds 14 open tasks, three due this week, against room for about ten, and most of them sit here.",
        [
          f("person", "Aoife", "14 open · 3 due this week · 1 late", "140%", 3),
          f("task", "Build the Saturday run-sheet", "Aoife · due today", "Not started", 2),
          f("task", "Chase the Harvest wine quote", "Aoife · Harvest supper club", "4 days", 2),
        ],
        same(2, "Aoife 120%"),
        ["aoife"],
        [rebalanceAoife, pushAoife],
      ),
      replies: cell(
        3,
        "6 days waiting",
        "Menu choices from Mara and Finn have been waiting six days, and the tasting on 1 August depends on them.",
        [
          f("message", "Menu choices for the tasting", "Sent Fri 10 Jul · opened twice", "No reply", 3),
          f("message", "Dietary needs for 112 guests", "Sent Mon 6 Jul", "38 of 112", 2),
          f("message", "Deposit invoice", "Mara · settled yesterday", "Paid", "good"),
        ],
        same(2, "5 days waiting"),
        ["mara-finn", "menu"],
        [
          nudgeMaraFinn,
          {
            id: "offer-call",
            label: "Offer a 15 minute call on Monday",
            reason: "They answered faster by phone last time: same day in June.",
            icon: "calendar",
            effect: {
              cells: {
                "orchard:replies": {
                  tone: 2,
                  label: "Call offered",
                  why: "A call is offered for Monday. Until they take it, the menu choices are six days old and the tasting depends on them.",
                  facts: { 0: { status: "Call offered", tone: 2 } },
                },
              },
              toast: "Offered Mara and Finn a call on Monday.",
            },
          },
        ],
      ),
      momentum: cell(
        3,
        "Stalled 15 days",
        "The tasting has not moved in 15 days because the chef cannot confirm until the menu choices arrive.",
        [
          f("task", "Menu tasting at The Orchard", "No change since Wed 1 Jul", "15 days", 3),
          f("task", "Book the chef for the tasting", "Tomás · blocked by menu choices", "Blocked", 2),
          f("metric", "Other work this week", "4 tasks finished, 2 files updated", "Moving", "good"),
        ],
        same(2, "Stalled 8 days"),
        ["menu", "mara-finn"],
        [moveTasting, nudgeMaraFinn],
      ),
      files: cell(
        2,
        "v4 unsigned",
        "Floor plan v4 went to Mara and Finn five days ago and is not signed, so the marquee layout cannot be fixed.",
        [
          f("file", "Floor plan v4.pdf", "Sent Sat 11 Jul · viewed 3 times", "Unsigned", 2),
          f("file", "Menu draft v2.docx", "Waiting on menu choices", "Draft", 1),
          f("file", "Marquee hire contract.pdf", "Signed Mon 13 Jul", "Signed", "good"),
        ],
        same(1, "v4 sent"),
        ["mara-finn"],
        [
          {
            id: "remind-floor",
            label: "Send a sign-off reminder",
            reason: "One tap to sign from their phone. The link is already in the thread.",
            icon: "sign",
            effect: {
              cells: {
                "orchard:files": {
                  tone: 1,
                  label: "Reminded",
                  why: "Mara and Finn were reminded to sign floor plan v4 today. The marquee layout waits until they do.",
                  facts: { 0: { status: "Reminded", meta: "Sent Sat 11 Jul · reminded today", tone: 1 } },
                },
              },
              toast: "Reminded Mara and Finn to sign floor plan v4.",
            },
          },
          {
            id: "working-floor",
            label: "Treat v3 as the working plan",
            reason: "v4 only moves the band 2 metres. The marquee team can start from v3.",
            icon: "plan",
            effect: {
              cells: {
                "orchard:files": {
                  tone: 1,
                  label: "v3 in use",
                  why: "The marquee team is working from floor plan v3. v4 only moves the band, so it can be signed later.",
                  facts: { 0: { status: "Can wait", tone: 1 } },
                },
              },
              toast: "Marked floor plan v3 as the working plan.",
            },
          },
        ],
      ),
    },
  },
  {
    id: "harvest",
    name: "Harvest supper club",
    initials: "HS",
    color: "var(--v3-project-5)",
    kind: "Ticketed dinner, 60 seats",
    next: "Supper night, 14 Aug",
    cells: {
      schedule: cell(
        0,
        "Steady",
        "Everything due in the next week has started, and nothing is past its date.",
        [
          f("task", "Confirm the long tables", "Niamh · due Mon", "Started", "good"),
          f("task", "Draft the running order", "Niamh · due Wed", "Started", "good"),
          f("metric", "Tasks due this week", "5 of 5 moving", "On time", "good"),
        ],
        same(0, "Steady"),
      ),
      decisions: cell(
        0,
        "None waiting",
        "No one is waiting on a choice. The last one, the dessert, was settled on Tuesday.",
        [
          f("decision", "Dessert: plum tart", "Settled by Niamh · Tue", "Settled", "good"),
          f("decision", "Door time 7pm", "Settled by you · last week", "Settled", "good"),
          f("metric", "Open questions", "None", "Clear", "good"),
        ],
        same(1, "1 waiting"),
      ),
      workload: cell(
        0,
        "Even",
        "Work here is spread across Niamh and Aoife, and neither holds more than four Harvest tasks.",
        [
          f("person", "Niamh", "4 Harvest tasks", "Fine", "good"),
          f("person", "Aoife", "3 Harvest tasks", "Fine", "good"),
          f("metric", "Unassigned", "None", "Clear", "good"),
        ],
        same(0, "Even"),
      ),
      replies: cell(
        2,
        "2 quotes out",
        "Two supplier quotes that Aoife is chasing are four days old, and the wine order closes on 24 July.",
        [
          f("message", "Wine quote, Burren Wines", "Aoife · chased Mon", "4 days", 2),
          f("message", "Candle and lantern hire", "Aoife · sent Mon", "3 days", 1),
          f("message", "Bread from Arbutus", "Quote in · Tue", "Received", "good"),
        ],
        same(1, "2 sent"),
        ["aoife"],
        [
          rebalanceAoife,
          {
            id: "deadline-wine",
            label: "Set a Monday deadline for quotes",
            reason: "Both suppliers answered within a day when given a date last season.",
            icon: "calendar",
            effect: {
              cells: {
                "harvest:replies": {
                  tone: 1,
                  label: "Due Monday",
                  why: "Both suppliers have been asked for quotes by Monday, in time for the wine order on 24 July.",
                  facts: { 0: { status: "Due Mon", tone: 1 }, 1: { status: "Due Mon", tone: 1 } },
                },
              },
              toast: "Asked both suppliers for quotes by Monday.",
            },
          },
        ],
      ),
      momentum: cell(
        3,
        "Flat 9 days",
        "Ticket sales have sat at 42 of 60 for nine days, since the last post went out on 3 July.",
        [
          f("metric", "Tickets sold", "42 of 60 · last sale Tue 7 Jul", "Flat", 3),
          f("task", "Post the menu reveal", "Niamh · not scheduled", "Not started", 2),
          f("metric", "Early bird price", "Ended Sun 5 Jul", "Ended", 1),
        ],
        same(2, "Slowing"),
        ["promo"],
        [
          {
            id: "post-friday",
            label: "Plan the menu reveal for Friday",
            reason: "The last reveal sold 11 tickets in two days.",
            icon: "plan",
            effect: {
              cells: {
                "harvest:momentum": {
                  tone: 2,
                  label: "Post planned",
                  why: "The menu reveal goes out on Friday with Niamh. Tickets stay at 42 of 60 until it does.",
                  facts: { 1: { status: "Fri 17 Jul", meta: "Niamh · scheduled", tone: 1 } },
                },
              },
              people: { niamh: [1, 0, 0] },
              toast: "Planned the menu reveal for Friday, with Niamh.",
            },
          },
          {
            id: "table-six",
            label: "Offer a table-of-six price",
            reason: "Groups made up half of last year's late sales.",
            icon: "decide",
            effect: {
              cells: {
                "harvest:momentum": {
                  tone: 2,
                  label: "Offer drafted",
                  why: "A table-of-six offer is drafted and waiting for your review. Tickets are still at 42 of 60.",
                },
              },
              toast: "Drafted a table-of-six offer for your review.",
            },
          },
        ],
      ),
      files: cell(
        0,
        "Nothing to sign",
        "No files are waiting on approval. The poster and menu card were signed off last week.",
        [
          f("file", "Harvest poster.png", "Signed off Thu 9 Jul", "Signed", "good"),
          f("file", "Menu card.pdf", "Signed off Wed 8 Jul", "Signed", "good"),
          f("metric", "Waiting on sign-off", "None", "Clear", "good"),
        ],
        same(0, "Nothing to sign"),
      ),
    },
  },
  {
    id: "kestrel",
    name: "Kestrel Studio rebrand",
    initials: "KS",
    color: "var(--v3-project-1)",
    kind: "Agency client",
    next: "Logo sign-off, 30 Jul",
    cells: {
      schedule: cell(0, "On time", "All six tasks due this week have started, and two are already done.", [
        f("task", "Type pairing options", "Priya · done Tue", "Done", "good"),
        f("task", "Colour system, round 2", "Tomás · due Fri", "Started", "good"),
        f("metric", "Tasks due this week", "6 of 6 moving", "On time", "good"),
      ], same(0, "On time")),
      decisions: cell(0, "None waiting", "No choices are open. Ruth picked the direction on Monday.", [
        f("decision", "Direction: Field notes", "Ruth · Mon", "Settled", "good"),
        f("decision", "Budget for motion", "You · last week", "Settled", "good"),
        f("metric", "Open questions", "None", "Clear", "good"),
      ], same(0, "None waiting")),
      workload: cell(0, "Even", "Priya and Tomás share the work, with room to spare.", [
        f("person", "Priya", "3 Kestrel tasks", "Fine", "good"),
        f("person", "Tomás", "3 Kestrel tasks", "Fine", "good"),
        f("metric", "Unassigned", "None", "Clear", "good"),
      ], same(0, "Even")),
      replies: cell(1, "1 reply due", "Ruth has the brand story draft since Tuesday. Two days is still normal for her.", [
        f("message", "Brand story draft", "Sent to Ruth · Tue", "2 days", 1),
        f("message", "Photo shoot dates", "Ruth replied · Mon", "Replied", "good"),
        f("metric", "Ruth's usual reply time", "About 2 days", "Normal", "good"),
      ], same(0, "All answered"), ["kestrel"]),
      momentum: cell(0, "Moving", "Nine tasks and four files moved in the last seven days.", [
        f("metric", "Tasks finished", "9 this week", "Moving", "good"),
        f("file", "Logo round 2.fig", "Updated yesterday", "Moving", "good"),
        f("metric", "Longest wait", "2 days", "Fine", "good"),
      ], same(0, "Moving")),
      files: cell(
        1,
        "2 unsigned",
        "Two logo rounds are with Ruth for sign-off. It is two weeks to the deadline, so this is worth a look, not a worry.",
        [
          f("file", "Logo round 1.pdf", "Sent Mon 13 Jul", "Unsigned", 1),
          f("file", "Logo round 2.pdf", "Sent Wed 15 Jul", "Unsigned", 1),
          f("file", "Moodboard.fig", "Signed Fri 3 Jul", "Signed", "good"),
        ],
        same(2, "3 unsigned"),
        ["kestrel"],
        [
          {
            id: "kestrel-bundle",
            label: "Ask Ruth to sign both in one go",
            reason: "Round 2 replaces round 1, so one sign-off is enough.",
            icon: "sign",
            effect: {
              cells: {
                "kestrel:files": {
                  tone: 0,
                  label: "1 to sign",
                  why: "Ruth has been asked to sign round 2 and retire round 1, so one sign-off is left with two weeks to go.",
                  facts: { 0: { status: "Retired", tone: "good" } },
                },
              },
              toast: "Asked Ruth to sign round 2 and retire round 1.",
            },
          },
          {
            id: "kestrel-review",
            label: "Book a 20 minute review on Tuesday",
            reason: "Ruth signs faster when she sees it on screen with you.",
            icon: "calendar",
            effect: {
              cells: {
                "kestrel:files": {
                  tone: 1,
                  label: "Review booked",
                  why: "Both logo rounds will be reviewed with Ruth on Tuesday, two weeks before the deadline.",
                },
              },
              toast: "Booked a review with Ruth on Tuesday.",
            },
          },
        ],
      ),
    },
  },
  {
    id: "burren",
    name: "Year 11 Burren field trip",
    initials: "YB",
    color: "var(--v3-project-3)",
    kind: "School trip, 48 students",
    next: "Forms due, 24 Jul",
    cells: {
      schedule: cell(0, "Bus booked", "The bus is confirmed and every task due this week has started.", [
        f("task", "Book the coach", "Niamh · confirmed Tue", "Confirmed", "good"),
        f("task", "Risk assessment", "You · due Mon", "Started", "good"),
        f("metric", "Tasks due this week", "3 of 3 moving", "On time", "good"),
      ], same(1, "Bus pending")),
      decisions: cell(
        1,
        "Lunch stop, you",
        "Niamh asked on Tuesday where to stop for lunch. It is only two days, but the café needs numbers by Monday.",
        [
          f("decision", "Lunch: Ballyvaughan or Kilfenora", "Asked by Niamh · Tue", "2 days", 1),
          f("decision", "Route through the Flaggy Shore", "Settled by you · Mon", "Settled", "good"),
          f("metric", "Other open questions", "None", "Clear", "good"),
        ],
        same(0, "None waiting"),
        ["you"],
        [
          {
            id: "decide-lunch",
            label: "Choose Ballyvaughan",
            reason: "It has room for 48 and indoor seating if it rains.",
            icon: "decide",
            effect: {
              cells: {
                "burren:decisions": {
                  tone: 0,
                  label: "None waiting",
                  why: "You chose Ballyvaughan for lunch and Niamh has been told, in time for the café's Monday numbers.",
                  facts: { 0: { status: "Ballyvaughan", meta: "Decided by you · today", tone: "good" } },
                },
              },
              toast: "Chose Ballyvaughan for lunch. Niamh has been told.",
            },
          },
          {
            id: "hand-lunch",
            label: "Let Niamh decide",
            reason: "She has been to both with a group before.",
            icon: "hand",
            effect: {
              cells: {
                "burren:decisions": {
                  tone: 0,
                  label: "With Niamh",
                  why: "Niamh is choosing the lunch stop. She has taken groups to both before.",
                  facts: { 0: { status: "With Niamh", tone: "good" } },
                },
              },
              toast: "Handed the lunch stop to Niamh.",
            },
          },
        ],
      ),
      workload: cell(0, "Even", "Niamh and you share the trip, and both have room.", [
        f("person", "Niamh", "3 trip tasks", "Fine", "good"),
        f("person", "You", "2 trip tasks", "Fine", "good"),
        f("metric", "Unassigned", "None", "Clear", "good"),
      ], same(0, "Even")),
      replies: cell(
        2,
        "6 forms out",
        "Six consent forms are still out with eight days to go, down from eleven last week.",
        [
          f("metric", "Consent forms", "42 of 48 back", "6 out", 2),
          f("message", "Reminder to parents", "Niamh · sent Mon", "Sent", 1),
          f("metric", "Medical notes", "48 of 48 back", "Complete", "good"),
        ],
        same(3, "11 forms out"),
        ["parents", "niamh"],
        [
          {
            id: "text-parents",
            label: "Text the six families",
            reason: "Texts brought back four forms in a day last week.",
            icon: "message",
            effect: {
              cells: {
                "burren:replies": {
                  tone: 1,
                  label: "Texted 6",
                  why: "The six families were texted today. Six forms are still out with eight days to go.",
                  facts: { 1: { status: "Texted", meta: "You · texted today", tone: 1 } },
                },
              },
              toast: "Texted the six families about consent forms.",
            },
          },
          {
            id: "class-reminder",
            label: "Ask form tutors to remind in class",
            reason: "Students hand them in faster when asked in person.",
            icon: "hand",
            effect: {
              cells: {
                "burren:replies": {
                  tone: 1,
                  label: "Tutors asked",
                  why: "Form tutors will remind students in class. Six forms are still out with eight days to go.",
                },
              },
              toast: "Asked the form tutors to remind students.",
            },
          },
        ],
      ),
      momentum: cell(0, "Moving", "Five forms came back and three tasks finished this week.", [
        f("metric", "Forms returned", "5 this week", "Moving", "good"),
        f("metric", "Tasks finished", "3 this week", "Moving", "good"),
        f("metric", "Longest wait", "2 days", "Fine", "good"),
      ], same(0, "Moving")),
      files: cell(0, "All in", "The risk assessment and itinerary are both signed by the principal.", [
        f("file", "Itinerary.pdf", "Signed Mon", "Signed", "good"),
        f("file", "Risk assessment.docx", "Signed Tue", "Signed", "good"),
        f("metric", "Waiting on sign-off", "None", "Clear", "good"),
      ], same(0, "All in")),
    },
  },
  {
    id: "winter",
    name: "Winter season launch",
    initials: "WS",
    color: "var(--v3-project-2)",
    kind: "Started Tuesday",
    next: "Kick-off, 3 Aug",
    cells: {
      schedule: early("The first tasks have dates in August, so there is nothing to be late yet.", [
        f("task", "Draft the season calendar", "Priya · due 3 Aug", "Not due", 0),
        f("task", "List venue partners", "You · due 5 Aug", "Not due", 0),
        f("metric", "Tasks with dates", "2 of 6", "Early", 0),
      ]),
      decisions: cell(0, "None waiting", "No one is waiting on a choice yet.", [
        f("metric", "Open questions", "None", "Clear", "good"),
        f("decision", "Season name", "Settled by you · Tue", "Settled", "good"),
        f("metric", "Project age", "2 days", "New", 0),
      ], same("early", "Too early to say")),
      workload: early("Only six tasks exist so far, which is too few to judge the spread.", [
        f("person", "Priya", "3 tasks", "Fine", "good"),
        f("person", "You", "3 tasks", "Fine", "good"),
        f("metric", "Tasks so far", "6", "Early", 0),
      ]),
      replies: early("Nothing has been sent to clients or suppliers yet.", [
        f("metric", "Messages out", "None", "Early", 0),
        f("metric", "Quotes out", "None", "Early", 0),
        f("metric", "Project age", "2 days", "New", 0),
      ]),
      momentum: early("Two days is too short to tell whether this is moving.", [
        f("metric", "Tasks finished", "1 of 6", "Early", 0),
        f("metric", "Files added", "2", "Early", 0),
        f("metric", "Project age", "2 days", "New", 0),
      ]),
      files: early("No files have been sent for sign-off yet.", [
        f("file", "Season brief.docx", "Draft · you", "Draft", 0),
        f("metric", "Waiting on sign-off", "None", "Early", 0),
        f("metric", "Project age", "2 days", "New", 0),
      ]),
    },
  },
];

/* ── one project: The Orchard by workstream ──────────────────────── */

const quiet = (label: string, why: string, facts: Fact[], last: CellState = same(0, label)) => cell(0, label, why, facts, last);

export const ORCHARD_STREAMS: Row[] = [
  {
    id: "ws-food",
    name: "Food and drink",
    initials: "FD",
    color: "var(--v3-project-6)",
    kind: "Led by Aoife",
    next: "Menu tasting, 1 Aug",
    cells: {
      schedule: cell(3, "1 late", "The olives and tonic order is two days late, and the tasting menu is due tomorrow.", [
        f("task", "Order tonic and the good olives", "Tomás · due Tue 14 Jul", "2 days late", 3),
        f("task", "Confirm the tasting menu with the chef", "Aoife · due Fri", "Not started", 2),
        f("task", "Wine list for the tables", "Aoife · due next week", "Started", "good"),
      ], same(1, "Tight"), ["tomas", "aoife"], [askTomas, moveTasting]),
      decisions: cell(1, "Welcome drinks", "Tomás needs to know prosecco or cider by Monday to order.", [
        f("decision", "Welcome drinks: prosecco or cider", "Asked by Tomás · yesterday", "1 day", 1),
        f("decision", "Cake flavour", "Settled by Mara · Sun", "Settled", "good"),
        f("metric", "Other open questions", "None", "Clear", "good"),
      ], same(0, "None waiting"), ["you"]),
      workload: cell(2, "Aoife 6 tasks", "Aoife owns six of the eight food tasks, including the two due this week.", [
        f("person", "Aoife", "6 of 8 food tasks", "Heavy", 2),
        f("person", "Tomás", "2 of 8 food tasks", "Fine", "good"),
        f("task", "Confirm the tasting menu", "Aoife · due Fri", "Not started", 2),
      ], same(1, "Aoife 5 tasks"), ["aoife"], [rebalanceAoife]),
      replies: cell(3, "Menu, 6 days", "Menu choices from Mara and Finn have been waiting six days, and the tasting depends on them.", [
        f("message", "Menu choices for the tasting", "Sent Fri 10 Jul · opened twice", "No reply", 3),
        f("message", "Dietary needs", "38 of 112 guests", "Partial", 2),
        f("message", "Cake tasting follow-up", "Replied Sun", "Replied", "good"),
      ], same(2, "Menu, 5 days"), ["mara-finn", "menu"], [nudgeMaraFinn]),
      momentum: cell(3, "Tasting stalled", "The tasting has not moved in 15 days because the chef is waiting on the menu choices.", [
        f("task", "Menu tasting at The Orchard", "No change since Wed 1 Jul", "15 days", 3),
        f("task", "Book the chef for the tasting", "Tomás · blocked", "Blocked", 2),
        f("task", "Cake tasting", "Done Sun", "Done", "good"),
      ], same(2, "Stalled 8 days"), ["menu", "mara-finn"], [moveTasting, nudgeMaraFinn]),
      files: cell(1, "Menu v2 open", "Menu draft v2 is waiting on the couple's choices before it can go for sign-off.", [
        f("file", "Menu draft v2.docx", "Waiting on choices", "Draft", 1),
        f("file", "Bar list.xlsx", "Signed Mon", "Signed", "good"),
        f("file", "Cake order.pdf", "Signed Sun", "Signed", "good"),
      ], same(1, "Menu v2 open"), ["menu"]),
    },
  },
  {
    id: "ws-venue",
    name: "Venue and hire",
    initials: "VH",
    color: "var(--v3-project-4)",
    kind: "Led by Aoife",
    next: "Marquee set-up, 1 Oct",
    cells: {
      schedule: cell(2, "Run-sheet today", "The Saturday run-sheet is due today and has not started.", [
        f("task", "Build the Saturday run-sheet", "Aoife · due today", "Not started", 2),
        f("task", "Print the table plan draft", "Aoife · due Wed", "1 day late", 3),
        f("task", "Confirm the marquee size", "Tomás · done Mon", "Done", "good"),
      ], same(0, "On time"), ["aoife"], [rebalanceAoife]),
      decisions: cell(2, "Seating, you", "Aoife has waited four days for you to choose the seating plan.", [
        f("decision", "Seating plan: layout B or C", "Asked by Aoife · Sun", "4 days", 2),
        f("decision", "Band position", "Settled · Tue", "Settled", "good"),
        f("metric", "Other open questions", "None", "Clear", "good"),
      ], same(1, "Seating, you"), ["you"], [decideSeating]),
      workload: cell(1, "Aoife 4 tasks", "Aoife has four of the five venue tasks on top of the food work.", [
        f("person", "Aoife", "4 of 5 venue tasks", "Heavy", 1),
        f("person", "Tomás", "1 of 5 venue tasks", "Fine", "good"),
        f("metric", "Unassigned", "None", "Clear", "good"),
      ], same(1, "Aoife 4 tasks"), ["aoife"]),
      replies: quiet("All answered", "The marquee and furniture hire have both replied this week.", [
        f("message", "Marquee hire", "Replied Mon", "Replied", "good"),
        f("message", "Chairs and tables", "Replied Tue", "Replied", "good"),
        f("metric", "Waiting", "None", "Clear", "good"),
      ]),
      momentum: quiet("Moving", "Three venue tasks moved this week, including the marquee size.", [
        f("task", "Confirm the marquee size", "Done Mon", "Done", "good"),
        f("task", "Chair hire", "Booked Tue", "Done", "good"),
        f("metric", "Longest wait", "4 days", "Fine", "good"),
      ]),
      files: cell(2, "Floor plan v4", "Floor plan v4 has waited five days for the couple's signature.", [
        f("file", "Floor plan v4.pdf", "Sent Sat 11 Jul", "Unsigned", 2),
        f("file", "Marquee hire contract.pdf", "Signed Mon", "Signed", "good"),
        f("file", "Floor plan v3.pdf", "Replaced by v4", "Old", 0),
      ], same(1, "v4 sent"), ["mara-finn"]),
    },
  },
  {
    id: "ws-guests",
    name: "Guests",
    initials: "GU",
    color: "var(--v3-project-8)",
    kind: "Led by Niamh",
    next: "RSVPs close, 20 Aug",
    cells: {
      schedule: quiet("On time", "Both guest tasks due this week have started.", [
        f("task", "Chase late RSVPs", "Niamh · due Fri", "Started", "good"),
        f("task", "Hotel block list", "Niamh · done Tue", "Done", "good"),
        f("metric", "Tasks due this week", "2 of 2 moving", "On time", "good"),
      ]),
      decisions: quiet("None waiting", "No guest choices are open.", [
        f("metric", "Open questions", "None", "Clear", "good"),
        f("decision", "Plus-ones for cousins", "Settled · last week", "Settled", "good"),
        f("decision", "Kids table", "Settled · Mon", "Settled", "good"),
      ]),
      workload: quiet("Even", "Niamh holds the guest work comfortably.", [
        f("person", "Niamh", "3 guest tasks", "Fine", "good"),
        f("metric", "Unassigned", "None", "Clear", "good"),
        f("metric", "Due this week", "2", "Fine", "good"),
      ]),
      replies: cell(1, "Dietary 38/112", "Dietary needs are back for 38 of 112 guests, with five weeks to go.", [
        f("metric", "Dietary needs", "38 of 112 back", "Partial", 1),
        f("metric", "RSVPs", "96 of 112 back", "Good", "good"),
        f("message", "Reminder in the RSVP site", "Live since Mon", "Live", "good"),
      ], same(1, "Dietary 30/112"), ["mara-finn"]),
      momentum: quiet("Moving", "Eleven RSVPs came in this week.", [
        f("metric", "RSVPs this week", "11", "Moving", "good"),
        f("metric", "Dietary replies", "8 this week", "Moving", "good"),
        f("metric", "Longest wait", "3 days", "Fine", "good"),
      ]),
      files: quiet("Nothing to sign", "No guest files need sign-off.", [
        f("file", "Guest list.xlsx", "Updated today", "Current", "good"),
        f("metric", "Waiting on sign-off", "None", "Clear", "good"),
        f("file", "Hotel block.pdf", "Confirmed", "Signed", "good"),
      ]),
    },
  },
  {
    id: "ws-suppliers",
    name: "Suppliers",
    initials: "SU",
    color: "var(--v3-project-5)",
    kind: "Led by Tomás",
    next: "Final numbers, 18 Sep",
    cells: {
      schedule: cell(1, "1 due soon", "The florist deposit is due Monday and has not been paid yet.", [
        f("task", "Pay the florist deposit", "Tomás · due Mon", "Not started", 1),
        f("task", "Confirm the band's rider", "Tomás · done Tue", "Done", "good"),
        f("metric", "Tasks due this week", "2 of 3 moving", "Close", 1),
      ], same(0, "On time"), ["tomas"], [askTomas]),
      decisions: quiet("None waiting", "No supplier choices are open.", [
        f("decision", "Florist: Wildflower Co.", "Settled · Jun", "Settled", "good"),
        f("decision", "Band: The Hedgerows", "Settled · May", "Settled", "good"),
        f("metric", "Open questions", "None", "Clear", "good"),
      ]),
      workload: cell(1, "Tomás 1 late", "Tomás carries the one late order across both his projects.", [
        f("person", "Tomás", "7 open · 1 late", "Watch", 1),
        f("task", "Order tonic and the good olives", "Tomás · 2 days late", "Late", 3),
        f("metric", "Unassigned", "None", "Clear", "good"),
      ], same(0, "Even"), ["tomas"], [askTomas]),
      replies: cell(1, "Marquee quote", "The marquee lighting quote has been out for three days.", [
        f("message", "Marquee lighting quote", "Sent Mon", "3 days", 1),
        f("message", "Florist confirmation", "Replied Tue", "Replied", "good"),
        f("message", "Band rider", "Replied Mon", "Replied", "good"),
      ], same(0, "All answered")),
      momentum: quiet("Moving", "Two supplier bookings were confirmed this week.", [
        f("metric", "Bookings confirmed", "2 this week", "Moving", "good"),
        f("metric", "Longest wait", "3 days", "Fine", "good"),
        f("task", "Confirm the band's rider", "Done Tue", "Done", "good"),
      ]),
      files: quiet("Contracts signed", "All five supplier contracts are signed.", [
        f("file", "Florist contract.pdf", "Signed Jun", "Signed", "good"),
        f("file", "Band contract.pdf", "Signed May", "Signed", "good"),
        f("metric", "Contracts", "5 of 5 signed", "Complete", "good"),
      ]),
    },
  },
  {
    id: "ws-admin",
    name: "Admin",
    initials: "AD",
    color: "var(--v3-project-2)",
    kind: "Led by you",
    next: "Balance invoice, 3 Sep",
    cells: {
      schedule: quiet("On time", "The one admin task this week is done.", [
        f("task", "Send the deposit receipt", "You · done Wed", "Done", "good"),
        f("metric", "Tasks due this week", "1 of 1 done", "On time", "good"),
        f("metric", "Late", "None", "Clear", "good"),
      ]),
      decisions: quiet("None waiting", "No admin choices are open.", [
        f("metric", "Open questions", "None", "Clear", "good"),
        f("decision", "Payment schedule", "Settled · Jun", "Settled", "good"),
        f("decision", "Insurance cover", "Settled · May", "Settled", "good"),
      ]),
      workload: quiet("Even", "You hold the admin work, with room.", [
        f("person", "You", "2 admin tasks", "Fine", "good"),
        f("metric", "Unassigned", "None", "Clear", "good"),
        f("metric", "Due this week", "0", "Fine", "good"),
      ]),
      replies: quiet("All answered", "The couple settled the deposit invoice yesterday.", [
        f("message", "Deposit invoice", "Paid yesterday", "Paid", "good"),
        f("metric", "Waiting", "None", "Clear", "good"),
        f("message", "Contract questions", "Answered Mon", "Replied", "good"),
      ], same(1, "Deposit due")),
      momentum: quiet("Moving", "The deposit landed and the receipt went out.", [
        f("metric", "Payments in", "1 this week", "Moving", "good"),
        f("task", "Deposit receipt", "Done Wed", "Done", "good"),
        f("metric", "Longest wait", "1 day", "Fine", "good"),
      ]),
      files: quiet("All signed", "The contract and the payment schedule are both signed.", [
        f("file", "Wedding contract.pdf", "Signed Apr", "Signed", "good"),
        f("file", "Payment schedule.pdf", "Signed Apr", "Signed", "good"),
        f("metric", "Waiting on sign-off", "None", "Clear", "good"),
      ]),
    },
  },
];

/* ── trends ──────────────────────────────────────────────────────── */

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A deterministic 14-day pressure line, 0 (calm) to 3 (needs attention). */
export function trendFor(key: string, last: Tone, now: Tone): number[] | null {
  if (now === "early") return null;
  const a = last === "early" ? 0 : last;
  const b = now;
  let seed = hash(key);
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const start = Math.max(0, a - 0.4 + rand() * 0.5);
  const out: number[] = [];
  for (let i = 0; i < 14; i++) {
    let v: number;
    if (i <= 7) v = start + ((a - start) * i) / 7;
    else v = a + ((b - a) * (i - 7)) / 6;
    const jitter = (rand() - 0.5) * 0.35;
    out.push(Math.min(3, Math.max(0, i === 13 ? b : v + jitter)));
  }
  return out;
}
