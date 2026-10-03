/* Sample data for "Today, next, later". Orla's own list, across projects.
   Everything here is invented; nothing is wired to a backend. */

export type Horizon = "leftover" | "inbox" | "today" | "next" | "later" | "someday" | "gone";
export type Segment = "morning" | "afternoon" | "evening";
export type Moment = "morning" | "midday" | "evening";
export type ProjectId = "orchard" | "mara" | "kite" | "hydro" | "home";
export type PersonId = "dev" | "mara" | "ciaran" | "aoife" | "niamh";

export type Task = {
  id: string;
  title: string;
  project: ProjectId;
  /** Minutes. null means nobody has estimated it yet (counted as 15m). */
  est: number | null;
  horizon: Horizon;
  seg?: Segment;
  done?: boolean;
  /** Shared with or waiting on someone other than Orla. */
  with?: PersonId;
  /** Plain-words lateness, e.g. "Due yesterday". */
  late?: string;
  /** A fixed time in the day, e.g. "4:00 pm". */
  at?: string;
  tomorrow?: boolean;
  /** Where an Inbox item came from. */
  from?: string;
  /** Left unfinished yesterday. */
  carried?: boolean;
};

export type DoneEntry = { id: string; title: string; project: ProjectId; est: number; day: string };

export const DEFAULT_EST = 15;

export const ME = { name: "Orla", initials: "OR" };

export const PROJECTS: Record<ProjectId, { name: string; short: string; color: string; initial: string }> = {
  orchard: { name: "The Orchard", short: "The Orchard", color: "var(--v3-project-3)", initial: "O" },
  mara: { name: "Mara & Finn", short: "Mara & Finn", color: "var(--v3-project-8)", initial: "M" },
  kite: { name: "Kite Studio, bakery rebrand", short: "Kite Studio", color: "var(--v3-project-5)", initial: "K" },
  hydro: { name: "Year 3 hydrology report", short: "Hydrology report", color: "var(--v3-project-2)", initial: "H" },
  home: { name: "Just me", short: "Just me", color: "var(--v3-project-1)", initial: "J" },
};
export const PROJECT_ORDER: ProjectId[] = ["orchard", "mara", "kite", "hydro", "home"];

export const PEOPLE: Record<PersonId, { name: string; initials: string; color: string }> = {
  dev: { name: "Dev", initials: "DV", color: "var(--v3-project-4)" },
  mara: { name: "Mara", initials: "MA", color: "var(--v3-project-8)" },
  ciaran: { name: "Ciarán", initials: "CÓ", color: "var(--v3-project-2)" },
  aoife: { name: "Aoife", initials: "AO", color: "var(--v3-project-6)" },
  niamh: { name: "Niamh", initials: "ND", color: "var(--v3-project-1)" },
};

export const SEGMENTS: { id: Segment; name: string; hint: string }[] = [
  { id: "morning", name: "Morning", hint: "Until 12" },
  { id: "afternoon", name: "Afternoon", hint: "12 to 5" },
  { id: "evening", name: "Evening", hint: "After 5" },
];

export const MOMENTS: { id: Moment; name: string; clock: string; greeting: string }[] = [
  { id: "morning", name: "Morning", clock: "8:10 am", greeting: "Good morning, Orla." },
  { id: "midday", name: "Midday", clock: "11:20 am", greeting: "Good morning, Orla." },
  { id: "evening", name: "Evening", clock: "6:40 pm", greeting: "Good evening, Orla." },
];

export const TODAY_LABEL = "Friday 25 September";

/* ── Today's plan ─────────────────────────────────────────────────── */

const TODAY: Task[] = [
  { id: "t-olives", title: "Order tonic and the good olives", project: "orchard", est: 20, horizon: "today", seg: "morning", late: "Due yesterday", carried: true },
  { id: "t-florist", title: "Call the florist about peonies", project: "orchard", est: 15, horizon: "today", seg: "morning", carried: true },
  { id: "t-proofs", title: "Review menu board proofs", project: "kite", est: 30, horizon: "today", seg: "morning", with: "aoife" },
  { id: "t-runsheet", title: "Build the Saturday run-sheet", project: "orchard", est: 90, horizon: "today", seg: "afternoon" },
  { id: "t-terrace", title: "Walk the terrace with Mara", project: "mara", est: 45, horizon: "today", seg: "afternoon", with: "mara", at: "4:00 pm" },
  { id: "t-method", title: "Write the method section", project: "hydro", est: 120, horizon: "today", seg: "evening" },
  { id: "t-ciaran", title: "Send data to Ciarán", project: "hydro", est: null, horizon: "today", seg: "evening", with: "ciaran", carried: true },
];

const INBOX: Task[] = [
  { id: "i-licence", title: "Ask Dev about the late bar licence", project: "orchard", est: null, horizon: "inbox", with: "dev", from: "From Notes, yesterday" },
  { id: "i-doyle", title: "Quote for the Doyle 50th", project: "orchard", est: 45, horizon: "inbox", with: "niamh", from: "From a message from Niamh Doyle" },
  { id: "i-marquee", title: "Check the marquee company can do 12 October", project: "mara", est: 15, horizon: "inbox", from: "From a message from Mara" },
  { id: "i-icon", title: "Second look at the loaf icon", project: "kite", est: 20, horizon: "inbox", with: "aoife", from: "From a message from Aoife" },
  { id: "i-rain", title: "Find the 2019 rainfall dataset", project: "hydro", est: 30, horizon: "inbox", from: "From Notes, Wednesday" },
  { id: "i-nct", title: "Book the NCT for the van", project: "home", est: 10, horizon: "inbox", from: "From Notes, this morning" },
];

const NEXT: Task[] = [
  { id: "n-staff", title: "Confirm Saturday staffing with Dev", project: "orchard", est: 30, horizon: "next", with: "dev", tomorrow: true },
  { id: "n-allergen", title: "Update the allergen sheet for the autumn menu", project: "orchard", est: 45, horizon: "next" },
  { id: "n-fridge", title: "Book the walk-in fridge service", project: "orchard", est: 15, horizon: "next" },
  { id: "n-news", title: "Send the October events newsletter", project: "orchard", est: 60, horizon: "next" },
  { id: "n-caterer", title: "Final numbers to the caterer", project: "mara", est: 20, horizon: "next", with: "mara", tomorrow: true },
  { id: "n-seating", title: "Seating plan, draft two", project: "mara", est: 90, horizon: "next" },
  { id: "n-band", title: "Confirm the ceilidh band's arrival time", project: "mara", est: 10, horizon: "next" },
  { id: "n-paper", title: "Pick the paper stock for the loyalty cards", project: "kite", est: 30, horizon: "next" },
  { id: "n-decal", title: "Write the window decal brief", project: "kite", est: 45, horizon: "next" },
  { id: "n-papers", title: "Read the two papers Ciarán shared", project: "hydro", est: 60, horizon: "next", with: "ciaran" },
  { id: "n-map", title: "Make the catchment map", project: "hydro", est: 90, horizon: "next" },
  { id: "n-insure", title: "Renew the car insurance", project: "home", est: 20, horizon: "next" },
];

const LATER_TITLES: [ProjectId, string, number | null][] = [
  ["orchard", "Plan the Christmas party packages", 120],
  ["orchard", "Get quotes for a new glass-washer", 30],
  ["orchard", "Refresh the wedding brochure photos", 90],
  ["orchard", "Set winter opening hours", 20],
  ["orchard", "Write replies for common reviews", 45],
  ["orchard", "Training day for the new till", 180],
  ["mara", "Order the welcome sign", 20],
  ["mara", "Plan the Sunday brunch for guests", 60],
  ["mara", "Thank-you cards list", null],
  ["kite", "Social templates for launch week", 90],
  ["kite", "Photograph the new menu boards", 60],
  ["kite", "Invoice for phase two", 15],
  ["kite", "Launch-day checklist", 30],
  ["hydro", "Draft the discussion section", 180],
  ["hydro", "Proofread with Ciarán", 60],
  ["hydro", "Format the references", 45],
  ["hydro", "Poster for the student showcase", 120],
  ["home", "Sort the tax receipts", 60],
  ["home", "Book a dentist check-up", 10],
];

const SOMEDAY_TITLES: [ProjectId, string][] = [
  ["orchard", "Start a supper club at The Orchard"],
  ["orchard", "Redo the venue floor plan in 3D"],
  ["orchard", "Photograph every table setting"],
  ["mara", "Write up a wedding questions page"],
  ["kite", "Case study once the bakery opens"],
  ["hydro", "Turn the report into a short talk"],
  ["home", "Learn the basics of wine pairing"],
  ["home", "Learn Irish on the commute"],
];

export const DONE_EARLIER: DoneEntry[] = [
  ["Thursday", "orchard", "Confirm the DJ for the Byrne party", 15],
  ["Thursday", "orchard", "Stock count for the bar", 60],
  ["Thursday", "mara", "Send Mara the menu tasting dates", 10],
  ["Thursday", "kite", "Sign off the logo lock-up", 30],
  ["Thursday", "hydro", "Clean the flow gauge data", 90],
  ["Thursday", "home", "Pay the electricity bill", 10],
  ["Thursday", "home", "Collect the dry cleaning", 15],
  ["Wednesday", "orchard", "Rota for next week", 45],
  ["Wednesday", "orchard", "Reply to the Kelly enquiry", 15],
  ["Wednesday", "mara", "Book the tasting table", 10],
  ["Wednesday", "kite", "Colour notes on the packaging", 30],
  ["Wednesday", "hydro", "Meet Ciarán in the library", 60],
  ["Tuesday", "orchard", "Deposit reminder to the Walsh party", 10],
  ["Tuesday", "orchard", "Fix the terrace heater booking", 20],
  ["Tuesday", "mara", "Shortlist two ceilidh bands", 40],
  ["Tuesday", "kite", "Mood board for the shop window", 60],
  ["Tuesday", "hydro", "Outline the report sections", 45],
  ["Tuesday", "home", "Return the hired projector", 20],
  ["Monday", "orchard", "Week plan with Dev", 30],
  ["Monday", "orchard", "Update the events calendar", 20],
  ["Monday", "mara", "Walk Finn through the budget", 45],
  ["Monday", "kite", "Kick-off notes to Aoife", 20],
  ["Monday", "hydro", "Fieldwork photos into the shared folder", 15],
].map(([day, project, title, est], i) => ({ id: `d-${i}`, day: day as string, project: project as ProjectId, title: title as string, est: est as number }));

function laterTasks(): Task[] {
  return [
    ...LATER_TITLES.map(([project, title, est], i) => ({ id: `l-${i}`, title, project, est, horizon: "later" as const })),
    ...SOMEDAY_TITLES.map(([project, title], i) => ({ id: `s-${i}`, title, project, est: null, horizon: "someday" as const })),
  ];
}

/** Build the list as it would look at a given moment of the day. */
export function tasksFor(moment: Moment): Task[] {
  const later = laterTasks();
  if (moment === "morning") {
    // Nothing planned yet. Yesterday's leftovers wait to be decided; the
    // rest of today's eventual plan is still sitting in Next.
    const today = TODAY.map((t): Task => (t.carried ? { ...t, horizon: "leftover", seg: undefined } : { ...t, horizon: "next", seg: undefined }));
    return [...today, ...INBOX, ...NEXT, ...later];
  }
  if (moment === "evening") {
    const doneIds = new Set(["t-olives", "t-florist", "t-proofs", "t-terrace"]);
    return [...TODAY.map((t) => ({ ...t, done: doneIds.has(t.id) })), ...INBOX, ...NEXT, ...later];
  }
  return [...TODAY, ...INBOX, ...NEXT, ...later];
}

/* ── Formatting ───────────────────────────────────────────────────── */

export const estOf = (t: Pick<Task, "est">) => t.est ?? DEFAULT_EST;

export function fmt(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export const EST_CHOICES = [10, 15, 30, 45, 60, 90, 120, 180];
export const DAY_CHOICES = [240, 300, 360, 420, 480];

/** Parse "Call Dev 30m" or "Report 1h30" into a title and minutes. */
export function parseQuick(input: string): { title: string; est: number | null } {
  const re = /\s+(\d+(?:\.\d+)?)\s*(h|m|min|hr|hrs|hours?)?\s*(\d+)?\s*(m|min)?\s*$/i;
  const m = input.match(re);
  if (!m || (!m[2] && !m[4])) return { title: input.trim(), est: null };
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "m").toLowerCase();
  let est = unit.startsWith("h") ? n * 60 : n;
  if (m[3]) est += parseInt(m[3], 10);
  return { title: input.slice(0, m.index).trim(), est: Math.round(est) };
}
