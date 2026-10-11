/* How it all connects: invented sample data. Friday 25 September, 14:30. */

export type ProjectId = "orchard" | "mara" | "riverside" | "hollis";
export type Filter = "all" | ProjectId;

export type Project = { id: ProjectId; name: string; short: string; kind: string };

export const PROJECTS: Project[] = [
  { id: "orchard", name: "The Orchard", short: "Orchard", kind: "Venue" },
  { id: "mara", name: "Mara & Finn", short: "Mara & Finn", kind: "Wedding" },
  { id: "riverside", name: "Riverside survey", short: "Riverside", kind: "Class project" },
  { id: "hollis", name: "Hollis Cafe launch", short: "Hollis", kind: "Client launch" },
];

export const projectById = (id: ProjectId) => PROJECTS.find((p) => p.id === id)!;

export type Glyph =
  | "mail"
  | "outlook"
  | "chat"
  | "calendar"
  | "apple"
  | "form"
  | "drive"
  | "card"
  | "tasks"
  | "timeline"
  | "notes"
  | "files"
  | "guests"
  | "link"
  | "send"
  | "sheet"
  | "text";

export type Side = "source" | "app" | "dest";

export type NodeDef = {
  id: string;
  side: Side;
  name: string;
  glyph: Glyph;
  /** Account or one-line description under the name. */
  sub: string;
  /** For a place nothing is connected to yet: what it would do, in one line. */
  would?: string;
  /** Not available yet. */
  later?: boolean;
};

export const SOURCES: NodeDef[] = [
  { id: "gmail", side: "source", name: "Gmail", glyph: "mail", sub: "bookings@theorchard.ie", would: "Emails you choose become tasks, with the email attached" },
  { id: "outlook", side: "source", name: "Outlook", glyph: "outlook", sub: "priya@marafinn.co", would: "Emails you choose become tasks, with the email attached" },
  { id: "whatsapp", side: "source", name: "WhatsApp", glyph: "chat", sub: "3 groups", would: "Photos and voice notes from a group save to your Project" },
  { id: "forms", side: "source", name: "Forms", glyph: "form", sub: "RSVP and enquiry forms", would: "Every reply lands in the right list, no copying" },
  { id: "gcal", side: "source", name: "Google Calendar", glyph: "calendar", sub: "Team calendar", would: "Your events show on the timeline next to the plan" },
  { id: "drive", side: "source", name: "Google Drive", glyph: "drive", sub: "Survey folder", would: "Files in a folder appear in Files, kept up to date" },
  { id: "acal", side: "source", name: "Apple Calendar", glyph: "apple", sub: "Not connected", would: "Your iPhone calendar shows on the timeline" },
  { id: "card", side: "source", name: "Card payments", glyph: "card", sub: "Coming later", would: "A paid deposit ticks off its task by itself", later: true },
];

export const APPS: NodeDef[] = [
  { id: "tasks", side: "app", name: "Tasks", glyph: "tasks", sub: "What needs doing" },
  { id: "guests", side: "app", name: "Guest list", glyph: "guests", sub: "Who is coming" },
  { id: "timeline", side: "app", name: "Timeline", glyph: "timeline", sub: "Where it is heading" },
  { id: "notes", side: "app", name: "Notes", glyph: "notes", sub: "What you wrote down" },
  { id: "files", side: "app", name: "Files", glyph: "files", sub: "Photos and documents" },
];

export const DESTS: NodeDef[] = [
  { id: "gcal-out", side: "dest", name: "Your calendar", glyph: "calendar", sub: "Google Calendar", would: "Dates from the timeline appear in your calendar" },
  { id: "share", side: "dest", name: "Shared timeline link", glyph: "link", sub: "Anyone with the link", would: "Clients see the latest plan without an account" },
  { id: "weekly", side: "dest", name: "Weekly email", glyph: "send", sub: "Fridays at 17:00", would: "A short summary of the week, sent for you" },
  { id: "sheet", side: "dest", name: "Google Sheets", glyph: "sheet", sub: "Kept up to date", would: "A copy of a list in a sheet you can share" },
  { id: "sms", side: "dest", name: "Text reminders", glyph: "text", sub: "Not connected", would: "Suppliers get a text the day before they arrive" },
];

export const ALL_NODES = [...SOURCES, ...APPS, ...DESTS];
export const nodeById = (id: string) => ALL_NODES.find((n) => n.id === id)!;

export type Status = "live" | "broken" | "paused" | "waiting";

export type Rule = { id: string; text: string; on: boolean };

export type Conn = {
  id: string;
  from: string;
  to: string;
  /** Null when the connection serves every Project. */
  project: ProjectId | null;
  /** What the line does, in plain words. */
  label: string;
  status: Status;
  /** How many things went along this line today. */
  today: number;
  /** Last seven days, oldest first, ending today. */
  week: number[];
  /** What one thing along this line is called: "email", "reply". */
  unit: [string, string];
  rules: Rule[];
  /** Plain status line, shown when the line is not simply on. */
  note?: string;
  /** Who paused it. */
  by?: string;
  /** For outgoing lines with nothing today: when it next goes. */
  next?: string;
  /** Added in this session: the first dot travels as soon as it lands. */
  fresh?: boolean;
};

export const BUSY_PER_DAY = 25;

export const CONNECTIONS: Conn[] = [
  {
    id: "gmail-tasks",
    from: "gmail",
    to: "tasks",
    project: "orchard",
    label: "Booking emails become tasks",
    status: "broken",
    today: 0,
    week: [6, 5, 0, 0, 0, 0, 0],
    unit: ["email", "emails"],
    note: "Gmail stopped sending on 23 September. Sign in again",
    rules: [
      { id: "r1", text: "Only emails sent to bookings@theorchard.ie", on: true },
      { id: "r2", text: "Put the date they ask about in the task title", on: true },
      { id: "r3", text: "Give it to Aoife to reply", on: true },
    ],
  },
  {
    id: "outlook-tasks",
    from: "outlook",
    to: "tasks",
    project: "mara",
    label: "Supplier emails become tasks",
    status: "live",
    today: 1,
    week: [2, 0, 3, 1, 2, 0, 1],
    unit: ["email", "emails"],
    rules: [
      { id: "r1", text: "Only emails from people in Suppliers", on: true },
      { id: "r2", text: "Attach the email to the task", on: true },
      { id: "r3", text: "Skip emails with “unsubscribe” in them", on: true },
    ],
  },
  {
    id: "wa-files",
    from: "whatsapp",
    to: "files",
    project: "riverside",
    label: "Site photos save to Files",
    status: "live",
    today: 2,
    week: [0, 4, 7, 0, 1, 3, 2],
    unit: ["photo", "photos"],
    rules: [
      { id: "r1", text: "Only from the group Survey team", on: true },
      { id: "r2", text: "Photos only, not voice notes", on: true },
      { id: "r3", text: "Name each photo by who sent it and when", on: true },
    ],
  },
  {
    id: "wa-notes",
    from: "whatsapp",
    to: "notes",
    project: "hollis",
    label: "Voice notes become notes",
    status: "paused",
    today: 0,
    week: [3, 2, 4, 1, 0, 0, 0],
    unit: ["voice note", "voice notes"],
    by: "Priya",
    note: "Paused by Priya on Tuesday",
    rules: [
      { id: "r1", text: "Only from the group Hollis opening", on: true },
      { id: "r2", text: "Write out what was said", on: true },
    ],
  },
  {
    id: "forms-guests",
    from: "forms",
    to: "guests",
    project: "mara",
    label: "RSVP replies fill the guest list",
    status: "live",
    today: 3,
    week: [5, 8, 2, 4, 6, 1, 3],
    unit: ["reply", "replies"],
    rules: [
      { id: "r1", text: "Match replies to invited guests by name", on: true },
      { id: "r2", text: "Save meal choices and allergies", on: true },
      { id: "r3", text: "Tell Priya when someone says no", on: false },
    ],
  },
  {
    id: "forms-tasks",
    from: "forms",
    to: "tasks",
    project: "orchard",
    label: "Web enquiries become tasks",
    status: "live",
    today: 12,
    week: [38, 44, 41, 29, 36, 47, 12],
    unit: ["enquiry", "enquiries"],
    rules: [
      { id: "r1", text: "Group enquiries for the same date into one task", on: true },
      { id: "r2", text: "Give them to whoever is on bookings that day", on: true },
    ],
  },
  {
    id: "gcal-timeline",
    from: "gcal",
    to: "timeline",
    project: null,
    label: "Team events show on the timeline",
    status: "live",
    today: 6,
    week: [4, 5, 7, 3, 6, 2, 6],
    unit: ["event", "events"],
    rules: [
      { id: "r1", text: "Show events from every Project", on: true },
      { id: "r2", text: "Hide events marked private", on: true },
    ],
  },
  {
    id: "drive-files",
    from: "drive",
    to: "files",
    project: "riverside",
    label: "Survey sheets appear in Files",
    status: "waiting",
    today: 0,
    week: [0, 0, 0, 0, 0, 0, 0],
    unit: ["file", "files"],
    note: "Waiting for you to allow access in Google",
    rules: [{ id: "r1", text: "Only the folder Riverside survey 2026", on: true }],
  },
  {
    id: "timeline-gcal",
    from: "timeline",
    to: "gcal-out",
    project: "orchard",
    label: "Bookings go to your calendar",
    status: "live",
    today: 4,
    week: [3, 6, 2, 5, 4, 1, 4],
    unit: ["booking", "bookings"],
    rules: [
      { id: "r1", text: "Only confirmed bookings", on: true },
      { id: "r2", text: "Add the room and head count to the event", on: true },
    ],
  },
  {
    id: "timeline-gcal-mara",
    from: "timeline",
    to: "gcal-out",
    project: "mara",
    label: "Wedding dates go to your calendar",
    status: "live",
    today: 0,
    week: [1, 0, 0, 2, 0, 0, 0],
    unit: ["date", "dates"],
    next: "Nothing new today",
    rules: [{ id: "r1", text: "Include supplier arrival times", on: true }],
  },
  {
    id: "timeline-share",
    from: "timeline",
    to: "share",
    project: "hollis",
    label: "Hollis sees the latest plan",
    status: "live",
    today: 6,
    week: [2, 0, 4, 9, 3, 1, 6],
    unit: ["visit", "visits"],
    rules: [
      { id: "r1", text: "Hide tasks marked internal", on: true },
      { id: "r2", text: "Show who owns each step", on: false },
    ],
  },
  {
    id: "tasks-weekly",
    from: "tasks",
    to: "weekly",
    project: "mara",
    label: "Friday summary to the couple",
    status: "live",
    today: 0,
    week: [0, 0, 0, 0, 0, 0, 0],
    unit: ["email", "emails"],
    next: "Goes out today at 17:00",
    rules: [
      { id: "r1", text: "What got done this week and what is next", on: true },
      { id: "r2", text: "Leave out supplier prices", on: true },
    ],
  },
  {
    id: "guests-sheet",
    from: "guests",
    to: "sheet",
    project: "mara",
    label: "Guest list kept in a sheet",
    status: "live",
    today: 3,
    week: [5, 8, 2, 4, 6, 1, 3],
    unit: ["row", "rows"],
    rules: [{ id: "r1", text: "Share the sheet with the caterer", on: true }],
  },
  {
    id: "tasks-sheet",
    from: "tasks",
    to: "sheet",
    project: "riverside",
    label: "Progress goes to your tutor",
    status: "live",
    today: 1,
    week: [0, 2, 1, 0, 3, 0, 1],
    unit: ["update", "updates"],
    rules: [{ id: "r1", text: "Only tasks marked done", on: true }],
  },
];

/* ── Today ledger ──────────────────────────────────────────────────────── */

export type LedgerItem = {
  id: string;
  time: string;
  conn: string;
  text: string;
  detail: string;
  /** Grouped because the line is busy. */
  grouped?: boolean;
};

export const LEDGER: LedgerItem[] = [
  { id: "l1", time: "14:12", conn: "forms-guests", text: "3 RSVP replies arrived from the form into Guest list", detail: "Aoife Byrne (+1), Tom Reilly, Grace and Sam Okafor" },
  { id: "l2", time: "13:40", conn: "forms-tasks", text: "12 enquiries from the form", detail: "Most ask about Saturdays in May. 4 are for the same date", grouped: true },
  { id: "l3", time: "12:05", conn: "tasks-sheet", text: "1 finished task copied to the tutor’s sheet", detail: "Water samples, site 2" },
  { id: "l4", time: "11:48", conn: "outlook-tasks", text: "1 email from Harbour Florists became a task", detail: "“Peonies are out of season, can we swap to garden roses?”" },
  { id: "l5", time: "11:02", conn: "timeline-gcal", text: "4 Orchard bookings went to Google Calendar", detail: "Keane 60th, Doyle wedding, Brennan wake, the Quiz night" },
  { id: "l6", time: "10:31", conn: "timeline-share", text: "Hollis opened the shared timeline 6 times", detail: "Mostly the opening week, last at 10:31" },
  { id: "l7", time: "09:26", conn: "wa-files", text: "2 WhatsApp photos saved to Files", detail: "From Niamh in Survey team: the north bank, site 3" },
  { id: "l8", time: "08:00", conn: "gcal-timeline", text: "6 team events came onto the timeline", detail: "Including the Orchard tasting on Monday at 18:00" },
  { id: "l9", time: "07:55", conn: "guests-sheet", text: "3 guest list changes copied to the caterer’s sheet", detail: "Two meal choices and one allergy" },
];

export const UPCOMING = [
  { id: "u1", conn: "tasks-weekly", time: "17:00", text: "Friday summary goes to Mara and Finn", detail: "8 things done this week, 5 next" },
];

/* ── Drawing a new line: the one question each pair asks ───────────────── */

export type Choice = { id: string; label: string; hint: string; project: ProjectId; taken?: boolean };
export type NewFlow = { question: string; label: string; unit: [string, string]; choices: Choice[]; rules: string[]; access?: string };

const PROJECT_CHOICES: Choice[] = PROJECTS.map((p) => ({ id: p.id, label: p.name, hint: p.kind, project: p.id }));

export const NEW_FLOWS: Record<string, NewFlow> = {
  "whatsapp>files": {
    question: "Which group?",
    label: "Supplier photos save to Files",
    unit: ["photo", "photos"],
    choices: [
      { id: "g1", label: "Suppliers for Mara & Finn", hint: "9 people · photos from venue visits", project: "mara" },
      { id: "g2", label: "Hollis opening", hint: "5 people · shop fit photos", project: "hollis" },
      { id: "g3", label: "Survey team", hint: "Already connected", project: "riverside", taken: true },
    ],
    rules: ["Photos only, not voice notes", "Name each photo by who sent it and when"],
  },
  "whatsapp>notes": {
    question: "Which group?",
    label: "Voice notes become notes",
    unit: ["voice note", "voice notes"],
    choices: [
      { id: "g1", label: "Suppliers for Mara & Finn", hint: "9 people", project: "mara" },
      { id: "g3", label: "Survey team", hint: "4 people", project: "riverside" },
    ],
    rules: ["Write out what was said"],
  },
  "whatsapp>tasks": {
    question: "Which group?",
    label: "Messages you star become tasks",
    unit: ["message", "messages"],
    choices: [
      { id: "g1", label: "Suppliers for Mara & Finn", hint: "9 people", project: "mara" },
      { id: "g2", label: "Hollis opening", hint: "5 people", project: "hollis" },
    ],
    rules: ["Only messages you star"],
  },
  "acal>timeline": {
    question: "Which calendar?",
    label: "Your iPhone calendar shows on the timeline",
    unit: ["event", "events"],
    access: "Waiting for you to allow access in Apple",
    choices: [
      { id: "c1", label: "Work", hint: "Priya’s iPhone · 42 events", project: "orchard" },
      { id: "c2", label: "Weddings", hint: "Priya’s iPhone · 11 events", project: "mara" },
    ],
    rules: ["Hide events marked private"],
  },
  "gmail>tasks": {
    question: "Which emails should become tasks?",
    label: "Emails you choose become tasks",
    unit: ["email", "emails"],
    access: "Waiting for you to allow access in Google",
    choices: [
      { id: "e1", label: "Emails from people in Suppliers", hint: "For Mara & Finn", project: "mara" },
      { id: "e2", label: "Emails to bookings@theorchard.ie", hint: "For The Orchard", project: "orchard" },
      { id: "e3", label: "Emails I label Signal", hint: "For Hollis Cafe launch", project: "hollis" },
    ],
    rules: ["Attach the email to the task"],
  },
};

export function flowFor(from: string, to: string): NewFlow {
  const known = NEW_FLOWS[`${from}>${to}`];
  if (known) return known;
  const a = nodeById(from);
  const b = nodeById(to);
  return {
    question: "Which Project is this for?",
    label: `${a.name} into ${b.name}`,
    unit: ["item", "items"],
    access: a.id === "gmail" || a.id === "drive" || a.id === "gcal" ? "Waiting for you to allow access in Google" : undefined,
    choices: PROJECT_CHOICES,
    rules: [],
  };
}

/** What a target does with things from a source, for the Connect to list. */
export function wouldDo(from: string, to: string) {
  const b = nodeById(to);
  const map: Record<string, string> = {
    tasks: "Turn them into tasks",
    guests: "Add people to the guest list",
    timeline: "Put dates on the timeline",
    notes: "Keep them as notes",
    files: "Save them in Files",
    "gcal-out": "Put dates in your calendar",
    share: "Show the plan to people outside",
    weekly: "Send a weekly summary",
    sheet: "Keep a copy in a sheet",
    sms: "Text people a reminder",
  };
  void from;
  return map[b.id] ?? `Send them to ${b.name}`;
}

export const DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Today"];
