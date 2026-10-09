/**
 * Sample data for the Studio columns concept. Invented, front end only.
 * Today is Friday 25 September 2026; Mara and Finn marry on Saturday 3 October.
 */

export const TODAY = "2026-09-25";

export type StageKey = "todo" | "doing" | "review" | "waiting" | "done";

export type Stage = {
  key: StageKey;
  name: string;
  /** Soft work-in-progress limit. */
  limit?: number;
  /** One quiet line for the empty column. */
  empty: string;
};

export const STAGES: Stage[] = [
  { key: "todo", name: "To do", empty: "Nothing queued. Add the next thing the team should pick up." },
  { key: "doing", name: "In progress", limit: 3, empty: "No one is working on anything yet. Drag a task here when you start it." },
  { key: "review", name: "Review", limit: 3, empty: "Nothing to check. Move a task here when it needs a second pair of eyes." },
  {
    key: "waiting",
    name: "Waiting",
    empty: "Nothing is held up. Drop a task here when it is waiting on a reply or delivery.",
  },
  { key: "done", name: "Done", empty: "Finished work lands here." },
];

export type Person = {
  id: string;
  name: string;
  first: string;
  initials: string;
  /** Avatar ground: a v3 project identity token (white initials pass AA). */
  tone: string;
  role: string;
  guest?: boolean;
};

export type Priority = 0 | 1 | 2 | 3;

export type CoverKind = "plan" | "sheet" | "menu" | "poster" | "map";

export type Cover = { kind: CoverKind; caption: string; from: string; to: string };

export type Subtask = { id: string; text: string; done: boolean };

export type Label = { name: string; tone: string };

export type Task = {
  id: string;
  title: string;
  stage: StageKey;
  due?: string;
  priority: Priority;
  label?: Label;
  people: string[];
  subtasks?: Subtask[];
  comments?: number;
  cover?: Cover;
  heldBy?: string;
  description?: string;
  doneAt?: string;
};

export type Dataset = {
  id: string;
  name: string;
  kind: string;
  tone: string;
  people: Person[];
  tasks: Task[];
  /** Suggested first tasks for a brand new project. */
  starters?: string[];
};

const P1 = "var(--v3-project-1)";
const P2 = "var(--v3-project-2)";
const P3 = "var(--v3-project-3)";
const P4 = "var(--v3-project-4)";
const P5 = "var(--v3-project-5)";
const P6 = "var(--v3-project-6)";
const P8 = "var(--v3-project-8)";

const WEDDING: Label = { name: "Mara & Finn", tone: P8 };
const VENUE: Label = { name: "Venue", tone: P3 };
const BAR: Label = { name: "Bar", tone: P5 };
const ENQUIRY: Label = { name: "Enquiry", tone: P2 };

let seq = 0;
const subs = (items: [string, boolean][]): Subtask[] => items.map(([text, done]) => ({ id: `s${++seq}`, text, done }));

const ORCHARD_PEOPLE: Person[] = [
  { id: "orla", name: "Orla Byrne", first: "Orla", initials: "OB", tone: P1, role: "Venue manager" },
  { id: "dev", name: "Dev Patel", first: "Dev", initials: "DP", tone: P3, role: "Bar and operations" },
  { id: "siobhan", name: "Siobhan Kelly", first: "Siobhan", initials: "SK", tone: P6, role: "Events" },
  { id: "mara", name: "Mara Quinn", first: "Mara", initials: "MQ", tone: P8, role: "The couple", guest: true },
];

const ORCHARD_TASKS: Task[] = [
  // To do
  {
    id: "o1",
    title: "Confirm marquee sides with the hire company",
    stage: "todo",
    due: "2026-09-28",
    priority: 3,
    label: WEDDING,
    people: ["orla"],
    comments: 2,
    description:
      "Hire House are holding clear sides and two solid ones. We need to tell them which by Monday or they release the clear panels to another job.",
    subtasks: subs([
      ["Check the forecast for the 3rd", true],
      ["Ask Mara which view matters more", false],
      ["Email Hire House with the final count", false],
    ]),
  },
  {
    id: "o2",
    title: "Reprint the faded welcome sign",
    stage: "todo",
    due: "2026-09-22",
    priority: 2,
    label: VENUE,
    people: ["siobhan"],
    description: "The one at the gate has gone pale in the sun. Same artwork, matte this time. PrintHaus can turn it round in two days.",
  },
  {
    id: "o3",
    title: "Test the festoon lights on the terrace",
    stage: "todo",
    due: "2026-10-01",
    priority: 2,
    label: VENUE,
    people: ["dev"],
    subtasks: subs([
      ["Swap the two dead bulbs by the steps", false],
      ["Check the timer on the outdoor socket", false],
      ["Run them from dusk for an hour", false],
    ]),
    description: "Run the full string from dusk. Last year two bulbs near the steps kept flickering.",
  },
  {
    id: "o4",
    title:
      "Draft a wet-weather plan for the drinks reception, covering the terrace, the orchard lawn and the barn doors if the forecast turns on the day",
    stage: "todo",
    due: "2026-09-30",
    priority: 3,
    label: WEDDING,
    people: ["orla", "siobhan", "dev", "mara"],
    comments: 6,
    description:
      "Mara wants the drinks outside if at all possible. Plan B moves everything into the barn with the doors open. Decide the call time for switching.",
  },
  {
    id: "o5",
    title: "Book the extra cloakroom attendant",
    stage: "todo",
    priority: 1,
    people: [],
    description: "One more person on the cloakroom from 7pm. Ask the agency first, then Aoife's cousin.",
  },
  {
    id: "o6",
    title: "Send the midweek rate card to the June 2027 walk-in couple",
    stage: "todo",
    due: "2026-10-02",
    priority: 1,
    label: ENQUIRY,
    people: ["siobhan"],
  },
  // In progress
  {
    id: "o7",
    title: "Menu tasting at The Orchard",
    stage: "doing",
    due: TODAY,
    priority: 3,
    label: WEDDING,
    people: ["orla", "mara"],
    comments: 3,
    cover: { kind: "menu", caption: "Tasting menu, v2", from: P5, to: P8 },
    description: "Mara, Finn and both mothers at 4pm. Chef is doing the lamb and the hake side by side. Keep the vegan starter on the list.",
    subtasks: subs([
      ["Print tasting cards", true],
      ["Set the long table in the snug", true],
      ["Confirm numbers with chef", false],
      ["Wine pairing from Dev", false],
      ["Take notes on the final picks", false],
    ]),
  },
  {
    id: "o8",
    title: "Build the Saturday run-sheet",
    stage: "doing",
    due: "2026-09-29",
    priority: 3,
    label: WEDDING,
    people: ["siobhan"],
    comments: 4,
    cover: { kind: "sheet", caption: "Run-sheet draft", from: P1, to: P2 },
    description: "Minute by minute from 11am set-up to the 1am last bus. Share with the band, the photographer and the kitchen by Tuesday.",
    subtasks: subs([
      ["Set-up and deliveries", true],
      ["Ceremony", true],
      ["Drinks reception", true],
      ["Dinner and speeches", false],
      ["First dance and band", false],
      ["Late food", false],
      ["Last bus and close", false],
      ["Send to suppliers", false],
    ]),
  },
  {
    id: "o9",
    title: "Order tonic and the good olives",
    stage: "doing",
    due: "2026-09-23",
    priority: 2,
    label: BAR,
    people: ["dev"],
    description: "Six cases of the light tonic and the big tins of Nocellara. The wholesaler cut-off is noon.",
  },
  // Review
  {
    id: "o10",
    title: "Approve final seating plan",
    stage: "review",
    due: TODAY,
    priority: 3,
    label: WEDDING,
    people: ["orla", "siobhan"],
    comments: 5,
    cover: { kind: "plan", caption: "Floor plan v4", from: P3, to: P4 },
    description: "Fourteen round tables and the top table. Aunt Rose moves away from the speakers. Check the wheelchair route to table 6.",
    subtasks: subs([
      ["Top table order", true],
      ["Wheelchair route to table 6", true],
      ["Children's table near the doors", false],
    ]),
  },
  {
    id: "o11",
    title: "Sign off the recommended suppliers list",
    stage: "review",
    priority: 1,
    label: VENUE,
    people: ["orla"],
    comments: 1,
  },
  // Waiting
  {
    id: "o12",
    title: "Chase florist deposit",
    stage: "waiting",
    due: "2026-09-28",
    priority: 2,
    label: WEDDING,
    people: ["siobhan"],
    heldBy: "Bloom and Wild reply",
    description: "Invoice went on the 18th. They said Friday. If nothing by Monday, ring the shop.",
  },
  {
    id: "o13",
    title: "Confirm the band's arrival time",
    stage: "waiting",
    due: "2026-09-29",
    priority: 1,
    label: WEDDING,
    people: ["dev"],
    heldBy: "The Lindens' manager",
  },
  // Done: nine this week, two last week
  { id: "o14", title: "Book the ceilidh band", stage: "done", priority: 2, label: WEDDING, people: ["siobhan"], doneAt: "2026-09-25" },
  { id: "o15", title: "Send the final invoice to Mara and Finn", stage: "done", priority: 2, label: WEDDING, people: ["orla"], doneAt: "2026-09-25" },
  { id: "o16", title: "Order 180 chair covers", stage: "done", priority: 1, label: WEDDING, people: ["dev"], doneAt: "2026-09-24" },
  { id: "o17", title: "Walk the site with the photographer", stage: "done", priority: 1, label: WEDDING, people: ["siobhan"], doneAt: "2026-09-24" },
  { id: "o18", title: "Confirm the shuttle bus times", stage: "done", priority: 2, people: ["orla"], doneAt: "2026-09-23" },
  { id: "o19", title: "Set the bar float for Saturday", stage: "done", priority: 1, label: BAR, people: ["dev"], doneAt: "2026-09-23" },
  { id: "o20", title: "Update the allergy list for the kitchen", stage: "done", priority: 3, label: WEDDING, people: ["orla"], doneAt: "2026-09-22" },
  { id: "o21", title: "Collect the table numbers from the printer", stage: "done", priority: 1, people: ["siobhan"], doneAt: "2026-09-22" },
  { id: "o22", title: "Hang the new terrace heaters", stage: "done", priority: 1, label: VENUE, people: ["dev"], doneAt: "2026-09-21" },
  { id: "o23", title: "Renew the late licence", stage: "done", priority: 2, label: VENUE, people: ["orla"], doneAt: "2026-09-17" },
  { id: "o24", title: "Brief the kitchen on the vegan menu", stage: "done", priority: 1, people: ["orla"], doneAt: "2026-09-16" },
];

const RESEARCH: Label = { name: "Research", tone: P2 };
const POSTER: Label = { name: "Poster", tone: P4 };
const TALK: Label = { name: "Talk", tone: P6 };

const SCHOOL_PEOPLE: Person[] = [
  { id: "aoife", name: "Aoife Brennan", first: "Aoife", initials: "AB", tone: P2, role: "Group lead" },
  { id: "cian", name: "Cian Doyle", first: "Cian", initials: "CD", tone: P4, role: "Research" },
  { id: "leah", name: "Leah Walsh", first: "Leah", initials: "LW", tone: P8, role: "Poster" },
  { id: "tomas", name: "Tomás Ryan", first: "Tomás", initials: "TR", tone: P5, role: "Slides" },
  { id: "ruby", name: "Ruby Nolan", first: "Ruby", initials: "RN", tone: P1, role: "Talk" },
];

const SCHOOL_TASKS: Task[] = [
  {
    id: "y1",
    title: "Interview a grandparent about growing up in the 1960s",
    stage: "todo",
    due: "2026-09-30",
    priority: 2,
    label: RESEARCH,
    people: ["cian"],
    description: "Ten questions, record it on the class tablet, then write up the best three answers.",
  },
  {
    id: "y2",
    title: "Draw the timeline poster",
    stage: "todo",
    due: "2026-10-05",
    priority: 2,
    label: POSTER,
    people: ["leah", "aoife"],
    cover: { kind: "poster", caption: "Poster sketch", from: P4, to: P3 },
    subtasks: subs([
      ["Pick eight dates", true],
      ["Rough sketch in pencil", false],
      ["Colour and labels", false],
    ]),
  },
  { id: "y3", title: "Make the slides", stage: "todo", due: "2026-10-06", priority: 1, label: TALK, people: ["tomas"] },
  { id: "y4", title: "Practise the talk twice", stage: "todo", due: "2026-10-07", priority: 1, label: TALK, people: ["ruby", "tomas", "aoife", "leah", "cian"] },
  {
    id: "y5",
    title: "Find three sources in the school library",
    stage: "doing",
    due: "2026-09-24",
    priority: 3,
    label: RESEARCH,
    people: ["cian", "aoife"],
    comments: 2,
    subtasks: subs([
      ["One book", true],
      ["One newspaper from the time", false],
      ["One photo with a caption", false],
    ]),
  },
  {
    id: "y6",
    title: "Write the introduction",
    stage: "doing",
    due: TODAY,
    priority: 2,
    label: TALK,
    people: ["ruby"],
    description: "About 150 words. Say why we chose the 1960s and what the class will learn.",
  },
  {
    id: "y7",
    title: "Check the facts page with Ms Nolan",
    stage: "review",
    due: "2026-09-28",
    priority: 2,
    label: RESEARCH,
    people: ["aoife"],
    comments: 1,
    cover: { kind: "map", caption: "Facts page", from: P2, to: P1 },
  },
  { id: "y8", title: "Pick our topic", stage: "done", priority: 2, people: ["aoife"], doneAt: "2026-09-21" },
  { id: "y9", title: "Split up the jobs", stage: "done", priority: 1, people: ["aoife"], doneAt: "2026-09-22" },
  { id: "y10", title: "Borrow the class tablet", stage: "done", priority: 1, people: ["cian"], doneAt: "2026-09-24" },
];

export const DATASETS: Dataset[] = [
  { id: "orchard", name: "The Orchard", kind: "events", tone: P1, people: ORCHARD_PEOPLE, tasks: ORCHARD_TASKS },
  { id: "year3", name: "Year 3 history project", kind: "school", tone: P4, people: SCHOOL_PEOPLE, tasks: SCHOOL_TASKS },
  {
    id: "openday",
    name: "Autumn open day",
    kind: "new project",
    tone: P5,
    people: ORCHARD_PEOPLE.slice(0, 3),
    tasks: [],
    starters: [
      "Pick a date and put it on the calendar",
      "List everything that has to happen before the day",
      "Invite the people you will need to help",
    ],
  },
];
