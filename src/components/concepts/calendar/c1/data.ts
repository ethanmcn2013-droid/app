/* The living month: sample world. Fixed "today" so the concept never drifts. */

export const TODAY = "2026-10-01"; // Thursday 1 October 2026

export type ProjectId = "orchard" | "wedding" | "heat" | "crumb";
export type Status = "todo" | "doing" | "review" | "blocked" | "done";
export type Priority = "urgent" | "high" | "normal" | "low";

export type Project = {
  id: ProjectId;
  name: string;
  short: string;
  /** CSS colour, always a v3 project identity token. */
  color: string;
  /** Hashtag words the quick-add bar understands. */
  tags: string[];
};

export type Person = {
  id: string;
  name: string;
  role: string;
  color: string;
  guest?: boolean;
  home: ProjectId;
};

export type Task = {
  id: string;
  title: string;
  project: ProjectId;
  status: Status;
  priority: Priority;
  people: string[];
  guests?: string[];
  /** ISO day. Undefined means it needs a date. */
  start?: string;
  /** ISO day, inclusive, for tasks that run over several days. */
  end?: string;
  milestone?: boolean;
  /** A short label for tight spots, used by milestones pinned beside the date. */
  short?: string;
  note?: string;
};

export const PROJECTS: Project[] = [
  { id: "orchard", name: "The Orchard, events", short: "The Orchard", color: "var(--v3-project-3)", tags: ["orchard", "venue", "events"] },
  { id: "wedding", name: "Mara & Finn wedding", short: "Mara & Finn", color: "var(--v3-project-8)", tags: ["wedding", "mara", "finn"] },
  { id: "heat", name: "Urban heat islands", short: "Heat islands", color: "var(--v3-project-5)", tags: ["heat", "geography", "school", "uhi"] },
  { id: "crumb", name: "Crumb & Co rebrand", short: "Crumb & Co", color: "var(--v3-project-2)", tags: ["crumb", "rebrand", "fieldwork"] },
];

export const PROJECT: Record<ProjectId, Project> = Object.fromEntries(PROJECTS.map((p) => [p.id, p])) as Record<ProjectId, Project>;

export const PEOPLE: Person[] = [
  { id: "orla", name: "Orla", role: "Venue manager", color: "var(--v3-project-3)", home: "orchard" },
  { id: "dev", name: "Dev", role: "Head chef", color: "var(--v3-project-6)", home: "orchard" },
  { id: "aoife", name: "Aoife", role: "Events coordinator", color: "var(--v3-project-8)", home: "wedding" },
  { id: "sam", name: "Sam", role: "AV and lighting", color: "var(--v3-project-1)", home: "orchard" },
  { id: "mara", name: "Mara", role: "Client, guest", color: "var(--v3-project-7)", home: "wedding", guest: true },
  { id: "finn", name: "Finn", role: "Client, guest", color: "var(--v3-project-4)", home: "wedding", guest: true },
  { id: "niamh", name: "Niamh", role: "Student", color: "var(--v3-project-5)", home: "heat" },
  { id: "tomas", name: "Tomás", role: "Student", color: "var(--v3-project-4)", home: "heat" },
  { id: "priya", name: "Priya", role: "Student", color: "var(--v3-project-1)", home: "heat" },
  { id: "ben", name: "Ben", role: "Student", color: "var(--v3-project-6)", home: "heat" },
  { id: "jess", name: "Jess", role: "Design, Fieldwork", color: "var(--v3-project-2)", home: "crumb" },
  { id: "kofi", name: "Kofi", role: "Copy and client, Fieldwork", color: "var(--v3-project-7)", home: "crumb" },
];

export const PERSON: Record<string, Person> = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

export const STATUS_LABEL: Record<Status, string> = {
  todo: "Not started",
  doing: "In progress",
  review: "In review",
  blocked: "Blocked",
  done: "Done",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High priority",
  normal: "Normal priority",
  low: "Low priority",
};

let seq = 0;
function t(
  title: string,
  project: ProjectId,
  start: string | undefined,
  people: string[],
  extra: Partial<Omit<Task, "id" | "title" | "project" | "people">> = {},
): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    title,
    project,
    start: start ? `2026-${start}` : undefined,
    people,
    status: "todo",
    priority: "normal",
    ...extra,
    end: extra.end ? `2026-${extra.end}` : undefined,
  };
}

export const INITIAL_TASKS: Task[] = [
  /* Late September: some done, some slipped. */
  t("Brand audit interviews", "crumb", "09-28", ["kofi", "jess"], { end: "09-30", status: "done" }),
  t("Invoice deposit for the Fennelly party", "orchard", "09-28", ["orla"], { priority: "high", note: "Half up front, as agreed on the call." }),
  t("Draft survey questions", "heat", "09-29", ["tomas", "ben"], { status: "done" }),
  t("Confirm marquee sides with Hanleys", "wedding", "09-29", ["aoife", "orla"], { priority: "high", note: "Clear sides if the forecast holds; they need 48 hours' notice." }),
  t("Order tonic and good olives", "orchard", "09-30", ["dev"], { status: "doing" }),
  t("Moodboard sign-off from Crumb", "crumb", "09-30", ["kofi"], { status: "blocked", note: "Waiting on the owners, who are away until Monday." }),
  t("Fix the terrace festoon lights", "orchard", "09-30", ["sam"], { status: "done" }),

  /* This week. */
  t("Seating plan v3 from Mara", "wedding", "10-01", ["aoife"], { status: "review", guests: ["mara"] }),
  t("Logo lockups, round 2", "crumb", "10-01", ["jess"], { status: "doing", priority: "high" }),
  t("Book the minibus for Smithfield", "heat", "10-01", ["ben"]),
  t("Florist walk-through", "wedding", "10-02", ["aoife", "orla"], { guests: ["mara", "finn"] }),
  t("Build the Saturday run-sheet", "orchard", "10-02", ["orla"], { status: "doing" }),
  t("Tagline options for Crumb", "crumb", "10-02", ["kofi"], { status: "doing" }),
  t("Fennelly party: final numbers", "orchard", "10-02", ["orla", "dev"]),
  t("Fennelly 40th, Saturday service", "orchard", "10-03", ["orla", "dev", "sam"], { priority: "urgent" }),

  /* Week of 5 October. */
  t("Collect survey data at Smithfield", "heat", "10-05", ["niamh", "tomas", "priya"], { end: "10-07", priority: "high", note: "Three mornings, 07:00 to 10:00. Thermometers are in the geography store." }),
  t("Colour palette review", "crumb", "10-05", ["jess", "kofi"], { status: "review" }),
  t("Weekly venue meeting", "orchard", "10-05", ["orla", "aoife", "sam"]),
  t("Send menu options to Mara & Finn", "wedding", "10-06", ["dev", "aoife"], { guests: ["mara", "finn"] }),
  t("Photography shot list", "wedding", "10-06", ["aoife"], { guests: ["mara"] }),
  t("Packaging dieline to printer", "crumb", "10-07", ["jess"], { priority: "high" }),
  t("Write methods section", "heat", "10-08", ["priya"], { status: "doing" }),
  t("Website copy, first pass", "crumb", "10-08", ["kofi"], { status: "doing" }),
  t("Draft report due", "heat", "10-09", ["niamh", "tomas", "priya"], { milestone: true, short: "Draft report" }),
  t("Write results section", "heat", "10-09", ["niamh"]),
  t("Charts for the report", "heat", "10-09", ["tomas"]),
  t("Proofread the draft report", "heat", "10-09", ["priya", "niamh"]),
  t("Sound check for the jazz night", "orchard", "10-09", ["sam"]),
  t("Final menu tasting with Mara & Finn", "wedding", "10-10", ["dev", "aoife"], { milestone: true, short: "Menu tasting", guests: ["mara", "finn"] }),
  t("Prep the tasting menu, six courses", "wedding", "10-10", ["dev"], { status: "doing" }),

  /* Week of 12 October. */
  t("Launch-day Instagram posts", "crumb", "10-12", ["kofi", "jess"], { status: "doing" }),
  t("Crumb & Co launch", "crumb", "10-13", ["jess", "kofi"], { milestone: true, short: "Launch day" }),
  t("Launch week social run", "crumb", "10-13", ["kofi"], { end: "10-16" }),
  t("Slides: intro and methods", "heat", "10-15", ["niamh", "priya"]),
  t("Wedding stationery at the printer", "wedding", "10-16", ["aoife"], { end: "10-20" }),
  t("Heat map figures for the slides", "heat", "10-16", ["tomas"]),
  t("Harvest supper, 60 covers", "orchard", "10-17", ["orla", "dev", "sam"], { priority: "high" }),

  /* Week of 19 October: the wedding. */
  t("Rehearse presentation", "heat", "10-19", ["niamh", "tomas", "priya"]),
  t("Final guest numbers from Mara", "wedding", "10-20", ["aoife"], { priority: "high", guests: ["mara"] }),
  t("Group presentation", "heat", "10-21", ["niamh", "tomas", "priya"], { milestone: true, short: "Presentation" }),
  t("Lighting plan for the ceremony", "wedding", "10-21", ["sam"], { status: "review" }),
  t("Marquee goes up", "wedding", "10-22", ["orla", "sam"]),
  t("Rehearsal dinner, 24 covers", "wedding", "10-23", ["dev", "aoife"]),
  t("Place cards and table plan printed", "wedding", "10-23", ["aoife"]),
  t("Mara & Finn's wedding", "wedding", "10-24", ["aoife"], { milestone: true, short: "Wedding day", guests: ["mara", "finn"] }),
  t("Ceremony set-up on the lawn", "wedding", "10-24", ["sam", "orla"], { priority: "urgent" }),
  t("Florist arrives, 10:00", "wedding", "10-24", ["aoife"]),
  t("Canapés for 120", "wedding", "10-24", ["dev"]),
  t("Sound check with the band", "wedding", "10-24", ["sam"]),
  t("Welcome drinks table", "wedding", "10-24", ["orla"]),
  t("Speeches: mics and running order", "wedding", "10-24", ["sam", "aoife"]),
  t("Wedding breakfast service", "wedding", "10-24", ["dev", "orla"]),
  t("Cut the cake, 21:30", "wedding", "10-24", ["aoife"], { guests: ["mara", "finn"] }),
  t("Late food: toasties", "wedding", "10-24", ["dev"]),

  /* Afterwards. */
  t("Strike the marquee", "wedding", "10-26", ["sam", "orla"]),
  t("Thank-you note and final invoice", "wedding", "10-27", ["aoife", "orla"]),
  t("Hand in the reflection essay", "heat", "10-29", ["niamh", "ben"]),
  t("Halloween menu", "orchard", "10-30", ["dev"]),
  t("Post-event review with Orla", "orchard", "10-28", ["orla", "aoife"]),

  /* Needs a date. */
  t("Quote for the Doyle christening", "orchard", undefined, ["orla"]),
  t("Replace the projector bulb", "orchard", undefined, ["sam"]),
  t("Case studies page for Fieldwork", "crumb", undefined, ["jess"]),
  t("Bibliography tidy-up", "heat", undefined, ["priya"]),
  t("Honeymoon taxi to the airport", "wedding", undefined, ["aoife"], { guests: ["finn"] }),
  t("Winter menu ideas", "orchard", undefined, ["dev"], { priority: "low" }),
];

/* ── Dates (all UTC, all ISO day strings) ─────────────────────────── */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type YM = { y: number; m: number }; // m is 0-11

export function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function isoOf(y: number, m: number, d: number) {
  return toIso(new Date(Date.UTC(y, m, d)));
}
export function addDays(iso: string, n: number) {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}
export function diffDays(a: string, b: string) {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);
}
/** 0 = Monday … 6 = Sunday. */
export function weekday(iso: string) {
  return (parseIso(iso).getUTCDay() + 6) % 7;
}
export function dayOfMonth(iso: string) {
  return parseIso(iso).getUTCDate();
}
export function ymOf(iso: string): YM {
  const d = parseIso(iso);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}
export function addMonths(ym: YM, n: number): YM {
  const total = ym.y * 12 + ym.m + n;
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
}
export function sameYM(a: YM, b: YM) {
  return a.y === b.y && a.m === b.m;
}
export function monthName(ym: YM) {
  return MONTHS[ym.m];
}
export function monthLabel(ym: YM) {
  return `${MONTHS[ym.m]} ${ym.y}`;
}
export function monthShort(m: number) {
  return MONTHS_SHORT[m];
}
export function daysInMonth(ym: YM) {
  return new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
}
export function mondayOf(iso: string) {
  return addDays(iso, -weekday(iso));
}
/** Only the weeks that touch the month, Monday first. */
export function monthWeeks(ym: YM): string[][] {
  const first = isoOf(ym.y, ym.m, 1);
  const last = isoOf(ym.y, ym.m, daysInMonth(ym));
  const weeks: string[][] = [];
  for (let mon = mondayOf(first); mon <= last; mon = addDays(mon, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(mon, i)));
  }
  return weeks;
}
export function rollingWeeks(fromIso: string, count: number): string[][] {
  const mon = mondayOf(fromIso);
  return Array.from({ length: count }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(mon, w * 7 + i)));
}
/** "Fri 9 Oct" */
export function shortDay(iso: string) {
  const d = parseIso(iso);
  return `${WEEKDAYS_SHORT[weekday(iso)]} ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}
/** "Friday 9 October" */
export function longDay(iso: string) {
  const d = parseIso(iso);
  return `${WEEKDAYS[weekday(iso)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
export function dayMonth(iso: string) {
  const d = parseIso(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
export function relativeDay(iso: string) {
  const n = diffDays(TODAY, iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return null;
}

/* ── Task helpers ─────────────────────────────────────────────────── */

export function endOf(task: Task) {
  return task.end ?? task.start;
}
export function isSpan(task: Task) {
  return !!task.start && !!task.end && task.end !== task.start;
}
export function covers(task: Task, iso: string) {
  if (!task.start) return false;
  return task.start <= iso && (endOf(task) as string) >= iso;
}
export function isOverdue(task: Task) {
  return task.status !== "done" && !!task.start && (endOf(task) as string) < TODAY;
}

const STATUS_ORDER: Record<Status, number> = { blocked: 0, doing: 1, review: 2, todo: 3, done: 4 };
const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
export function taskOrder(a: Task, b: Task) {
  return (
    Number(isOverdue(b)) - Number(isOverdue(a)) ||
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    a.title.localeCompare(b.title)
  );
}

/** Everything on a day that counts towards how busy it is: open tasks and milestones. */
export function dayLoad(tasks: Task[], iso: string) {
  let open = 0;
  let done = 0;
  const people = new Set<string>();
  for (const task of tasks) {
    if (!covers(task, iso)) continue;
    if (task.status === "done") done += 1;
    else {
      open += 1;
      task.people.forEach((p) => people.add(p));
    }
  }
  return { open, done, people: people.size };
}

export type LoadLevel = "none" | "light" | "steady" | "busy" | "packed";
export function loadLevel(open: number): LoadLevel {
  if (open === 0) return "none";
  if (open <= 2) return "light";
  if (open <= 4) return "steady";
  if (open <= 7) return "busy";
  return "packed";
}
export const LOAD_WORD: Record<LoadLevel, string> = {
  none: "Free",
  light: "Light",
  steady: "Steady",
  busy: "Busy",
  packed: "Packed",
};

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
