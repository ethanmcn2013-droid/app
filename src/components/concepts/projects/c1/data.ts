/*
 * Cover shelf: invented sample data for the concept. Today is Friday
 * 25 September 2026 and the viewer is Orla, events lead at The Orchard.
 */

export type Kind = "wedding" | "event" | "season" | "works" | "school" | "agency";
export type Status = "on-track" | "at-risk" | "off-track" | "not-started" | "wrapped";
export type FactTone = "you" | "overdue" | "risk" | "calm" | "done";

export type Person = {
  id: string;
  name: string;
  initials: string;
  hue: number; // 1..8, maps to --v3-project-n
};

export type Member = { person: string; role: string; org?: string; owner?: boolean };

export type Task = {
  id: string;
  title: string;
  who: string; // person id
  due: string; // ISO date
  state: "open" | "review" | "done";
  /** The state before it was ticked, so unticking restores it. */
  was?: "open" | "review";
};

export type Milestone = { label: string; date: string };

export type Activity = { day: string; time: string; who: string; did: string; what: string };

export type LinkKind = "doc" | "plan" | "folder" | "sheet" | "deck" | "image";
export type KeyLink = { label: string; kind: LinkKind; meta: string };

export type Project = {
  id: string;
  name: string;
  purpose: string;
  kind: Kind;
  hue: number; // 1..8
  /** Seeds the generated cover. Defaults to the id; a new project keeps the seed its draft cover was drawn with. */
  artSeed?: string;
  status: Status;
  statusBy: string;
  statusWhen: string;
  start: string | null; // ISO date: the target date, or a range start
  end?: string; // ISO date: range end
  done: number;
  total: number;
  overdue: number;
  review: number;
  fact: { text: string; tone: FactTone };
  members: Member[];
  openedMinutesAgo: number;
  wrapped?: { on: string; stat: string };
  needsYou?: { title: string; body: string; action: string };
  week: Task[];
  milestones: Milestone[];
  current: number; // index of the milestone in progress
  activity: Activity[];
  links: KeyLink[];
};

export const TODAY = "2026-09-25";
export const ME = "orla";

export const PEOPLE: Record<string, Person> = {
  orla: { id: "orla", name: "Orla Byrne", initials: "OB", hue: 1 },
  mara: { id: "mara", name: "Mara Quinn", initials: "MQ", hue: 8 },
  finn: { id: "finn", name: "Finn Doherty", initials: "FD", hue: 3 },
  dev: { id: "dev", name: "Dev Patel", initials: "DP", hue: 5 },
  niamh: { id: "niamh", name: "Niamh Walsh", initials: "NW", hue: 4 },
  sam: { id: "sam", name: "Sam Rourke", initials: "SR", hue: 2 },
  cian: { id: "cian", name: "Cian Kelly", initials: "CK", hue: 6 },
  aoife: { id: "aoife", name: "Aoife Brennan", initials: "AB", hue: 7 },
  tom: { id: "tom", name: "Tom Hegarty", initials: "TH", hue: 2 },
  lena: { id: "lena", name: "Lena Kavanagh", initials: "LK", hue: 6 },
  ada: { id: "ada", name: "Ada Lynch", initials: "AL", hue: 1 },
  theo: { id: "theo", name: "Theo Marsh", initials: "TM", hue: 3 },
  ruth: { id: "ruth", name: "Ruth Nolan", initials: "RN", hue: 8 },
  jo: { id: "jo", name: "Jo Farrell", initials: "JF", hue: 4 },
  priya: { id: "priya", name: "Priya Shah", initials: "PS", hue: 7 },
  mark: { id: "mark", name: "Mark Doyle", initials: "MD", hue: 5 },
};

export const PROJECTS: Project[] = [
  {
    id: "mara-finn",
    name: "Mara & Finn's wedding",
    purpose: "120 guests in the long barn and the orchard marquee.",
    kind: "wedding",
    hue: 8,
    status: "on-track",
    statusBy: "Orla",
    statusWhen: "Tuesday",
    start: "2026-10-03",
    done: 5,
    total: 13,
    overdue: 1,
    review: 1,
    fact: { text: "Seating plan waiting on you", tone: "you" },
    openedMinutesAgo: 42,
    members: [
      { person: "orla", role: "Owner", owner: true },
      { person: "mara", role: "Couple" },
      { person: "finn", role: "Couple" },
      { person: "dev", role: "Head chef" },
      { person: "niamh", role: "Florist", org: "Wildflower & Co" },
      { person: "sam", role: "Hire company", org: "Marquee Hire" },
    ],
    needsYou: {
      title: "The seating plan is waiting on you",
      body: "Mara asked if Aunt Clare can sit near the door. Two tables still read 11 seats.",
      action: "Review seating plan",
    },
    week: [
      { id: "mf1", title: "Order tonic and the good olives", who: "dev", due: "2026-09-23", state: "open" },
      { id: "mf2", title: "Approve the seating plan", who: "orla", due: "2026-09-26", state: "review" },
      { id: "mf3", title: "Confirm final numbers with Mara and Finn", who: "orla", due: "2026-09-28", state: "open" },
      { id: "mf4", title: "Sign off the table flowers", who: "niamh", due: "2026-09-29", state: "open" },
      { id: "mf5", title: "Walk the marquee lighting with Sam", who: "sam", due: "2026-10-01", state: "open" },
    ],
    milestones: [
      { label: "Venue booked", date: "2026-03-14" },
      { label: "Menu tasting", date: "2026-08-29" },
      { label: "Seating plan", date: "2026-09-26" },
      { label: "Final numbers", date: "2026-09-28" },
      { label: "The day", date: "2026-10-03" },
    ],
    current: 2,
    activity: [
      { day: "Today", time: "10:42", who: "niamh", did: "uploaded", what: "6 bouquet mock-ups" },
      { day: "Today", time: "09:15", who: "mara", did: "commented on", what: "Seating plan" },
      { day: "Yesterday", time: "16:30", who: "dev", did: "finished", what: "Menu cards to print" },
      { day: "Yesterday", time: "11:05", who: "sam", did: "shared", what: "Marquee layout v3" },
      { day: "Tuesday", time: "14:20", who: "orla", did: "set the status to", what: "On track" },
      { day: "Tuesday", time: "08:50", who: "finn", did: "added", what: "4 guests to the list" },
    ],
    links: [
      { label: "Run-sheet", kind: "doc", meta: "Edited today" },
      { label: "Floor plan", kind: "plan", meta: "v3 from Sam" },
      { label: "Supplier contracts", kind: "folder", meta: "7 files" },
      { label: "Menu", kind: "sheet", meta: "5 courses" },
    ],
  },
  {
    id: "harvest",
    name: "Harvest supper club",
    purpose: "Forty seats, one long table, the last of the orchard apples.",
    kind: "event",
    hue: 5,
    status: "on-track",
    statusBy: "Dev",
    statusWhen: "Monday",
    start: "2026-10-17",
    done: 8,
    total: 13,
    overdue: 0,
    review: 0,
    fact: { text: "Menu locked, 38 of 40 seats sold", tone: "calm" },
    openedMinutesAgo: 60 * 26,
    members: [
      { person: "dev", role: "Owner", owner: true },
      { person: "orla", role: "Host" },
      { person: "aoife", role: "Front of house" },
      { person: "mark", role: "Cider maker", org: "Doyle's Press" },
    ],
    week: [
      { id: "hv1", title: "Send the allergy form to ticket holders", who: "aoife", due: "2026-09-28", state: "open" },
      { id: "hv2", title: "Taste the cider pairing", who: "dev", due: "2026-09-30", state: "open" },
      { id: "hv3", title: "Print the place cards", who: "orla", due: "2026-10-02", state: "open" },
    ],
    milestones: [
      { label: "Tickets on sale", date: "2026-08-20" },
      { label: "Menu locked", date: "2026-09-18" },
      { label: "Pairings", date: "2026-09-30" },
      { label: "Supper", date: "2026-10-17" },
    ],
    current: 2,
    activity: [
      { day: "Yesterday", time: "17:40", who: "aoife", did: "sold", what: "2 more seats" },
      { day: "Monday", time: "09:30", who: "dev", did: "locked", what: "the five-course menu" },
    ],
    links: [
      { label: "Menu", kind: "doc", meta: "Locked" },
      { label: "Guest list", kind: "sheet", meta: "38 of 40" },
      { label: "Table plan", kind: "plan", meta: "One long table" },
    ],
  },
  {
    id: "barn",
    name: "Barn roof and heating works",
    purpose: "New slate, insulation and underfloor heating before winter bookings.",
    kind: "works",
    hue: 2,
    status: "at-risk",
    statusBy: "Tom",
    statusWhen: "Wednesday",
    start: "2026-10-30",
    done: 9,
    total: 20,
    overdue: 2,
    review: 0,
    fact: { text: "Contractor slipped two weeks", tone: "risk" },
    openedMinutesAgo: 60 * 3,
    members: [
      { person: "tom", role: "Owner", owner: true },
      { person: "orla", role: "Venue lead" },
      { person: "jo", role: "Contractor", org: "Farrell Build" },
    ],
    needsYou: {
      title: "Two weddings sit inside the new dates",
      body: "Farrell Build now finish on 13 Nov. The Kavanagh 40th uses the barn on 14 Nov.",
      action: "Plan a fallback room",
    },
    week: [
      { id: "br1", title: "Agree the revised schedule with Farrell Build", who: "tom", due: "2026-09-24", state: "open" },
      { id: "br2", title: "Order the heating manifold", who: "jo", due: "2026-09-22", state: "open" },
      { id: "br3", title: "Check the scaffold insurance", who: "tom", due: "2026-09-29", state: "open" },
    ],
    milestones: [
      { label: "Survey", date: "2026-07-10" },
      { label: "Strip roof", date: "2026-09-01" },
      { label: "Slate and insulate", date: "2026-10-09" },
      { label: "Heating in", date: "2026-10-23" },
      { label: "Handover", date: "2026-10-30" },
    ],
    current: 2,
    activity: [
      { day: "Wednesday", time: "15:10", who: "tom", did: "set the status to", what: "At risk" },
      { day: "Wednesday", time: "14:55", who: "jo", did: "moved", what: "Handover to 13 Nov" },
    ],
    links: [
      { label: "Drawings", kind: "plan", meta: "Rev C" },
      { label: "Quotes", kind: "folder", meta: "4 files" },
      { label: "Schedule", kind: "sheet", meta: "Updated Wed" },
    ],
  },
  {
    id: "kavanagh",
    name: "Kavanagh 40th",
    purpose: "Surprise party for Lena, 70 guests, band in the barn.",
    kind: "event",
    hue: 1,
    status: "on-track",
    statusBy: "Orla",
    statusWhen: "last week",
    start: "2026-11-14",
    done: 2,
    total: 10,
    overdue: 0,
    review: 0,
    fact: { text: "Deposit in, band still to confirm", tone: "calm" },
    openedMinutesAgo: 60 * 50,
    members: [
      { person: "orla", role: "Owner", owner: true },
      { person: "lena", role: "Host's sister" },
      { person: "cian", role: "Band", org: "The Late Shift" },
    ],
    week: [
      { id: "kv1", title: "Chase the band for a yes", who: "orla", due: "2026-09-30", state: "open" },
      { id: "kv2", title: "Send the guest list template", who: "lena", due: "2026-10-01", state: "open" },
    ],
    milestones: [
      { label: "Deposit", date: "2026-09-12" },
      { label: "Band", date: "2026-10-01" },
      { label: "Guest list", date: "2026-10-20" },
      { label: "Party", date: "2026-11-14" },
    ],
    current: 1,
    activity: [{ day: "Monday", time: "12:00", who: "lena", did: "paid", what: "the deposit" }],
    links: [
      { label: "Brief", kind: "doc", meta: "From Lena" },
      { label: "Guest list", kind: "sheet", meta: "Not started" },
    ],
  },
  {
    id: "markets",
    name: "Christmas markets at The Orchard",
    purpose: "Four weekends, 14 stalls, mulled cider and a carol night.",
    kind: "season",
    hue: 7,
    status: "not-started",
    statusBy: "Orla",
    statusWhen: "3 Sep",
    start: "2026-11-28",
    end: "2026-12-21",
    done: 3,
    total: 30,
    overdue: 0,
    review: 0,
    fact: { text: "14 stalls, 9 still to confirm", tone: "calm" },
    openedMinutesAgo: 60 * 24 * 6,
    members: [
      { person: "orla", role: "Owner", owner: true },
      { person: "aoife", role: "Stallholders" },
      { person: "priya", role: "Marketing" },
    ],
    week: [{ id: "cm1", title: "Send stall offers to the waiting list", who: "aoife", due: "2026-10-02", state: "open" }],
    milestones: [
      { label: "Stalls", date: "2026-10-16" },
      { label: "Lights and power", date: "2026-11-13" },
      { label: "Opening weekend", date: "2026-11-28" },
      { label: "Carol night", date: "2026-12-19" },
    ],
    current: 0,
    activity: [{ day: "3 Sep", time: "10:00", who: "orla", did: "created", what: "the project" }],
    links: [
      { label: "Stall map", kind: "plan", meta: "14 pitches" },
      { label: "Stallholders", kind: "sheet", meta: "5 confirmed" },
    ],
  },
  {
    id: "ada-theo",
    name: "Ada & Theo's winter micro-wedding",
    purpose: "Twenty guests by the fire in the old dairy.",
    kind: "wedding",
    hue: 2,
    status: "on-track",
    statusBy: "Orla",
    statusWhen: "Monday",
    start: "2026-12-12",
    done: 1,
    total: 20,
    overdue: 0,
    review: 0,
    fact: { text: "Kick-off call on Tuesday", tone: "calm" },
    openedMinutesAgo: 60 * 24 * 2,
    members: [
      { person: "orla", role: "Owner", owner: true },
      { person: "ada", role: "Couple" },
      { person: "theo", role: "Couple" },
    ],
    week: [{ id: "at1", title: "Kick-off call with Ada and Theo", who: "orla", due: "2026-09-29", state: "open" }],
    milestones: [
      { label: "Kick-off", date: "2026-09-29" },
      { label: "Menu tasting", date: "2026-10-24" },
      { label: "Final numbers", date: "2026-11-28" },
      { label: "The day", date: "2026-12-12" },
    ],
    current: 0,
    activity: [{ day: "Monday", time: "11:20", who: "ada", did: "signed", what: "the booking form" }],
    links: [
      { label: "Booking form", kind: "doc", meta: "Signed" },
      { label: "Ideas", kind: "image", meta: "12 images" },
    ],
  },
  {
    id: "winter-launch",
    name: "Winter season launch",
    purpose: "Brochure, website and socials for the winter weddings season.",
    kind: "agency",
    hue: 3,
    status: "off-track",
    statusBy: "Priya",
    statusWhen: "yesterday",
    start: "2026-10-12",
    done: 12,
    total: 17,
    overdue: 1,
    review: 2,
    fact: { text: "Photos late, shoot moved to Monday", tone: "risk" },
    openedMinutesAgo: 60 * 5,
    members: [
      { person: "priya", role: "Owner", owner: true },
      { person: "orla", role: "Approver" },
      { person: "ruth", role: "Photographer" },
    ],
    week: [
      { id: "wl1", title: "Reshoot the dairy by firelight", who: "ruth", due: "2026-09-28", state: "open" },
      { id: "wl2", title: "Approve brochure copy", who: "orla", due: "2026-09-25", state: "review" },
    ],
    milestones: [
      { label: "Brief", date: "2026-08-15" },
      { label: "Shoot", date: "2026-09-28" },
      { label: "Brochure", date: "2026-10-05" },
      { label: "Launch", date: "2026-10-12" },
    ],
    current: 1,
    activity: [{ day: "Yesterday", time: "18:05", who: "priya", did: "set the status to", what: "Off track" }],
    links: [
      { label: "Brochure", kind: "deck", meta: "16 pages" },
      { label: "Shot list", kind: "doc", meta: "22 shots" },
      { label: "Photos", kind: "folder", meta: "Waiting" },
    ],
  },
  {
    id: "northside",
    name: "Northside Studio rebrand",
    purpose: "New identity and signage for a ceramics studio on the quays.",
    kind: "agency",
    hue: 4,
    status: "on-track",
    statusBy: "Priya",
    statusWhen: "Tuesday",
    start: null,
    done: 10,
    total: 12,
    overdue: 0,
    review: 1,
    fact: { text: "Final logo files due Wednesday", tone: "calm" },
    openedMinutesAgo: 60 * 24 * 4,
    members: [
      { person: "priya", role: "Owner", owner: true },
      { person: "mark", role: "Client", org: "Northside Studio" },
    ],
    week: [{ id: "ns1", title: "Export the final logo files", who: "priya", due: "2026-09-30", state: "review" }],
    milestones: [
      { label: "Discovery", date: "2026-07-01" },
      { label: "Concepts", date: "2026-08-12" },
      { label: "Final files", date: "2026-09-30" },
      { label: "Signage", date: "2026-10-20" },
    ],
    current: 2,
    activity: [{ day: "Tuesday", time: "16:00", who: "mark", did: "approved", what: "logo route B" }],
    links: [
      { label: "Brand book", kind: "deck", meta: "24 pages" },
      { label: "Logo files", kind: "folder", meta: "In review" },
    ],
  },
  {
    id: "science-fair",
    name: "Year 5 science fair at St Brigid's",
    purpose: "Twenty-eight projects, one gym hall, parents from 6pm.",
    kind: "school",
    hue: 4,
    status: "on-track",
    statusBy: "Ruth",
    statusWhen: "Monday",
    start: "2026-10-30",
    done: 6,
    total: 11,
    overdue: 0,
    review: 0,
    fact: { text: "22 of 28 projects registered", tone: "calm" },
    openedMinutesAgo: 60 * 24 * 3,
    members: [
      { person: "ruth", role: "Owner", owner: true },
      { person: "jo", role: "Caretaker" },
      { person: "orla", role: "Parent helper" },
    ],
    week: [{ id: "sf1", title: "Chase the last six registrations", who: "ruth", due: "2026-10-02", state: "open" }],
    milestones: [
      { label: "Topics", date: "2026-09-11" },
      { label: "Registrations", date: "2026-10-02" },
      { label: "Hall layout", date: "2026-10-16" },
      { label: "Fair night", date: "2026-10-30" },
    ],
    current: 1,
    activity: [{ day: "Monday", time: "15:30", who: "ruth", did: "registered", what: "4 more projects" }],
    links: [
      { label: "Registrations", kind: "sheet", meta: "22 of 28" },
      { label: "Hall plan", kind: "plan", meta: "Draft" },
    ],
  },
  // Wrapped
  {
    id: "doyle-chen",
    name: "Doyle & Chen wedding",
    purpose: "Ninety guests, a ceilí and a very late cake.",
    kind: "wedding",
    hue: 8,
    status: "wrapped",
    statusBy: "Orla",
    statusWhen: "12 Sep",
    start: "2026-09-12",
    done: 41,
    total: 41,
    overdue: 0,
    review: 0,
    fact: { text: "41 of 41 tasks, 2 days early", tone: "done" },
    openedMinutesAgo: 60 * 24 * 9,
    wrapped: { on: "12 Sep", stat: "41 of 41 tasks, 2 days early" },
    members: [
      { person: "orla", role: "Owner", owner: true },
      { person: "dev", role: "Head chef" },
      { person: "niamh", role: "Florist", org: "Wildflower & Co" },
    ],
    week: [],
    milestones: [
      { label: "Venue booked", date: "2026-02-02" },
      { label: "Final numbers", date: "2026-09-01" },
      { label: "The day", date: "2026-09-12" },
    ],
    current: 3,
    activity: [{ day: "12 Sep", time: "23:40", who: "orla", did: "wrapped", what: "the project" }],
    links: [{ label: "Run-sheet", kind: "doc", meta: "Final" }],
  },
  {
    id: "garden-parties",
    name: "Summer garden parties 2026",
    purpose: "Six Saturday garden parties on the lawn.",
    kind: "season",
    hue: 5,
    status: "wrapped",
    statusBy: "Orla",
    statusWhen: "31 Aug",
    start: "2026-06-06",
    end: "2026-08-31",
    done: 36,
    total: 36,
    overdue: 0,
    review: 0,
    fact: { text: "36 of 36 tasks, 1,140 guests", tone: "done" },
    openedMinutesAgo: 60 * 24 * 20,
    wrapped: { on: "31 Aug", stat: "36 of 36 tasks, 1,140 guests" },
    members: [
      { person: "orla", role: "Owner", owner: true },
      { person: "aoife", role: "Front of house" },
    ],
    week: [],
    milestones: [
      { label: "First party", date: "2026-06-06" },
      { label: "Last party", date: "2026-08-29" },
    ],
    current: 2,
    activity: [{ day: "31 Aug", time: "18:00", who: "orla", did: "wrapped", what: "the project" }],
    links: [{ label: "Takings", kind: "sheet", meta: "Final" }],
  },
  {
    id: "spring-tastings",
    name: "Spring tasting evenings",
    purpose: "Three menu evenings for next year's couples.",
    kind: "event",
    hue: 4,
    status: "wrapped",
    statusBy: "Dev",
    statusWhen: "30 May",
    start: "2026-05-30",
    done: 18,
    total: 18,
    overdue: 0,
    review: 0,
    fact: { text: "18 of 18 tasks, 11 bookings", tone: "done" },
    openedMinutesAgo: 60 * 24 * 60,
    wrapped: { on: "30 May", stat: "18 of 18 tasks, 11 bookings" },
    members: [
      { person: "dev", role: "Owner", owner: true },
      { person: "orla", role: "Host" },
    ],
    week: [],
    milestones: [{ label: "Last evening", date: "2026-05-30" }],
    current: 1,
    activity: [{ day: "30 May", time: "22:00", who: "dev", did: "wrapped", what: "the project" }],
    links: [{ label: "Menus", kind: "doc", meta: "Three menus" }],
  },
];

/* ── Dates ───────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysFromToday(iso: string) {
  return Math.round((parse(iso) - parse(TODAY)) / 86_400_000);
}

export function shortDate(iso: string) {
  const d = new Date(parse(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function dayDate(iso: string) {
  const d = new Date(parse(iso));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function weekday(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  const d = new Date(parse(iso));
  if (Math.abs(n) < 7) return DAYS[d.getUTCDay()];
  return shortDate(iso);
}

/** Badge: the big line and the small line for the cover's date badge. */
export function badgeFor(p: Pick<Project, "start" | "end">): { big: string; small: string } | null {
  if (!p.start) return null;
  const n = daysFromToday(p.start);
  if (p.end && n > 0) return { big: shortDate(p.start), small: `to ${shortDate(p.end)}` };
  if (n === 0) return { big: "Today", small: dayDate(p.start) };
  if (n === 1) return { big: "Tomorrow", small: dayDate(p.start) };
  if (n > 1 && n <= 14) return { big: `${n} days`, small: dayDate(p.start) };
  if (n > 14) {
    const weeks = Math.round(n / 7);
    return { big: shortDate(p.start), small: `in ${weeks} weeks` };
  }
  return { big: shortDate(p.start), small: "Passed" };
}

export const STATUS_LABEL: Record<Status, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  "off-track": "Off track",
  "not-started": "Not started",
  wrapped: "Wrapped",
};

export const KIND_LABEL: Record<Kind, string> = {
  wedding: "Wedding",
  event: "Event",
  season: "Season",
  works: "Works",
  school: "School",
  agency: "Client",
};

export function percent(done: number, total: number) {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function firstName(id: string) {
  return PEOPLE[id]?.name.split(" ")[0] ?? id;
}
