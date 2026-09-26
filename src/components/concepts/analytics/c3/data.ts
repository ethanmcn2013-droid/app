/* Sample data for "Who needs a hand". Invented, front end only.
   Today is Wednesday 23 September 2026. The three weeks in view start on
   Mondays: 21 Sep, 28 Sep and 5 Oct. History covers the twelve full weeks
   before this one (29 Jun to 14 Sep). */

export const TODAY = "2026-09-23";
export const WEEK_STARTS = ["2026-09-21", "2026-09-28", "2026-10-05"] as const;
export const PERIOD_END = { week: "2026-09-27", three: "2026-10-11" } as const;
export const HISTORY_STARTS = [
  "2026-06-29", "2026-07-06", "2026-07-13", "2026-07-20", "2026-07-27", "2026-08-03",
  "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14",
];

export type ProjectId = "orchard" | "marafinn" | "riverside" | "brightwater";
export type Project = { id: ProjectId; name: string; hue: number; kind: string };

export const PROJECTS: Project[] = [
  { id: "orchard", name: "The Orchard", hue: 3, kind: "Events venue" },
  { id: "marafinn", name: "Mara & Finn", hue: 8, kind: "Wedding, 17 Oct" },
  { id: "riverside", name: "Riverside", hue: 2, kind: "Geography group project" },
  { id: "brightwater", name: "Brightwater", hue: 5, kind: "Studio client work" },
];

export const projectById = (id: ProjectId) => PROJECTS.find((p) => p.id === id)!;

export type Pronoun = "he" | "she" | "they";

export type Person = {
  id: string;
  name: string;
  role: string;
  pronoun: Pronoun;
  projects: ProjectId[];
  /** Finished per week, oldest first, twelve weeks. Empty for someone new. */
  history: number[];
  /** Of their last ten dated tasks, how many landed on or before the date. */
  onTime: number | null;
  waitingOn: { what: string; who: string; days: number }[];
  away?: { label: string; week: number };
  isYou?: boolean;
};

export type Task = {
  id: string;
  title: string;
  project: ProjectId;
  due: string;
  /** One slot per owner. A null slot has nobody. */
  owners: (string | null)[];
};

export type Scenario = {
  id: "team" | "solo" | "empty";
  people: Person[];
  tasks: Task[];
};

/* ── the team: Orla's venue and the Mara & Finn wedding ─────────────── */

const orla: Person = {
  id: "orla",
  name: "Orla",
  role: "Owner",
  pronoun: "she",
  projects: ["orchard", "marafinn"],
  history: [3, 4, 3, 3, 4, 3, 4, 3, 3, 4, 3, 3],
  onTime: 9,
  waitingOn: [{ what: "Quote for the marquee", who: "Canvas & Co", days: 4 }],
  isYou: true,
};
const cian: Person = {
  id: "cian",
  name: "Cian",
  role: "Events lead",
  pronoun: "he",
  projects: ["orchard", "marafinn"],
  history: [2, 3, 2, 3, 2, 2, 3, 2, 2, 3, 2, 3],
  onTime: 7,
  waitingOn: [
    { what: "Final guest numbers", who: "the Kellys", days: 6 },
    { what: "Menu sign-off", who: "Orla", days: 2 },
  ],
};
const niamh: Person = {
  id: "niamh",
  name: "Niamh",
  role: "Front of house",
  pronoun: "she",
  projects: ["orchard"],
  history: [3, 2, 3, 3, 2, 3, 3, 2, 3, 2, 3, 3],
  onTime: 9,
  waitingOn: [{ what: "Seating numbers", who: "Cian", days: 3 }],
};
const aisling: Person = {
  id: "aisling",
  name: "Aisling",
  role: "Freelance florist",
  pronoun: "she",
  projects: ["orchard", "marafinn"],
  history: [1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1],
  onTime: 10,
  waitingOn: [{ what: "Colour palette", who: "Mara", days: 5 }],
};

const TEAM_TASKS: Task[] = [
  // Cian: 14
  { id: "t1", title: "Confirm final numbers with the Kellys", project: "marafinn", due: "2026-09-21", owners: ["cian"] },
  { id: "t2", title: "Chase the marquee deposit", project: "orchard", due: "2026-09-22", owners: ["cian"] },
  { id: "t3", title: "Run sheet for the Harvest supper", project: "orchard", due: "2026-09-24", owners: ["cian"] },
  { id: "t4", title: "Walkthrough with the florist", project: "marafinn", due: "2026-09-25", owners: ["cian", "orla"] },
  { id: "t5", title: "Book the late bar staff", project: "orchard", due: "2026-09-25", owners: ["cian"] },
  { id: "t6", title: "Seating plan to the printer", project: "marafinn", due: "2026-09-26", owners: ["cian"] },
  { id: "t7", title: "Order linen for 120", project: "orchard", due: "2026-09-29", owners: ["cian"] },
  { id: "t8", title: "Tasting menu for Mara & Finn", project: "marafinn", due: "2026-09-30", owners: ["cian"] },
  { id: "t9", title: "Parking plan with the council", project: "orchard", due: "2026-10-01", owners: ["cian"] },
  { id: "t10", title: "Rehearsal dinner booking", project: "marafinn", due: "2026-10-02", owners: ["cian"] },
  { id: "t11", title: "Order the festoon lights", project: "orchard", due: "2026-10-06", owners: ["cian"] },
  { id: "t12", title: "Supplier arrival times", project: "orchard", due: "2026-10-07", owners: ["cian"] },
  { id: "t13", title: "Proof the welcome signs", project: "marafinn", due: "2026-10-08", owners: ["cian"] },
  { id: "t14", title: "Clean-up crew rota", project: "orchard", due: "2026-10-09", owners: ["cian"] },
  // Orla: 7 including the shared walkthrough
  { id: "t20", title: "Sign off the supper menu", project: "orchard", due: "2026-09-24", owners: ["orla"] },
  { id: "t21", title: "Final invoice to Mara & Finn", project: "marafinn", due: "2026-09-28", owners: ["orla"] },
  { id: "t22", title: "Renew the venue insurance", project: "orchard", due: "2026-09-30", owners: ["orla"] },
  { id: "t23", title: "Meet the new chef", project: "orchard", due: "2026-10-02", owners: ["orla"] },
  { id: "t24", title: "Pay the wedding suppliers", project: "marafinn", due: "2026-10-05", owners: ["orla"] },
  { id: "t25", title: "Plan the autumn open day", project: "orchard", due: "2026-10-09", owners: ["orla"] },
  // Niamh: 5 including the shared set-up
  { id: "t30", title: "Staff briefing notes", project: "orchard", due: "2026-09-24", owners: ["niamh"] },
  { id: "t31", title: "Set up the long room", project: "orchard", due: "2026-09-26", owners: ["niamh", "aisling"] },
  { id: "t32", title: "Table plan for the supper", project: "orchard", due: "2026-09-29", owners: ["niamh"] },
  { id: "t33", title: "Fire safety walk-round", project: "orchard", due: "2026-10-01", owners: ["niamh"] },
  { id: "t34", title: "Guest list for the open day", project: "orchard", due: "2026-10-08", owners: ["niamh"] },
  // Aisling: 2 including the shared set-up
  { id: "t40", title: "Top-table flowers", project: "marafinn", due: "2026-10-08", owners: ["aisling"] },
  // Nobody has these: 6
  { id: "u1", title: "Update the menu on the website", project: "orchard", due: "2026-09-25", owners: [null] },
  { id: "u2", title: "Pick a wine delivery slot", project: "orchard", due: "2026-09-28", owners: [null] },
  { id: "u3", title: "Wet-weather plan", project: "orchard", due: "2026-09-30", owners: [null] },
  { id: "u4", title: "Photographer shot list", project: "marafinn", due: "2026-10-03", owners: [null] },
  { id: "u5", title: "Activities for the kids' table", project: "marafinn", due: "2026-10-07", owners: [null] },
  { id: "u6", title: "Thank-you cards for suppliers", project: "orchard", due: "2026-10-10", owners: [null] },
];

/* ── Riverside: a school geography project ─────────────────────────── */

const students: Person[] = [
  { id: "saoirse", name: "Saoirse", role: "Method and write-up", pronoun: "she", projects: ["riverside"], history: [1, 2, 2, 1, 2, 1, 2, 2, 1, 2, 2, 1], onTime: 9, waitingOn: [{ what: "Cleaned readings", who: "Dara", days: 3 }] },
  { id: "dara", name: "Dara", role: "Took the data analysis", pronoun: "he", projects: ["riverside"], history: [1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2], onTime: 8, waitingOn: [{ what: "Site 4 readings", who: "Kofi", days: 2 }] },
  { id: "ruairi", name: "Ruairí", role: "Joined last week", pronoun: "he", projects: ["riverside"], history: [], onTime: null, waitingOn: [] },
  { id: "emma", name: "Emma", role: "Photos and the map", pronoun: "she", projects: ["riverside"], history: [2, 1, 2, 2, 1, 2, 2, 1, 2, 1, 2, 2], onTime: 10, waitingOn: [] },
  { id: "kofi", name: "Kofi", role: "Interviews", pronoun: "he", projects: ["riverside"], history: [2, 2, 1, 2, 1, 2, 2, 1, 2, 2, 1, 2], onTime: 9, waitingOn: [{ what: "A reply", who: "the council ranger", days: 5 }] },
];

const RIVERSIDE_TASKS: Task[] = [
  { id: "r1", title: "Clean the survey spreadsheet", project: "riverside", due: "2026-09-22", owners: ["dara"] },
  { id: "r2", title: "Check units on the flow data", project: "riverside", due: "2026-09-24", owners: ["dara"] },
  { id: "r3", title: "Average readings per site", project: "riverside", due: "2026-09-25", owners: ["dara"] },
  { id: "r4", title: "Chart the water readings", project: "riverside", due: "2026-09-29", owners: ["dara"] },
  { id: "r5", title: "Compare with last year", project: "riverside", due: "2026-09-30", owners: ["dara"] },
  { id: "r6", title: "Spot the odd readings", project: "riverside", due: "2026-10-01", owners: ["dara"] },
  { id: "r7", title: "Table of results", project: "riverside", due: "2026-10-02", owners: ["dara"] },
  { id: "r8", title: "Draft the findings", project: "riverside", due: "2026-10-05", owners: ["dara", "saoirse"] },
  { id: "r9", title: "Graphs for the poster", project: "riverside", due: "2026-10-06", owners: ["dara"] },
  { id: "r10", title: "Check the maths with Ms Byrne", project: "riverside", due: "2026-10-07", owners: ["dara"] },
  { id: "r11", title: "Slides for the results", project: "riverside", due: "2026-10-08", owners: ["dara"] },
  { id: "r20", title: "Write up the method", project: "riverside", due: "2026-09-25", owners: ["saoirse"] },
  { id: "r21", title: "Bibliography", project: "riverside", due: "2026-10-09", owners: ["saoirse"] },
  { id: "r30", title: "Print the poster", project: "riverside", due: "2026-10-09", owners: ["ruairi"] },
  { id: "r40", title: "Photos for sites 1 to 4", project: "riverside", due: "2026-09-24", owners: ["emma"] },
  { id: "r41", title: "Make the site map", project: "riverside", due: "2026-09-30", owners: ["emma"] },
  { id: "r42", title: "Caption the photos", project: "riverside", due: "2026-10-02", owners: ["emma"] },
  { id: "r43", title: "Poster layout", project: "riverside", due: "2026-10-07", owners: ["emma"] },
  { id: "r50", title: "Interview the council ranger", project: "riverside", due: "2026-09-25", owners: ["kofi"] },
  { id: "r51", title: "Type up the interviews", project: "riverside", due: "2026-09-30", owners: ["kofi"] },
  { id: "r52", title: "Pick three good quotes", project: "riverside", due: "2026-10-02", owners: ["kofi"] },
  { id: "r53", title: "Rehearse the talk", project: "riverside", due: "2026-10-08", owners: ["kofi"] },
  { id: "ru1", title: "Book the library room", project: "riverside", due: "2026-10-05", owners: [null] },
];

/* ── Brightwater: a small studio ───────────────────────────────────── */

const agency: Person[] = [
  { id: "tadhg", name: "Tadhg", role: "Creative lead", pronoun: "he", projects: ["brightwater"], history: [3, 4, 3, 3, 4, 3, 3, 4, 3, 3, 4, 3], onTime: 8, waitingOn: [{ what: "Feedback on the moodboard", who: "Hollis", days: 3 }] },
  { id: "ciara", name: "Ciara", role: "Copywriter", pronoun: "she", projects: ["brightwater"], history: [3, 3, 3, 2, 3, 4, 3, 3, 3, 2, 3, 3], onTime: 9, waitingOn: [], away: { label: "Away 5–9 Oct", week: 2 } },
  { id: "jonah", name: "Jonah", role: "Designer", pronoun: "he", projects: ["brightwater"], history: [2, 2, 2, 1, 2, 2, 3, 2, 2, 2, 1, 2], onTime: 9, waitingOn: [{ what: "Final copy", who: "Ciara", days: 1 }] },
  { id: "priya", name: "Priya", role: "Accounts", pronoun: "she", projects: ["brightwater"], history: [3, 3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 3], onTime: 10, waitingOn: [] },
];

const BRIGHTWATER_TASKS: Task[] = [
  { id: "b1", title: "Hollis moodboard", project: "brightwater", due: "2026-09-24", owners: ["tadhg"] },
  { id: "b2", title: "Logo options for Hollis", project: "brightwater", due: "2026-09-29", owners: ["tadhg"] },
  { id: "b3", title: "Mulligan's menu refresh", project: "brightwater", due: "2026-09-30", owners: ["tadhg"] },
  { id: "b4", title: "Review Jonah's layouts", project: "brightwater", due: "2026-10-01", owners: ["tadhg"] },
  { id: "b5", title: "Pitch for the harbour festival", project: "brightwater", due: "2026-10-02", owners: ["tadhg", "priya"] },
  { id: "b6", title: "Hollis type pairing", project: "brightwater", due: "2026-10-05", owners: ["tadhg"] },
  { id: "b7", title: "Signage concepts", project: "brightwater", due: "2026-10-06", owners: ["tadhg"] },
  { id: "b8", title: "Photo shoot plan", project: "brightwater", due: "2026-10-07", owners: ["tadhg"] },
  { id: "b9", title: "Present to Hollis", project: "brightwater", due: "2026-10-09", owners: ["tadhg"] },
  { id: "b20", title: "Homepage words for Hollis", project: "brightwater", due: "2026-09-22", owners: ["ciara"] },
  { id: "b21", title: "October social posts", project: "brightwater", due: "2026-09-25", owners: ["ciara"] },
  { id: "b22", title: "Mulligan's menu wording", project: "brightwater", due: "2026-09-29", owners: ["ciara"] },
  { id: "b23", title: "Festival pitch words", project: "brightwater", due: "2026-10-01", owners: ["ciara"] },
  { id: "b24", title: "Newsletter for Tide Coffee", project: "brightwater", due: "2026-10-02", owners: ["ciara"] },
  { id: "b25", title: "About page rewrite", project: "brightwater", due: "2026-10-03", owners: ["ciara"] },
  { id: "b26", title: "Case study: Tide Coffee", project: "brightwater", due: "2026-10-09", owners: ["ciara"] },
  { id: "b30", title: "Hollis business cards", project: "brightwater", due: "2026-09-30", owners: ["jonah"] },
  { id: "b31", title: "Menu layout for Mulligan's", project: "brightwater", due: "2026-10-02", owners: ["jonah"] },
  { id: "b40", title: "Send September invoices", project: "brightwater", due: "2026-09-25", owners: ["priya"] },
  { id: "b41", title: "Check-in with Mulligan's", project: "brightwater", due: "2026-09-29", owners: ["priya"] },
  { id: "b42", title: "Quote for Tide Coffee", project: "brightwater", due: "2026-10-01", owners: ["priya"] },
  { id: "b43", title: "Contract for Hollis", project: "brightwater", due: "2026-10-06", owners: ["priya"] },
  { id: "b44", title: "Chase the late payment", project: "brightwater", due: "2026-10-07", owners: ["priya"] },
  { id: "b45", title: "Plan November work", project: "brightwater", due: "2026-10-09", owners: ["priya"] },
];

export const TEAM: Scenario = {
  id: "team",
  people: [orla, cian, niamh, aisling, ...students, ...agency],
  tasks: [...TEAM_TASKS, ...RIVERSIDE_TASKS, ...BRIGHTWATER_TASKS],
};

/* ── just you: a solo wedding planner ──────────────────────────────── */

export const SOLO_PERSON: Person = {
  id: "you",
  name: "You",
  role: "Planning on your own",
  pronoun: "they",
  projects: ["marafinn"],
  history: [4, 5, 3, 4, 4, 5, 4, 3, 4, 5, 4, 4],
  onTime: 8,
  waitingOn: [
    { what: "Final guest numbers", who: "the Kellys", days: 6 },
    { what: "Band's song list", who: "The Late Arrivals", days: 2 },
  ],
  isYou: true,
};

export const SOLO: Scenario = {
  id: "solo",
  people: [SOLO_PERSON],
  tasks: [
    { id: "s1", title: "Confirm final numbers with the Kellys", project: "marafinn", due: "2026-09-21", owners: ["you"] },
    { id: "s2", title: "Walkthrough with the florist", project: "marafinn", due: "2026-09-23", owners: ["you"] },
    { id: "s3", title: "Seating plan to the printer", project: "marafinn", due: "2026-09-24", owners: ["you"] },
    { id: "s4", title: "Tasting menu", project: "marafinn", due: "2026-09-24", owners: ["you"] },
    { id: "s5", title: "Rehearsal dinner booking", project: "marafinn", due: "2026-09-25", owners: ["you"] },
    { id: "s6", title: "Photographer shot list", project: "marafinn", due: "2026-09-26", owners: ["you"] },
    { id: "s7", title: "Welcome bags for guests", project: "marafinn", due: "2026-09-27", owners: ["you"] },
    { id: "s8", title: "Pay the wedding suppliers", project: "marafinn", due: "2026-09-30", owners: ["you"] },
    { id: "s9", title: "Order the festoon lights", project: "marafinn", due: "2026-10-01", owners: ["you"] },
    { id: "s10", title: "Proof the welcome signs", project: "marafinn", due: "2026-10-06", owners: ["you"] },
    { id: "s11", title: "Top-table flowers", project: "marafinn", due: "2026-10-08", owners: ["you"] },
  ],
};

/* ── nothing handed out yet: The Orchard team, owners still to pick ── */

export const EMPTY: Scenario = {
  id: "empty",
  people: [orla, cian, niamh, aisling],
  tasks: [
    { id: "e1", title: "Sign off the supper menu", project: "orchard", due: "2026-09-24", owners: ["orla"] },
    { id: "e2", title: "Walkthrough with the florist", project: "marafinn", due: "2026-09-25", owners: ["cian"] },
    ...TEAM_TASKS.filter((t) => t.id !== "t20" && t.id !== "t4" && !t.id.startsWith("u"))
      .slice(0, 16)
      .map((t) => ({ ...t, id: `e-${t.id}`, owners: [null] as (string | null)[] })),
  ],
};
