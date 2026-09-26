/*
 * Sample world for the Living project page concept: The Orchard, an event
 * venue with a Long Barn, a Walled Garden, a Cider House and a Press House.
 * Everything here is invented. "Today" is fixed so the page reads the same
 * for every reviewer.
 */

export const TODAY = "2026-09-25"; // a Friday

export type Status = "on-track" | "at-risk" | "blocked" | "on-hold";
export type Section = "summary" | "milestones" | "people" | "links" | "notes";
export type LinkKind = "doc" | "sheet" | "image" | "slides" | "design" | "link" | "folder";

export type Person = {
  id: string;
  name: string;
  org?: string;
  /** 1..8, picks an identity colour for the avatar. */
  hue: number;
  email?: string;
};

export type Task = {
  id: string;
  /** Written to read well mid-sentence: the summary uses it as is, lowercased. */
  title: string;
  done: boolean;
  due?: string;
  who: string;
  /** Someone has to act before this can move: a person id or "you". */
  waitingOn?: string;
};

export type Milestone = {
  id: string;
  title: string;
  date: string;
  done: boolean;
  review?: boolean;
  /** The event itself: drawn as the final station. */
  day?: boolean;
};

export type Role = { role: string; people: string[]; add?: string };

export type KeyLink = { id: string; title: string; kind: LinkKind; meta: string };

export type Activity = { id: string; who: string; text: string; when: string; section: Section };

export type Project = {
  id: string;
  name: string;
  purpose: string;
  emoji?: string;
  hue: number;
  kind: string;
  status: Status;
  date?: string;
  owner: string;
  place?: string;
  guests?: number;
  tasks: Task[];
  /** Done tasks that are not listed individually. */
  doneExtra?: number;
  milestones: Milestone[];
  roles: Role[];
  links: KeyLink[];
  notes: string[];
  activity: Activity[];
  wrapped?: { on: string; tasks: number; people: number; early: number; closing: string };
  /** Created in this session from the sentence form. */
  fresh?: boolean;
  /** When the page last changed, as the summary header says it. */
  edited?: string;
};

export const ME = "orla";

export const PEOPLE: Record<string, Person> = {
  orla: { id: "orla", name: "Orla", org: "The Orchard", hue: 1, email: "orla@theorchard.example" },
  tomas: { id: "tomas", name: "Tomás", org: "The Orchard", hue: 3, email: "tomas@theorchard.example" },
  dev: { id: "dev", name: "Dev", org: "The Orchard kitchen", hue: 5, email: "dev@theorchard.example" },
  mara: { id: "mara", name: "Mara", hue: 8, email: "mara@example.com" },
  finn: { id: "finn", name: "Finn", hue: 2, email: "finn@example.com" },
  niamh: { id: "niamh", name: "Niamh", org: "Wildflower & Co", hue: 4, email: "niamh@wildflower.example" },
  sam: { id: "sam", name: "Sam", org: "Marquee Hire", hue: 6, email: "sam@marqueehire.example" },
  aisling: { id: "aisling", name: "Aisling", org: "Brightwater", hue: 2, email: "aisling@brightwater.example" },
  ruth: { id: "ruth", name: "Ruth", org: "Vine & Co", hue: 7, email: "ruth@vineandco.example" },
  ciaran: { id: "ciaran", name: "Ciarán", hue: 3, email: "ciaran@example.com" },
  aoife: { id: "aoife", name: "Aoife", hue: 8, email: "aoife@example.com" },
  jonah: { id: "jonah", name: "Jonah", hue: 2, email: "jonah@example.com" },
  lena: { id: "lena", name: "Lena", org: "Lena Byrne Photography", hue: 1 },
  pat: { id: "pat", name: "Pat", org: "Keogh Painting", hue: 5 },
  molly: { id: "molly", name: "Molly", org: "Brightwater", hue: 4 },
  emer: { id: "emer", name: "Emer Doyle", hue: 7 },
  wei: { id: "wei", name: "Wei Chen", hue: 2 },
};

export function person(id: string): Person {
  return PEOPLE[id] ?? { id, name: id, hue: 1 };
}

export function initials(name: string): string {
  const parts = name
    .replace(/[^\p{L}\s&]/gu, "")
    .split(/\s+|&/)
    .filter((w) => w && !/^(and|for|the|of)$/i.test(w));
  if (parts.length === 0) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ── dates ─────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** Whole days from today to the date: positive is in the future. */
export function daysFrom(iso: string, from = TODAY): number {
  return Math.round((parse(iso).getTime() - parse(from).getTime()) / 86_400_000);
}

export function fmtShort(iso: string): string {
  const d = parse(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function fmtLong(iso: string): string {
  const d = parse(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtDate(iso: string): string {
  const d = parse(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function weekday(iso: string): string {
  return DAYS[parse(iso).getUTCDay()];
}

/** "on Tuesday", "tomorrow", "on 12 Oct": how a sentence says when. */
export function spokenWhen(iso: string): string {
  const n = daysFrom(iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n > 1 && n < 7) return `on ${weekday(iso)}`;
  return `on ${fmtShort(iso)}`;
}

/** The compact rail countdown: "8d", "today", "3w". */
export function countdown(iso: string): string {
  const n = daysFrom(iso);
  if (n === 0) return "today";
  if (n < 0) return `${-n}d ago`;
  if (n < 28) return `${n}d`;
  if (n < 70) return `${Math.round(n / 7)}w`;
  return `${Math.round(n / 30)}mo`;
}

export function upcomingSaturdays(count: number): string[] {
  const out: string[] = [];
  let d = TODAY;
  while (out.length < count) {
    d = addDays(d, 1);
    if (parse(d).getUTCDay() === 6 && daysFrom(d) > 20) out.push(d);
  }
  return out;
}

/* ── status vocabulary ─────────────────────────────────────────────── */

export const STATUS: Record<Status, { label: string; phrase: string; tone: Tone }> = {
  "on-track": { label: "On track", phrase: "on track", tone: "success" },
  "at-risk": { label: "At risk", phrase: "at risk", tone: "warning" },
  blocked: { label: "Blocked", phrase: "blocked", tone: "danger" },
  "on-hold": { label: "On hold", phrase: "on hold", tone: "neutral" },
};

export type Tone = "success" | "warning" | "danger" | "review" | "accent" | "neutral" | "hue" | "you";

export const KINDS: { kind: string; article: string; emoji: string; hue: number }[] = [
  { kind: "Wedding", article: "a wedding", emoji: "💐", hue: 8 },
  { kind: "Birthday", article: "a birthday", emoji: "🎂", hue: 2 },
  { kind: "Corporate day", article: "a corporate day", emoji: "🧭", hue: 3 },
  { kind: "Supper club", article: "a supper club", emoji: "🍂", hue: 5 },
  { kind: "Festival", article: "a festival", emoji: "🍏", hue: 4 },
  { kind: "Class", article: "a class", emoji: "📓", hue: 1 },
  { kind: "Launch", article: "a launch", emoji: "🚀", hue: 6 },
  { kind: "Maintenance", article: "some maintenance", emoji: "🔧", hue: 7 },
];

export const PLACES = [
  "The Orchard, Long Barn",
  "The Orchard, Walled Garden",
  "The Orchard, Cider House",
  "The Orchard, Press House",
  "Off site",
];

/** Suggested milestones by kind, as offsets in days before the date. */
export const TEMPLATES: Record<string, { title: string; before: number; day?: boolean }[]> = {
  Wedding: [
    { title: "Venue walk-through", before: 120 },
    { title: "Menu tasting", before: 60 },
    { title: "Flowers confirmed", before: 28 },
    { title: "Seating plan", before: 7 },
    { title: "Final numbers", before: 5 },
    { title: "Rehearsal", before: 1 },
    { title: "The day", before: 0, day: true },
  ],
  Birthday: [
    { title: "Guest list", before: 42 },
    { title: "Menu and cake", before: 21 },
    { title: "Music booked", before: 14 },
    { title: "Final numbers", before: 5 },
    { title: "The party", before: 0, day: true },
  ],
  "Corporate day": [
    { title: "Contract signed", before: 60 },
    { title: "Agenda agreed", before: 14 },
    { title: "Dietary list", before: 7 },
    { title: "AV check", before: 1 },
    { title: "The day", before: 0, day: true },
  ],
  "Supper club": [
    { title: "Menu written", before: 30 },
    { title: "Tickets live", before: 21 },
    { title: "Wine pairing", before: 10 },
    { title: "Supper", before: 0, day: true },
  ],
  Festival: [
    { title: "Stallholders confirmed", before: 45 },
    { title: "Permits", before: 30 },
    { title: "Programme printed", before: 10 },
    { title: "Opening day", before: 0, day: true },
  ],
};

export const ROLE_TEMPLATES: Record<string, string[]> = {
  Wedding: ["Couple", "Kitchen", "Flowers", "Photography", "Music"],
  Birthday: ["Host", "Kitchen", "Music"],
  "Corporate day": ["Client", "Kitchen", "AV"],
  "Supper club": ["Kitchen", "Wine", "Front of house"],
  Festival: ["Stallholders", "Safety", "Music"],
};

/* ── projects ──────────────────────────────────────────────────────── */

const t = (id: string, title: string, who: string, due?: string, extra: Partial<Task> = {}): Task => ({
  id,
  title,
  who,
  due,
  done: false,
  ...extra,
});

export const SEED: Project[] = [
  {
    id: "mara-finn",
    name: "Mara & Finn’s wedding",
    purpose: "A long lunch in the Long Barn that turns into a party in the orchard.",
    emoji: "💐",
    hue: 8,
    kind: "Wedding",
    status: "on-track",
    date: "2026-10-03",
    owner: "orla",
    place: "The Orchard, Long Barn",
    guests: 120,
    tasks: [
      t("mf1", "Book the Long Barn", "orla", "2026-01-12", { done: true }),
      t("mf2", "Menu tasting with Dev", "dev", "2026-08-02", { done: true }),
      t("mf3", "Confirm flowers with Niamh", "niamh", "2026-09-05", { done: true }),
      t("mf4", "Second deposit from the couple", "mara", "2026-09-01", { done: true }),
      t("mf5", "Send the run-sheet draft", "tomas", "2026-09-18", { done: true }),
      t("mf6", "Tonic and olive order", "sam", "2026-09-14"),
      t("mf7", "Seating plan", "tomas", "2026-09-29", { waitingOn: "orla" }),
      t("mf8", "Final numbers", "mara", "2026-09-29"),
      t("mf9", "Gluten-free cake order", "dev", "2026-09-28"),
      t("mf10", "String trio arrival time", "orla", "2026-09-30"),
      t("mf11", "Marquee lighting check", "sam", "2026-10-01"),
      t("mf12", "Print place cards", "tomas", "2026-10-01"),
      t("mf13", "Rehearsal walk-through", "tomas", "2026-10-02"),
    ],
    milestones: [
      { id: "m1", title: "Venue booked", date: "2026-01-12", done: true },
      { id: "m2", title: "Menu tasting", date: "2026-08-02", done: true },
      { id: "m3", title: "Flowers confirmed", date: "2026-09-05", done: true },
      { id: "m4", title: "Seating plan", date: "2026-09-29", done: false, review: true },
      { id: "m5", title: "Final numbers", date: "2026-09-29", done: false },
      { id: "m6", title: "Rehearsal", date: "2026-10-02", done: false },
      { id: "m7", title: "The day", date: "2026-10-03", done: false, day: true },
    ],
    roles: [
      { role: "Couple", people: ["mara", "finn"] },
      { role: "Venue", people: ["orla", "tomas"] },
      { role: "Kitchen", people: ["dev"] },
      { role: "Flowers", people: ["niamh"] },
      { role: "Marquee", people: ["sam"] },
      { role: "Photography", people: [], add: "Add a photographer" },
    ],
    links: [
      { id: "l1", title: "Run-sheet", kind: "doc", meta: "Tomás · 2 hours ago" },
      { id: "l2", title: "Floor plan", kind: "design", meta: "Tomás · 3 hours ago" },
      { id: "l3", title: "Guest list", kind: "sheet", meta: "Mara · yesterday" },
      { id: "l4", title: "Menu", kind: "slides", meta: "Dev · 2 Aug" },
      { id: "l5", title: "Contracts", kind: "folder", meta: "4 files" },
    ],
    notes: [
      "Mara and Finn want the day to feel like a long lunch that turns into a party. No speeches during the meal: they happen with coffee, around half six.",
      "The cake must be fully gluten-free, not just one tier. Finn’s sister is coeliac and she is cutting it with them. Dev has the supplier; keep it well away from the bread station.",
      "A string trio plays in the orchard from 4pm while photos happen, then moves inside for the first dance at 8. If it rains they set up under the apple store roof.",
      "Guest count is 120, including six children and two high chairs. Mara’s grandmother uses a wheelchair: seat her near the side door, not beside the dance floor.",
    ],
    activity: [
      { id: "a1", who: "sam", text: "said the olives are on the Thursday van", when: "40 min", section: "summary" },
      { id: "a2", who: "mara", text: "asked about the rain plan in Messages", when: "2 h", section: "summary" },
      { id: "a3", who: "tomas", text: "sent the seating plan for review", when: "1 h", section: "milestones" },
      { id: "a4", who: "niamh", text: "marked flowers confirmed", when: "5 Sep", section: "milestones" },
      { id: "a5", who: "niamh", text: "joined as Flowers", when: "Tue", section: "people" },
      { id: "a6", who: "tomas", text: "moved the bar on the floor plan", when: "3 h", section: "links" },
      { id: "a7", who: "orla", text: "added the note about the grandmother’s seat", when: "yesterday", section: "notes" },
    ],
  },
  {
    id: "brightwater",
    name: "Brightwater team day",
    purpose: "Forty people from Brightwater, a morning of workshops and a long table lunch.",
    emoji: "🧭",
    hue: 3,
    kind: "Corporate day",
    status: "on-track",
    date: "2026-10-06",
    owner: "tomas",
    place: "The Orchard, Cider House",
    guests: 40,
    doneExtra: 9,
    tasks: [
      t("bw1", "Coach times", "tomas", "2026-09-29", { waitingOn: "aisling" }),
      t("bw2", "Dietary list", "aisling", "2026-10-01"),
      t("bw3", "Print the agenda", "tomas", "2026-10-04"),
      t("bw4", "Projector and mics check", "tomas", "2026-10-05"),
    ],
    milestones: [
      { id: "b1", title: "Contract signed", date: "2026-07-03", done: true },
      { id: "b2", title: "Agenda agreed", date: "2026-09-22", done: true },
      { id: "b3", title: "Dietary list", date: "2026-10-01", done: false },
      { id: "b4", title: "The day", date: "2026-10-06", done: false, day: true },
    ],
    roles: [
      { role: "Client", people: ["aisling", "molly"] },
      { role: "Venue", people: ["tomas"] },
      { role: "Kitchen", people: ["dev"] },
    ],
    links: [
      { id: "bl1", title: "Agenda", kind: "doc", meta: "Aisling · Tue" },
      { id: "bl2", title: "Headcount", kind: "sheet", meta: "Tomás · Wed" },
    ],
    notes: ["They want the orchard walk after lunch, weather allowing. Two people are vegan; one has a nut allergy."],
    activity: [
      { id: "ba1", who: "aisling", text: "agreed the final agenda", when: "Tue", section: "milestones" },
      { id: "ba2", who: "tomas", text: "asked Aisling for coach times", when: "Wed", section: "summary" },
      { id: "ba3", who: "molly", text: "joined as Client", when: "Mon", section: "people" },
    ],
  },
  {
    id: "harvest",
    name: "Harvest supper club",
    purpose: "Sixty seats in the Walled Garden, five courses from what the orchard grew this year.",
    emoji: "🍂",
    hue: 5,
    kind: "Supper club",
    status: "at-risk",
    date: "2026-10-10",
    owner: "dev",
    place: "The Orchard, Walled Garden",
    guests: 60,
    doneExtra: 4,
    tasks: [
      t("hv1", "Menu sign-off", "dev", "2026-09-23", { waitingOn: "orla" }),
      t("hv2", "Wine pairing notes", "ruth", "2026-09-20"),
      t("hv3", "Put tickets live", "orla", "2026-09-30"),
      t("hv4", "Book patio heaters", "tomas", "2026-10-08"),
    ],
    milestones: [
      { id: "h1", title: "Menu written", date: "2026-09-10", done: true },
      { id: "h2", title: "Tickets live", date: "2026-09-30", done: false },
      { id: "h3", title: "Wine pairing", date: "2026-10-01", done: false },
      { id: "h4", title: "Supper", date: "2026-10-10", done: false, day: true },
    ],
    roles: [
      { role: "Kitchen", people: ["dev"] },
      { role: "Wine", people: ["ruth"] },
      { role: "Front of house", people: [], add: "Add front of house" },
    ],
    links: [{ id: "hl1", title: "Menu draft", kind: "doc", meta: "Dev · 3 days ago" }],
    notes: ["Tickets can’t go live until the menu is signed off. If Ruth can’t pair by Wednesday, fall back to the house cider flight."],
    activity: [
      { id: "ha1", who: "dev", text: "sent the menu for sign-off", when: "Tue", section: "summary" },
      { id: "ha2", who: "ruth", text: "said the pairing notes slip to next week", when: "Mon", section: "summary" },
      { id: "ha3", who: "dev", text: "marked the menu written", when: "10 Sep", section: "milestones" },
    ],
  },
  {
    id: "keane",
    name: "Ciarán Keane’s 40th",
    purpose: "Eighty friends, a ceilí band and a pig on the spit.",
    emoji: "🎂",
    hue: 2,
    kind: "Birthday",
    status: "on-track",
    date: "2026-10-17",
    owner: "orla",
    place: "The Orchard, Long Barn",
    guests: 80,
    doneExtra: 3,
    tasks: [
      t("ke1", "Band deposit", "ciaran", "2026-10-01"),
      t("ke2", "Cake tasting", "dev", "2026-10-09"),
      t("ke3", "Set list to the band", "ciaran", "2026-10-10"),
    ],
    milestones: [
      { id: "k1", title: "Guest list", date: "2026-09-05", done: true },
      { id: "k2", title: "Music booked", date: "2026-10-01", done: false },
      { id: "k3", title: "Final numbers", date: "2026-10-12", done: false },
      { id: "k4", title: "The party", date: "2026-10-17", done: false, day: true },
    ],
    roles: [
      { role: "Host", people: ["ciaran"] },
      { role: "Venue", people: ["orla"] },
      { role: "Kitchen", people: ["dev"] },
    ],
    links: [{ id: "kl1", title: "Guest list", kind: "sheet", meta: "Ciarán · last week" }],
    notes: ["Surprise element: his brother flies in on the Friday. Do not mention it in any email to Ciarán."],
    activity: [
      { id: "ka1", who: "ciaran", text: "shared the guest list", when: "5 Sep", section: "links" },
      { id: "ka2", who: "orla", text: "added the note about the surprise", when: "Mon", section: "notes" },
      { id: "ka3", who: "dev", text: "suggested a cake tasting date", when: "Wed", section: "summary" },
    ],
  },
  {
    id: "cider",
    name: "Cider pressing weekend",
    purpose: "Two open days of pressing, tastings and stalls. Our biggest public weekend.",
    emoji: "🍏",
    hue: 4,
    kind: "Festival",
    status: "on-track",
    date: "2026-11-07",
    owner: "tomas",
    place: "The Orchard, Press House",
    guests: 300,
    doneExtra: 2,
    tasks: [
      t("cp1", "Confirm stallholders", "tomas", "2026-10-09"),
      t("cp2", "Event permit", "orla", "2026-10-08"),
      t("cp3", "Programme design", "orla", "2026-10-20"),
      t("cp4", "Parking plan", "tomas", "2026-10-25"),
      t("cp5", "Tasting glasses", "dev", "2026-10-30"),
      t("cp6", "First aid cover", "tomas", "2026-10-30"),
    ],
    milestones: [
      { id: "c1", title: "Stallholders confirmed", date: "2026-10-09", done: false },
      { id: "c2", title: "Permits", date: "2026-10-08", done: false },
      { id: "c3", title: "Programme printed", date: "2026-10-28", done: false },
      { id: "c4", title: "Opening day", date: "2026-11-07", done: false, day: true },
    ],
    roles: [
      { role: "Organisers", people: ["tomas", "orla"] },
      { role: "Kitchen", people: ["dev"] },
      { role: "Safety", people: [], add: "Add first aid cover" },
    ],
    links: [{ id: "cl1", title: "Stall map", kind: "image", meta: "Tomás · last week" }],
    notes: ["Last year the car park filled by 11. Open the lower field from the start this time."],
    activity: [
      { id: "ca1", who: "tomas", text: "drew the stall map", when: "Thu", section: "links" },
      { id: "ca2", who: "orla", text: "applied for the event permit", when: "Mon", section: "summary" },
      { id: "ca3", who: "tomas", text: "added the parking note", when: "Mon", section: "notes" },
    ],
  },
  {
    id: "aoife-jonah",
    name: "Aoife & Jonah’s wedding",
    purpose: "A winter wedding with candles everywhere and mulled cider on arrival.",
    emoji: "🕯️",
    hue: 1,
    kind: "Wedding",
    status: "on-track",
    date: "2026-12-12",
    owner: "orla",
    place: "The Orchard, Long Barn",
    guests: 90,
    doneExtra: 2,
    tasks: [
      t("aj1", "Menu tasting", "dev", "2026-10-14"),
      t("aj2", "Candle plan and fire safety", "tomas", "2026-11-02"),
      t("aj3", "Florist shortlist", "aoife", "2026-10-20"),
      t("aj4", "Guest list", "jonah", "2026-11-01"),
      t("aj5", "Seating plan", "tomas", "2026-12-05"),
    ],
    milestones: [
      { id: "j1", title: "Venue booked", date: "2026-05-02", done: true },
      { id: "j2", title: "Menu tasting", date: "2026-10-14", done: false },
      { id: "j3", title: "Flowers confirmed", date: "2026-11-14", done: false },
      { id: "j4", title: "The day", date: "2026-12-12", done: false, day: true },
    ],
    roles: [
      { role: "Couple", people: ["aoife", "jonah"] },
      { role: "Venue", people: ["orla"] },
      { role: "Flowers", people: [], add: "Add a florist" },
    ],
    links: [{ id: "al1", title: "Mood board", kind: "image", meta: "Aoife · Aug" }],
    notes: ["They love the barn in candlelight. Check how many naked flames the insurance allows."],
    activity: [
      { id: "aa1", who: "aoife", text: "shared a mood board", when: "Aug", section: "links" },
      { id: "aa2", who: "orla", text: "booked the menu tasting", when: "Wed", section: "milestones" },
      { id: "aa3", who: "jonah", text: "joined as Couple", when: "May", section: "people" },
    ],
  },
  {
    id: "photos",
    name: "Website photo refresh",
    purpose: "New photos of the Long Barn and orchard for the website before the winter enquiries.",
    emoji: "📷",
    hue: 6,
    kind: "Marketing",
    status: "on-track",
    owner: "orla",
    place: "The Orchard",
    doneExtra: 1,
    tasks: [
      t("ph1", "Shot list", "orla"),
      t("ph2", "Pick a photographer", "orla"),
      t("ph3", "Choose a clear morning", "orla"),
    ],
    milestones: [],
    roles: [
      { role: "Photography", people: [], add: "Add a photographer" },
      { role: "Styling", people: [], add: "Add a stylist" },
      { role: "Web", people: [], add: "Add who updates the site" },
    ],
    links: [],
    notes: ["Autumn light in the orchard would be ideal. Avoid weekends with events on."],
    activity: [{ id: "pa1", who: "orla", text: "started the shot list", when: "last week", section: "summary" }],
  },
  {
    id: "repaint",
    name: "Long Barn repaint",
    purpose: "Repaint the barn doors and window frames before the winter weddings.",
    emoji: "🔧",
    hue: 7,
    kind: "Maintenance",
    status: "blocked",
    owner: "tomas",
    place: "The Orchard, Long Barn",
    doneExtra: 1,
    tasks: [
      t("rp1", "Paint quote", "pat", "2026-09-19"),
      t("rp2", "Colour choice", "tomas", undefined, { waitingOn: "pat" }),
    ],
    milestones: [],
    roles: [
      { role: "Painter", people: ["pat"] },
      { role: "Venue", people: ["tomas"] },
    ],
    links: [{ id: "rl1", title: "Colour swatches", kind: "image", meta: "Tomás · Aug" }],
    notes: ["Can only paint between events. The barn is free from 4 to 9 October."],
    activity: [
      { id: "ra1", who: "tomas", text: "chased Pat for the quote", when: "Mon", section: "summary" },
      { id: "ra2", who: "tomas", text: "added colour swatches", when: "Aug", section: "links" },
    ],
  },
  {
    id: "menu-2027",
    name: "Menu for 2027",
    purpose: "Next year’s wedding and event menus.",
    hue: 3,
    kind: "Menu",
    status: "on-track",
    owner: "dev",
    tasks: [],
    milestones: [],
    roles: [{ role: "Kitchen", people: ["dev"] }],
    links: [],
    notes: [],
    activity: [{ id: "me1", who: "dev", text: "created this project", when: "just now", section: "summary" }],
    fresh: true,
  },
  {
    id: "doyle-chen",
    name: "Doyle & Chen’s wedding",
    purpose: "A September garden wedding for 140 with a ceilí after dinner.",
    emoji: "🥂",
    hue: 2,
    kind: "Wedding",
    status: "on-track",
    date: "2026-09-12",
    owner: "orla",
    place: "The Orchard, Walled Garden",
    guests: 140,
    doneExtra: 41,
    tasks: [],
    milestones: [
      { id: "d1", title: "Venue booked", date: "2025-11-20", done: true },
      { id: "d2", title: "Menu tasting", date: "2026-06-14", done: true },
      { id: "d3", title: "Final numbers", date: "2026-09-05", done: true },
      { id: "d4", title: "The day", date: "2026-09-12", done: true, day: true },
    ],
    roles: [
      { role: "Couple", people: ["emer", "wei"] },
      { role: "Venue", people: ["orla", "tomas"] },
      { role: "Kitchen", people: ["dev"] },
      { role: "Flowers", people: ["niamh"] },
    ],
    links: [
      { id: "dl1", title: "Thank-you pack", kind: "doc", meta: "Orla · 15 Sep" },
      { id: "dl2", title: "Photos", kind: "folder", meta: "212 files" },
    ],
    notes: ["Everything ran to time. The ceilí band would come back; the late bar ran short of ice at 11."],
    activity: [
      { id: "da1", who: "orla", text: "wrapped the project", when: "12 Sep", section: "summary" },
      { id: "da2", who: "orla", text: "sent the thank-you pack", when: "15 Sep", section: "links" },
    ],
    wrapped: { on: "2026-09-12", tasks: 41, people: 6, early: 2, closing: "The thank-you pack went to the couple on 15 Sep." },
  },
  {
    id: "open-day",
    name: "Summer open day",
    purpose: "An open day for couples looking at 2027 dates.",
    emoji: "☀️",
    hue: 5,
    kind: "Open day",
    status: "on-track",
    date: "2026-08-16",
    owner: "orla",
    place: "The Orchard",
    guests: 64,
    doneExtra: 18,
    tasks: [],
    milestones: [
      { id: "o1", title: "Suppliers invited", date: "2026-07-10", done: true },
      { id: "o2", title: "Open day", date: "2026-08-16", done: true, day: true },
    ],
    roles: [{ role: "Venue", people: ["orla", "tomas"] }],
    links: [{ id: "ol1", title: "Enquiries", kind: "sheet", meta: "Orla · Aug" }],
    notes: ["Eleven couples booked a viewing afterwards."],
    activity: [{ id: "oa1", who: "orla", text: "wrapped the project", when: "16 Aug", section: "summary" }],
    wrapped: { on: "2026-08-16", tasks: 18, people: 4, early: 0, closing: "Eleven couples booked a viewing afterwards." },
  },
];
