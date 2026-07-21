/**
 * Lab-only demo fixtures for the Phase 3 task-detail exploration.
 * These are INDEPENDENT of production tasks-demo.ts — they are richer
 * and purpose-built for exercising all the premium IA branches.
 *
 * Persona: wedding-venue duty manager at "The Orchard Events".
 * Project: "Maria & James — 20 July 2026" coordination.
 *
 * Divergence from production: production uses Task (from @/lib/data) with
 * lane/priority/assignees. Here we use LabDetailTask, a superset that
 * carries resources, subtasks with mixed statuses, multi-paragraph briefs,
 * and conversation items. The production port will adapt via the
 * Task↔LabDetailTask adapter that lives in this directory.
 */

export type LabDetailStatus = "queued" | "active" | "review" | "waiting" | "done";
export type LabDetailPriority = "urgent" | "high" | "normal" | "low";

export type LabDetailPerson = {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: string;
};

export type LabDetailSubtask = {
  id: string;
  title: string;
  status: LabDetailStatus;
};

export type LabDetailResourceProvider =
  | "google_doc"
  | "figma"
  | "github"
  | "upload"
  | "url";

export type LabDetailResource = {
  id: string;
  provider: LabDetailResourceProvider;
  title: string;
  url: string;
  addedBy: string;
  addedAt: string;
  size?: string;
};

export type LabDetailConversationItem =
  | { kind: "comment"; id: string; authorId: string; body: string; createdAt: string }
  | { kind: "activity"; id: string; authorId: string; text: string; createdAt: string };

export type LabDetailTask = {
  id: string;
  title: string;
  brief: string;
  status: LabDetailStatus;
  priority: LabDetailPriority;
  assigneeIds: string[];
  dueDate: string | null;
  tags: string[];
  project: string;
  projectSlug: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  estimate: string | null;
  subtasks: LabDetailSubtask[];
  resources: LabDetailResource[];
  conversation: LabDetailConversationItem[];
  blockedByIds: string[];
  parentId: string | null;
};

// ── People ──────────────────────────────────────────────────────────────

export const LAB_PEOPLE: LabDetailPerson[] = [
  { id: "niamh", name: "Niamh Doyle", initials: "ND", color: "#4f46e5", role: "Venue Manager" },
  { id: "aoife", name: "Aoife Brennan", initials: "AB", color: "#10b981", role: "Florist" },
  { id: "conor", name: "Conor Walsh", initials: "CW", color: "#f59e0b", role: "Catering Lead" },
  { id: "siobhan", name: "Siobhán Murphy", initials: "SM", color: "#06b6d4", role: "Ceremony Coordinator" },
  { id: "eoin", name: "Eoin Kelly", initials: "EK", color: "#8b5cf6", role: "AV & Sound" },
  { id: "rachel", name: "Rachel Moran", initials: "RM", color: "#ef4444", role: "Photographer" },
];

export function personById(id: string): LabDetailPerson | undefined {
  return LAB_PEOPLE.find((p) => p.id === id);
}

// ── Status colours (matching hybrid board grammar) ──────────────────────

export const STATUS_CONFIG: Record<LabDetailStatus, { label: string; dot: string; bg: string; ink: string }> = {
  queued:  { label: "Queued",      dot: "#a1a1aa",  bg: "#f4f4f5",  ink: "#52525b" },
  active:  { label: "In progress", dot: "#4f46e5",  bg: "#eef2ff",  ink: "#4f46e5" },
  review:  { label: "Review",      dot: "#06b6d4",  bg: "#ecfeff",  ink: "#0e7490" },
  waiting: { label: "Waiting",     dot: "#f59e0b",  bg: "#fffbeb",  ink: "#b45309" },
  done:    { label: "Done",        dot: "#10b981",  bg: "#d1fae5",  ink: "#065f46" },
};

export const PRIORITY_CONFIG: Record<LabDetailPriority, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "#ef4444" },
  high:   { label: "High",   color: "#f59e0b" },
  normal: { label: "Normal", color: "#a1a1aa" },
  low:    { label: "Low",    color: "#d4d4d8" },
};

// ── Lab Tasks ──────────────────────────────────────────────────────────

/** t-lab-01: The flagship task — long brief, 7 subtasks with mixed statuses,
 *  4 resources, 9 conversation items. This is the primary render target. */
const VENUE_PLAN: LabDetailTask = {
  id: "t-lab-01",
  title: "Venue layout and ceremony flow plan",
  brief: `Maria and James have requested an outdoor ceremony on the south terrace with a marquee fallback if rain is forecast by Wednesday. The guest count is confirmed at 112, which means we'll run the aisle from the stone gate to the arbour — approximately 28 metres — with 14 chairs per side and a 4-metre centre aisle.

For the reception layout we're going back to the horseshoe configuration rather than the round-table style we used in March: the head table faces the dance floor, with the family tables forming the arms. This gives the photographer a clean sightline from the gallery above.

The caterers need the kitchen access from the east service lane; remind Conor that the lane is shared with the marquee hire van and the florist delivery, all arriving between 10:00 and 11:30. Stagger them — marquee first, then catering, then flowers.

Sound check is pencilled for 15:00. Eoin needs the stage power confirmed before 14:00, so the afternoon prep timeline is tight. I'll be on-site from 09:00 and will call you if anything shifts.

Outstanding questions for the couple: (1) table number style — printed cards or acrylic stands? (2) is the seating chart final? We have three RSVPs still pending as of today. (3) do they want the bar to open at arrival or after photos?`,
  status: "active",
  priority: "urgent",
  assigneeIds: ["niamh", "conor"],
  dueDate: "Thu 23 Jul",
  tags: ["maria-james", "venue"],
  project: "The Orchard, Events",
  projectSlug: "the-orchard",
  createdBy: "niamh",
  createdAt: "2026-07-14T09:00:00+01:00",
  updatedAt: "2026-07-21T08:30:00+01:00",
  estimate: "3h",
  subtasks: [
    { id: "st-01", title: "Confirm terrace vs marquee call by Wednesday", status: "done" },
    { id: "st-02", title: "Lay out chair plan (112 guests, horseshoe)", status: "done" },
    { id: "st-03", title: "Brief east-lane delivery sequence to vendors", status: "active" },
    { id: "st-04", title: "Confirm stage power outlet timing with Eoin", status: "active" },
    { id: "st-05", title: "Get table number style decision from couple", status: "queued" },
    { id: "st-06", title: "Chase 3 outstanding RSVPs", status: "queued" },
    { id: "st-07", title: "Finalise bar-open timing with the couple", status: "queued" },
  ],
  resources: [
    {
      id: "res-lab-01",
      provider: "google_doc",
      title: "Venue layout plan — July 2026",
      url: "#",
      addedBy: "niamh",
      addedAt: "2026-07-14T09:10:00+01:00",
    },
    {
      id: "res-lab-02",
      provider: "figma",
      title: "Chair + table arrangement mockup",
      url: "#",
      addedBy: "niamh",
      addedAt: "2026-07-15T11:20:00+01:00",
    },
    {
      id: "res-lab-03",
      provider: "github",
      title: "Venue ops runbook v2.1",
      url: "#",
      addedBy: "niamh",
      addedAt: "2026-07-16T14:00:00+01:00",
    },
    {
      id: "res-lab-04",
      provider: "upload",
      title: "South terrace photograph — May setup.jpg",
      url: "#",
      addedBy: "niamh",
      addedAt: "2026-07-17T09:30:00+01:00",
      size: "2.4 MB",
    },
  ],
  conversation: [
    {
      kind: "activity",
      id: "act-01",
      authorId: "niamh",
      text: "created this task",
      createdAt: "2026-07-14T09:00:00+01:00",
    },
    {
      kind: "comment",
      id: "cmt-01",
      authorId: "conor",
      body: "Flagging the east lane timing now — the marquee van is a long-wheel-base and needs at least 15 mins to reverse in and out. We should keep a 20-min buffer between each delivery.",
      createdAt: "2026-07-14T10:15:00+01:00",
    },
    {
      kind: "activity",
      id: "act-02",
      authorId: "niamh",
      text: "added resource 'Venue layout plan — July 2026'",
      createdAt: "2026-07-14T09:10:00+01:00",
    },
    {
      kind: "comment",
      id: "cmt-02",
      authorId: "niamh",
      body: "Good call. I'll build 25-min windows: marquee 10:00, catering 10:25, flowers 10:55. That also gives Aoife time to start dressing the tables while Conor's still setting up the kitchen.",
      createdAt: "2026-07-14T10:40:00+01:00",
    },
    {
      kind: "activity",
      id: "act-03",
      authorId: "niamh",
      text: "moved from Queued to In progress",
      createdAt: "2026-07-15T09:00:00+01:00",
    },
    {
      kind: "comment",
      id: "cmt-03",
      authorId: "siobhan",
      body: "Ceremony side note: the arbour needs to be in position before 09:30 or the flower delivery won't be able to dress it in time. Can we lock in the arbour placement as a separate task?",
      createdAt: "2026-07-15T11:30:00+01:00",
    },
    {
      kind: "activity",
      id: "act-04",
      authorId: "niamh",
      text: "added resource 'Chair + table arrangement mockup'",
      createdAt: "2026-07-15T11:20:00+01:00",
    },
    {
      kind: "comment",
      id: "cmt-04",
      authorId: "niamh",
      body: "Arbour timing is in the florist brief — Aoife, can you confirm you'll arrive at 09:45 with the arbour florals and that placement will be done by 10:15?",
      createdAt: "2026-07-15T12:00:00+01:00",
    },
    {
      kind: "comment",
      id: "cmt-05",
      authorId: "aoife",
      body: "Yes — I'll arrive at 09:40 and have arbour dressing done by 10:10. I need the arbour frame positioned before I arrive though, that's on the venue team.",
      createdAt: "2026-07-16T08:15:00+01:00",
    },
    {
      kind: "activity",
      id: "act-05",
      authorId: "eoin",
      text: "updated the estimate",
      createdAt: "2026-07-17T14:00:00+01:00",
    },
    {
      kind: "comment",
      id: "cmt-06",
      authorId: "eoin",
      body: "Power confirmed for stage — the outdoor socket near the west wall will handle the PA and the band's backline. I'll need the power confirmed no later than 13:45 on the day so I can run the cable before guests arrive for photos.",
      createdAt: "2026-07-17T15:30:00+01:00",
    },
  ],
  blockedByIds: [],
  parentId: null,
};

/** t-lab-02: Blocked task — depends on another task, single-paragraph brief */
const FLORIST_BRIEF: LabDetailTask = {
  id: "t-lab-02",
  title: "Final stem count to the florist",
  brief: `Looser, wilder look for this wedding — fewer roses, more foliage. Aoife has the mood board but needs the confirmed guest count before she can finalise quantities for the table arrangements and buttonholes. The count is locked once the final RSVP comes in, which is blocking this task. Target: send by 09:00 Monday.`,
  status: "waiting",
  priority: "high",
  assigneeIds: ["niamh", "aoife"],
  dueDate: "Mon 27 Jul",
  tags: ["maria-james", "flowers"],
  project: "The Orchard, Events",
  projectSlug: "the-orchard",
  createdBy: "niamh",
  createdAt: "2026-07-15T10:00:00+01:00",
  updatedAt: "2026-07-20T16:00:00+01:00",
  estimate: "1h",
  subtasks: [
    { id: "st-f-01", title: "Wait for final RSVP count", status: "active" },
    { id: "st-f-02", title: "Confirm buttonhole quantity with couple", status: "queued" },
    { id: "st-f-03", title: "Send stem count email to Aoife", status: "queued" },
  ],
  resources: [
    {
      id: "res-lab-f-01",
      provider: "google_doc",
      title: "Floral mood board — Maria & James",
      url: "#",
      addedBy: "aoife",
      addedAt: "2026-07-15T10:30:00+01:00",
    },
  ],
  conversation: [
    {
      kind: "activity",
      id: "act-f-01",
      authorId: "niamh",
      text: "created this task",
      createdAt: "2026-07-15T10:00:00+01:00",
    },
    {
      kind: "comment",
      id: "cmt-f-01",
      authorId: "aoife",
      body: "Happy to wait for the final count — just flag me as soon as it's in and I'll turn the order around same day.",
      createdAt: "2026-07-15T10:45:00+01:00",
    },
    {
      kind: "activity",
      id: "act-f-02",
      authorId: "niamh",
      text: "moved from Queued to Waiting",
      createdAt: "2026-07-16T09:00:00+01:00",
    },
  ],
  blockedByIds: ["t-lab-03"],
  parentId: null,
};

/** t-lab-03: The blocker task */
const RSVP_CHASE: LabDetailTask = {
  id: "t-lab-03",
  title: "Chase final 3 RSVPs from the couple's guest list",
  brief: `Three RSVPs are still outstanding. The couple has been notified but hasn't followed up. We need a confirmed headcount by Friday to unblock the florist brief and finalise the catering numbers. Contact: reach out through the couple first — we do not contact guests directly.`,
  status: "active",
  priority: "high",
  assigneeIds: ["niamh"],
  dueDate: "Fri 25 Jul",
  tags: ["maria-james", "admin"],
  project: "The Orchard, Events",
  projectSlug: "the-orchard",
  createdBy: "niamh",
  createdAt: "2026-07-18T09:00:00+01:00",
  updatedAt: "2026-07-21T08:00:00+01:00",
  estimate: "30m",
  subtasks: [
    { id: "st-r-01", title: "Email the couple with the outstanding names", status: "done" },
    { id: "st-r-02", title: "Follow-up call if no reply by Thursday", status: "queued" },
  ],
  resources: [],
  conversation: [
    {
      kind: "activity",
      id: "act-r-01",
      authorId: "niamh",
      text: "created this task",
      createdAt: "2026-07-18T09:00:00+01:00",
    },
    {
      kind: "comment",
      id: "cmt-r-01",
      authorId: "niamh",
      body: "Email sent to the couple this morning — waiting on their reply before we chase.",
      createdAt: "2026-07-21T08:30:00+01:00",
    },
  ],
  blockedByIds: [],
  parentId: null,
};

/** t-lab-04: Done task */
const MARQUEE_CONFIRM: LabDetailTask = {
  id: "t-lab-04",
  title: "Confirm marquee sides with the hire company",
  brief: `County Marquee Hire needs confirmation of the open-sided vs closed-sided configuration by Thursday. For the July 20 wedding, the forecast is checking clear, so we're going open-sided with the full terrace plan. If rain appears in the 72-hour window, escalate to emergency closed configuration — they need 4 hours' notice.`,
  status: "done",
  priority: "normal",
  assigneeIds: ["niamh"],
  dueDate: "Thu 23 Jul",
  tags: ["maria-james", "venue"],
  project: "The Orchard, Events",
  projectSlug: "the-orchard",
  createdBy: "niamh",
  createdAt: "2026-07-16T14:00:00+01:00",
  updatedAt: "2026-07-21T09:00:00+01:00",
  estimate: null,
  subtasks: [
    { id: "st-m-01", title: "Check Thursday forecast", status: "done" },
    { id: "st-m-02", title: "Call County Marquee Hire", status: "done" },
  ],
  resources: [],
  conversation: [
    {
      kind: "activity",
      id: "act-m-01",
      authorId: "niamh",
      text: "created this task",
      createdAt: "2026-07-16T14:00:00+01:00",
    },
    {
      kind: "comment",
      id: "cmt-m-01",
      authorId: "niamh",
      body: "Confirmed open-sided. Marquee hire is aware of the rain escalation protocol.",
      createdAt: "2026-07-21T09:00:00+01:00",
    },
    {
      kind: "activity",
      id: "act-m-02",
      authorId: "niamh",
      text: "marked this complete",
      createdAt: "2026-07-21T09:01:00+01:00",
    },
  ],
  blockedByIds: [],
  parentId: null,
};

/** t-lab-05: Sound/AV task — queued */
const AV_SOUND: LabDetailTask = {
  id: "t-lab-05",
  title: "Sound check and PA walk-through with Eoin",
  brief: `15:00 sound check on the day. Eoin needs stage power confirmed before 14:00. Run through the ceremony music cues, the first-dance playlist, and the PA levels for the speeches. The microphone for the officiant is a lapel; the speeches use a handheld.`,
  status: "queued",
  priority: "normal",
  assigneeIds: ["eoin", "niamh"],
  dueDate: "Sat 26 Jul",
  tags: ["maria-james", "av"],
  project: "The Orchard, Events",
  projectSlug: "the-orchard",
  createdBy: "niamh",
  createdAt: "2026-07-17T10:00:00+01:00",
  updatedAt: "2026-07-17T10:00:00+01:00",
  estimate: "2h",
  subtasks: [
    { id: "st-av-01", title: "Confirm stage power outlet (west wall)", status: "queued" },
    { id: "st-av-02", title: "Test lapel mic for officiant", status: "queued" },
    { id: "st-av-03", title: "Run through ceremony music cues", status: "queued" },
    { id: "st-av-04", title: "Test PA levels for speeches", status: "queued" },
  ],
  resources: [],
  conversation: [
    {
      kind: "activity",
      id: "act-av-01",
      authorId: "niamh",
      text: "created this task",
      createdAt: "2026-07-17T10:00:00+01:00",
    },
  ],
  blockedByIds: [],
  parentId: null,
};

export const LAB_TASKS: LabDetailTask[] = [
  VENUE_PLAN,
  FLORIST_BRIEF,
  RSVP_CHASE,
  MARQUEE_CONFIRM,
  AV_SOUND,
];

export function taskById(id: string): LabDetailTask | undefined {
  return LAB_TASKS.find((t) => t.id === id);
}

/** Tasks adjacency for j/k navigation */
export function adjacentTask(id: string, direction: "prev" | "next"): LabDetailTask | null {
  const idx = LAB_TASKS.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const next = direction === "next" ? idx + 1 : idx - 1;
  return LAB_TASKS[next] ?? null;
}

// Provider label helper (matches production resources-section.tsx)
export function providerLabel(provider: LabDetailResourceProvider): string {
  switch (provider) {
    case "google_doc": return "Doc";
    case "figma":      return "Figma";
    case "github":     return "GitHub";
    case "upload":     return "File";
    case "url":        return "Link";
    default:           return provider;
  }
}

export function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
