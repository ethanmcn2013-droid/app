/* Sample data for the keyboard command list: The Orchard, a wedding and
   events venue, in the last week of September 2026. Invented, front-end
   only. "Today" is fixed so the story reads the same on every visit. */

export type StatusId = "todo" | "progress" | "review" | "waiting" | "done";
export type PersonId = "orla" | "dev" | "aoife" | "tom";
export type LabelId = "mara" | "venue" | "bar" | "enquiry" | "kitchen" | "openday";
/** 0 none, 1 low, 2 medium, 3 high, 4 urgent. */
export type Priority = 0 | 1 | 2 | 3 | 4;

export type Subtask = { id: string; title: string; done: boolean };
export type Activity = { who: PersonId | "you"; what: string; when: string };

export type Task = {
  id: number;
  title: string;
  status: StatusId;
  assignee: PersonId | null;
  /** ISO date (yyyy-mm-dd) or null. */
  due: string | null;
  priority: Priority;
  labels: LabelId[];
  description?: string;
  subtasks?: Subtask[];
  activity: Activity[];
};

export const TODAY = "2026-09-25"; // a Friday
export const PROJECT = { name: "The Orchard, events", key: "ORC", initial: "T" };
export const ME: PersonId = "orla";

export const STATUSES: { id: StatusId; name: string; hint: string }[] = [
  { id: "todo", name: "To do", hint: "Not started" },
  { id: "progress", name: "In progress", hint: "Someone is on it" },
  { id: "review", name: "Review", hint: "Ready for a second look" },
  { id: "waiting", name: "Waiting", hint: "Blocked on someone outside" },
  { id: "done", name: "Done", hint: "Finished" },
];

export const PEOPLE: Record<PersonId, { name: string; full: string; role: string; tone: string }> = {
  orla: { name: "Orla", full: "Orla Byrne", role: "Ops lead", tone: "var(--v3-project-3)" },
  dev: { name: "Dev", full: "Dev Mehta", role: "Bar manager", tone: "var(--v3-project-5)" },
  aoife: { name: "Aoife", full: "Aoife Kinsella", role: "Events coordinator", tone: "var(--v3-project-8)" },
  tom: { name: "Tom", full: "Tom Hickey", role: "Head chef", tone: "var(--v3-project-2)" },
};
export const PERSON_IDS = Object.keys(PEOPLE) as PersonId[];

export const LABELS: Record<LabelId, { name: string; tone: string }> = {
  mara: { name: "Mara & Finn", tone: "var(--v3-project-8)" },
  venue: { name: "Venue", tone: "var(--v3-project-3)" },
  bar: { name: "Bar", tone: "var(--v3-project-5)" },
  enquiry: { name: "Enquiry", tone: "var(--v3-project-2)" },
  kitchen: { name: "Kitchen", tone: "var(--v3-project-4)" },
  openday: { name: "Open day", tone: "var(--v3-project-1)" },
};
export const LABEL_IDS = Object.keys(LABELS) as LabelId[];

export const PRIORITIES: { p: Priority; name: string }[] = [
  { p: 4, name: "Urgent" },
  { p: 3, name: "High" },
  { p: 2, name: "Medium" },
  { p: 1, name: "Low" },
  { p: 0, name: "No priority" },
];

export const OTHER_PROJECTS = ["The Orchard, weddings 2027", "The Orchard, maintenance", "Kitchen refit"];

const made = (who: PersonId, when: string): Activity => ({ who, what: "created this task", when });

export const SAMPLE_TASKS: Task[] = [
  // ── To do ──
  {
    id: 38,
    title: "Confirm marquee sides with the hire company",
    status: "todo",
    assignee: "aoife",
    due: "2026-09-29",
    priority: 2,
    labels: ["mara", "venue"],
    description:
      "Mara and Finn want the sides rolled up for the drinks reception and down by 8pm. Ask Lawlor Hire whether the clear panels can be swapped for the window ones, and get it in writing.",
    subtasks: [
      { id: "a", title: "Measure the courtyard edge again", done: true },
      { id: "b", title: "Send Lawlor the floor plan", done: true },
      { id: "c", title: "Ask about clear versus window panels", done: false },
      { id: "d", title: "Confirm who rolls the sides at 8pm", done: false },
    ],
    activity: [
      made("orla", "3 Sep"),
      { who: "aoife", what: "added the Mara & Finn label", when: "10 Sep" },
      { who: "aoife", what: "moved the due date to Tue 29 Sep", when: "yesterday" },
    ],
  },
  {
    id: 41,
    title: "Order tonic and the good olives",
    status: "todo",
    assignee: "dev",
    due: "2026-09-23",
    priority: 2,
    labels: ["bar"],
    description: "Six cases of the light tonic, two of the elderflower, and the green Nocellara olives from Sheridans, not the black ones.",
    activity: [made("dev", "18 Sep")],
  },
  {
    id: 44,
    title: "Send the June 2027 rate to the walk-in couple",
    status: "todo",
    assignee: "aoife",
    due: "2026-09-28",
    priority: 1,
    labels: ["enquiry"],
    description: "Ciara and Josh walked in on Sunday. They liked the barn and asked about a Friday in June. Send the 2027 midweek and Friday rates with the brochure.",
    activity: [made("aoife", "21 Sep")],
  },
  {
    id: 45,
    title: "Book the ceilidh band for the open day",
    status: "todo",
    assignee: "aoife",
    due: "2026-10-06",
    priority: 1,
    labels: ["openday"],
    activity: [made("orla", "15 Sep")],
  },
  {
    id: 47,
    title: "Re-seal the terrace flagstones",
    status: "todo",
    assignee: "orla",
    due: null,
    priority: 1,
    labels: ["venue"],
    activity: [made("orla", "2 Sep")],
  },
  {
    id: 49,
    title:
      "Walk the whole site with the insurer's assessor and photograph every fire door, extinguisher and emergency light before the policy renews on 14 October",
    status: "todo",
    assignee: "orla",
    due: "2026-10-09",
    priority: 3,
    labels: ["venue"],
    description: "The assessor is Pat from Allianz. Bring the service log for the alarm and the extinguisher certificates from the office folder.",
    activity: [made("orla", "11 Sep")],
  },
  {
    id: 50,
    title: "Taste the autumn canapé menu with Mara and Finn",
    status: "todo",
    assignee: "tom",
    due: "2026-10-01",
    priority: 2,
    labels: ["mara", "kitchen"],
    activity: [made("aoife", "12 Sep")],
  },
  {
    id: 52,
    title: "Price a second glass-washer for the courtyard bar",
    status: "todo",
    assignee: "dev",
    due: null,
    priority: 1,
    labels: ["bar"],
    activity: [made("dev", "20 Sep")],
  },
  {
    id: 53,
    title: "Draft the open day welcome sign",
    status: "todo",
    assignee: "aoife",
    due: "2026-10-05",
    priority: 0,
    labels: ["openday"],
    activity: [made("aoife", "22 Sep")],
  },
  {
    id: 55,
    title: "Chase the florist for the arch quote",
    status: "todo",
    assignee: "aoife",
    due: "2026-09-24",
    priority: 2,
    labels: ["mara"],
    activity: [made("aoife", "14 Sep")],
  },
  {
    id: 56,
    title: "Check allergen cards against the new menu",
    status: "todo",
    assignee: "tom",
    due: "2026-09-30",
    priority: 4,
    labels: ["kitchen"],
    description: "The new menu adds the hazelnut crumb and a celery salt. Every card on the pass and the printed menus must match before Saturday service.",
    activity: [made("tom", "23 Sep")],
  },
  {
    id: 58,
    title: "Reply to the Brennan enquiry about Christmas parties",
    status: "todo",
    assignee: null,
    due: null,
    priority: 0,
    labels: ["enquiry"],
    activity: [made("aoife", "yesterday")],
  },
  {
    id: 59,
    title: "Order a replacement fairy-light string for the barn",
    status: "todo",
    assignee: "dev",
    due: "2026-10-07",
    priority: 0,
    labels: ["venue"],
    activity: [made("dev", "24 Sep")],
  },
  // ── In progress ──
  {
    id: 36,
    title: "Build the Saturday run-sheet",
    status: "progress",
    assignee: "orla",
    due: "2026-09-25",
    priority: 4,
    labels: ["mara"],
    description:
      "One page, minute by minute, from the 11am florist arrival to the last bus at 1am. Every supplier gets a name and a phone number next to their slot.",
    subtasks: [
      { id: "a", title: "Ceremony timings from the registrar", done: true },
      { id: "b", title: "Supplier arrival slots", done: true },
      { id: "c", title: "Speeches and first dance order", done: true },
      { id: "d", title: "Bus times from the hotel", done: false },
      { id: "e", title: "Print six copies for the team", done: false },
    ],
    activity: [
      made("orla", "1 Sep"),
      { who: "aoife", what: "added the speeches order", when: "Wed" },
      { who: "orla", what: "set priority to Urgent", when: "2h ago" },
    ],
  },
  {
    id: 33,
    title: "Deep-clean the cold room before the health visit",
    status: "progress",
    assignee: "tom",
    due: "2026-09-26",
    priority: 3,
    labels: ["kitchen"],
    activity: [made("tom", "16 Sep")],
  },
  {
    id: 34,
    title: "Set up the cocktail list for Mara & Finn",
    status: "progress",
    assignee: "dev",
    due: "2026-09-26",
    priority: 2,
    labels: ["bar", "mara"],
    activity: [made("dev", "10 Sep")],
  },
  {
    id: 39,
    title: "Seating plan: final pass with the couple",
    status: "progress",
    assignee: "aoife",
    due: "2026-09-25",
    priority: 3,
    labels: ["mara"],
    subtasks: [
      { id: "a", title: "Move the Dublin cousins off table 4", done: true },
      { id: "b", title: "Add the two late plus-ones", done: false },
      { id: "c", title: "Send the final plan to the kitchen", done: false },
    ],
    activity: [made("aoife", "8 Sep")],
  },
  {
    id: 40,
    title: "Update the open day booking form",
    status: "progress",
    assignee: "aoife",
    due: "2026-09-30",
    priority: 1,
    labels: ["openday", "enquiry"],
    activity: [made("aoife", "19 Sep")],
  },
  {
    id: 42,
    title: "Get three quotes for the car park lighting",
    status: "progress",
    assignee: "orla",
    due: "2026-10-12",
    priority: 2,
    labels: ["venue"],
    activity: [made("orla", "9 Sep")],
  },
  {
    id: 43,
    title: "Train two new bar staff on the till",
    status: "progress",
    assignee: "dev",
    due: "2026-09-29",
    priority: 2,
    labels: ["bar"],
    activity: [made("dev", "17 Sep")],
  },
  {
    id: 46,
    title: "Write the kitchen close-down checklist",
    status: "progress",
    assignee: "tom",
    due: null,
    priority: 1,
    labels: ["kitchen"],
    activity: [made("tom", "5 Sep")],
  },
  // ── Review ──
  {
    id: 31,
    title: "Wedding brochure 2027, second draft",
    status: "review",
    assignee: "aoife",
    due: "2026-09-28",
    priority: 2,
    labels: ["enquiry"],
    activity: [made("aoife", "28 Aug")],
  },
  {
    id: 32,
    title: "Check the PA and radio mics for Saturday",
    status: "review",
    assignee: "dev",
    due: "2026-09-25",
    priority: 3,
    labels: ["mara", "venue"],
    activity: [made("orla", "20 Sep")],
  },
  {
    id: 35,
    title: "Staff rota for October",
    status: "review",
    assignee: "orla",
    due: "2026-09-27",
    priority: 2,
    labels: [],
    activity: [made("orla", "15 Sep")],
  },
  {
    id: 37,
    title: "Open day social posts",
    status: "review",
    assignee: "aoife",
    due: "2026-10-01",
    priority: 1,
    labels: ["openday"],
    activity: [made("aoife", "18 Sep")],
  },
  {
    id: 48,
    title: "Supplier invoices for August",
    status: "review",
    assignee: "orla",
    due: "2026-09-22",
    priority: 2,
    labels: [],
    activity: [made("orla", "1 Sep")],
  },
  // ── Done ──
  { id: 21, title: "Confirm the registrar for Saturday", status: "done", assignee: "aoife", due: "2026-09-18", priority: 3, labels: ["mara"], activity: [made("aoife", "Aug")] },
  { id: 22, title: "Return the chairs to the hire company", status: "done", assignee: "orla", due: "2026-09-21", priority: 1, labels: ["venue"], activity: [made("orla", "Sep")] },
  { id: 24, title: "Order the Saturday bread from Hickey's", status: "done", assignee: "tom", due: "2026-09-24", priority: 2, labels: ["kitchen", "mara"], activity: [made("tom", "Sep")] },
  { id: 25, title: "Fix the wobbly bar hatch", status: "done", assignee: "dev", due: null, priority: 1, labels: ["bar"], activity: [made("dev", "Sep")] },
  { id: 26, title: "Send the deposit reminder to the Doyle wedding", status: "done", assignee: "aoife", due: "2026-09-22", priority: 2, labels: ["enquiry"], activity: [made("aoife", "Sep")] },
  { id: 27, title: "Restock the bridal suite", status: "done", assignee: "orla", due: "2026-09-24", priority: 1, labels: ["venue", "mara"], activity: [made("orla", "Sep")] },
  { id: 28, title: "Test the fire alarm", status: "done", assignee: "orla", due: "2026-09-23", priority: 3, labels: ["venue"], activity: [made("orla", "Sep")] },
  { id: 30, title: "Collect the ice machine from service", status: "done", assignee: "dev", due: "2026-09-22", priority: 2, labels: ["bar"], activity: [made("dev", "Sep")] },
];
