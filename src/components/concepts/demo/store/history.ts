/**
 * The canonical world's past: a believable event log for every task and
 * project, built so that replaying it lands exactly on today's records.
 *
 * Task history is synthesised from each task's own fields (created, start,
 * since, doneOn, waitingOn), plus a few hand-written stories: the marquee
 * sides slipped, the barn slates were delayed, the firelight shoot moved.
 * Project history and updates are written out by hand.
 *
 * Server-safe. Imports nothing from ./data, so ./data can build its initial
 * state from these functions.
 */

import { TODAY, addDays } from "./dates";
import type { IsoDate, PersonId, Project, ProjectEvent, ProjectId, ProjectUpdate, Task, TaskEvent, TaskStatus } from "./types";

/* ── Task stories ───────────────────────────────────────────────────── */

type TaskStory = {
  /** Due-date moves: [on, the old date]. The new date is the next move's old date, or today's due. */
  due?: [IsoDate, IsoDate][];
  /** Priority changes: [on, the old priority]. */
  priority?: [IsoDate, string][];
  /** Owner changes: [on, the old owner]. */
  owner?: [IsoDate, PersonId][];
  /** Notes: [on, text, by]. */
  notes?: [IsoDate, string, PersonId?][];
};

/** The moments the story needs. Everything else is derived from the task's fields. */
const TASK_STORIES: Record<string, TaskStory> = {
  // Mara & Finn: the final numbers slipped on 18 Sep, which tipped the wedding to At risk.
  "mf-7": {
    due: [["2026-09-18", "2026-09-17"]],
    priority: [["2026-09-18", "high"]],
    notes: [["2026-09-18", "Moved to 30 Sep: the numbers go once Mara approves the seating plan.", "aoife"]],
  },
  // The marquee sides slipped when quote v3 came in.
  "mf-13": {
    due: [["2026-09-23", "2026-09-24"]],
    priority: [["2026-09-23", "high"]],
    notes: [["2026-09-23", "Quote v3 in from Lawlor Hire: €3,850. They hold the clear sides until Monday.", "aoife"]],
  },
  "mf-41": { priority: [["2026-09-21", "high"]] },
  "mf-26": { owner: [["2026-09-23", "aoife"]] },
  "mf-33": { notes: [["2026-09-22", "Rang the shop. They will check with their accounts team.", "aoife"]] },
  // Barn roof: the quarry is behind, and Farrell Build moved their finish.
  "br-9": {
    due: [["2026-09-16", "2026-09-16"]],
    notes: [["2026-09-16", "Valentia Slate are behind at the quarry. Delivery moves to Wed 30 Sep.", "tomas"]],
  },
  "br-6": {
    priority: [["2026-09-18", "high"]],
    notes: [["2026-09-18", "Farrell Build now say 13 Nov. Asked for the revised dates in writing.", "tomas"]],
  },
  // Winter launch: the firelight shoot moved to Monday.
  "wl-8": { due: [["2026-09-22", "2026-09-24"]] },
  "wl-5": { priority: [["2026-09-23", "high"]] },
};

/** Days between nudges on a waiting task, and the most a task gets before today. */
const NUDGE_EVERY = 4;
const MAX_NUDGES = 2;

const KIND_RANK: Record<TaskEvent["kind"], number> = {
  created: 0,
  status: 1,
  waiting: 2,
  owner: 3,
  due: 4,
  priority: 5,
  note: 6,
  nudged: 7,
  removed: 8,
};

function chain<T extends string>(moves: [IsoDate, T][] | undefined, now: T | undefined): { on: IsoDate; from: T; to: T | undefined }[] {
  if (!moves) return [];
  return moves.map(([on, from], i) => ({ on, from, to: i + 1 < moves.length ? moves[i + 1][1] : now }));
}

/** One task's past, oldest first. Replays to the task's current status, on `since`. */
export function synthesizeTaskHistory(t: Task, lead: PersonId): TaskEvent[] {
  const out: TaskEvent[] = [];
  const by = t.owner;
  out.push({ taskId: t.id, on: t.created, kind: "created", to: "todo", by: lead });

  const step = (on: IsoDate, from: TaskStatus, to: TaskStatus) => out.push({ taskId: t.id, on, kind: "status", from, to, by });
  // Work began on `start` when that falls after creation and before the current status began.
  const began = (until: IsoDate) => !!t.start && t.start >= t.created && t.start < until;

  switch (t.status) {
    case "todo":
      break;
    case "doing":
      step(t.since, "todo", "doing");
      break;
    case "review":
      if (began(t.since)) {
        step(t.start!, "todo", "doing");
        step(t.since, "doing", "review");
      } else step(t.since, "todo", "review");
      break;
    case "waiting": {
      const since = t.since;
      if (began(since)) {
        step(t.start!, "todo", "doing");
        step(since, "doing", "waiting");
      } else step(since, "todo", "waiting");
      if (t.waitingOn) {
        out.push({ taskId: t.id, on: since, kind: "waiting", to: t.waitingOn.who, by });
        for (let n = 1, d = addDays(t.waitingOn.since, NUDGE_EVERY); n <= MAX_NUDGES && d < TODAY; n++, d = addDays(d, NUDGE_EVERY)) {
          out.push({ taskId: t.id, on: d, kind: "nudged", to: t.waitingOn.who, by });
        }
      }
      break;
    }
    case "done":
      if (began(t.since)) {
        step(t.start!, "todo", "doing");
        step(t.since, "doing", "done");
      } else step(t.since, "todo", "done");
      break;
  }

  const story = TASK_STORIES[t.id];
  if (story) {
    for (const m of chain(story.due, t.due)) out.push({ taskId: t.id, on: m.on, kind: "due", from: m.from, to: m.to, by });
    for (const m of chain(story.priority, t.priority)) out.push({ taskId: t.id, on: m.on, kind: "priority", from: m.from, to: m.to, by });
    for (const m of chain<string>(story.owner, t.owner)) out.push({ taskId: t.id, on: m.on, kind: "owner", from: m.from, to: m.to, by: lead });
    for (const [on, note, who] of story.notes ?? []) out.push({ taskId: t.id, on, kind: "note", note, by: who ?? by });
  }

  // Oldest first; on one day, creation before moves, moves in the order they happened.
  return out
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.on.localeCompare(b.e.on) || KIND_RANK[a.e.kind] - KIND_RANK[b.e.kind] || a.i - b.i)
    .map(({ e }) => e);
}

/** Every task's past in one log, oldest first. */
export function synthesizeHistory(tasks: readonly Task[], projects: readonly Project[]): TaskEvent[] {
  const leadOf = new Map(projects.map((p) => [p.id, p.lead]));
  const all = tasks.flatMap((t) => synthesizeTaskHistory(t, leadOf.get(t.project) ?? t.owner));
  return all.map((e, i) => ({ e, i })).sort((a, b) => a.e.on.localeCompare(b.e.on) || a.i - b.i).map(({ e }) => e);
}

/* ── Project history and updates ────────────────────────────────────── */

type ProjectStory = Omit<ProjectEvent, "projectId"> & { projectId: ProjectId };

/** Health, lead and date changes, written out. Each project's last health event matches its stored health and reason. */
const PROJECT_STORIES: ProjectStory[] = [
  {
    projectId: "mara-finn",
    on: "2026-09-18",
    kind: "health",
    from: "on_track",
    to: "at_risk",
    reason: "Final numbers and the marquee sides are late",
    by: "aoife",
  },
  {
    projectId: "mara-finn",
    on: "2026-09-24",
    kind: "health",
    from: "at_risk",
    to: "at_risk",
    reason: "Two jobs are late, seating plan v4 is with Mara, and Lawlor Hire release the clear marquee sides on Monday.",
    by: "aoife",
  },
  {
    projectId: "barn-roof",
    on: "2026-09-16",
    kind: "health",
    from: "on_track",
    to: "at_risk",
    reason: "Valentia Slate moved the delivery from 16 Sep to 30 Sep.",
    by: "tomas",
  },
  {
    projectId: "barn-roof",
    on: "2026-09-23",
    kind: "health",
    from: "at_risk",
    to: "off_track",
    reason: "Farrell Build now finish on 13 Nov, two weeks after our date. Three jobs are late and the slates land on 30 Sep.",
    by: "tomas",
  },
  {
    projectId: "winter-launch",
    on: "2026-09-19",
    kind: "health",
    from: "on_track",
    to: "at_risk",
    reason: "The price list and the winter menu missed 18 Sep.",
    by: "siobhan",
  },
  {
    projectId: "winter-launch",
    on: "2026-09-24",
    kind: "health",
    from: "at_risk",
    to: "off_track",
    reason: "Four jobs are late: the price list, the winter menu and the brochure copy hold up the print run on 2 Oct.",
    by: "siobhan",
  },
  { projectId: "christmas", on: "2026-09-07", kind: "lead", from: "orla", to: "niamh", by: "orla" },
  { projectId: "food-fair", on: "2026-09-16", kind: "date", from: "2026-11-27", to: "2026-12-04", by: "orla" },
  {
    projectId: "keane-legal",
    on: "2026-09-22",
    kind: "health",
    from: "on_track",
    to: "at_risk",
    reason: "Waiting on Mark for the headcount, and the AV quotes are late.",
    by: "orla",
  },
];

/** Plain updates, written out. Health changes post their reason too (added below). */
const PLAIN_UPDATES: Omit<ProjectUpdate, "id" | "kind">[] = [
  { projectId: "mara-finn", on: "2026-09-21", by: "aoife", text: "Mara approved seating plan v3: 118 guests at 15 tables." },
  { projectId: "mara-finn", on: "2026-09-25", by: "dev", text: "Menu tasting at 16:00 in the snug. Both mothers are coming." },
  { projectId: "harvest", on: "2026-09-23", by: "niamh", text: "Seats are €65, wine pairing included. Bookings open Monday at 10:00." },
  { projectId: "kavanagh", on: "2026-09-22", by: "orla", text: "Invitation drafted with Sinéad. Keep it quiet: Lena does not know." },
  { projectId: "barn-roof", on: "2026-09-22", by: "tomas", text: "The old slates are off. Site meeting with Farrell Build this afternoon." },
  { projectId: "christmas", on: "2026-09-07", by: "orla", text: "Niamh leads the markets from today." },
  { projectId: "christmas", on: "2026-09-22", by: "niamh", text: "Both market weekends are on the calendar: 5 to 6 and 12 to 13 Dec." },
  { projectId: "ada-theo", on: "2026-09-24", by: "aoife", text: "Deposit in from Ada and Theo. First call is Fri 2 Oct." },
  { projectId: "food-fair", on: "2026-09-16", by: "orla", text: "The festival moved the fair a week, to Fri 4 Dec." },
];

/** Each project's past: created on its start, the written stories, wrapped on its wrap day. */
export function synthesizeProjectHistory(projects: readonly Project[]): { events: ProjectEvent[]; updates: ProjectUpdate[] } {
  const events: ProjectEvent[] = [];
  const updates: Omit<ProjectUpdate, "id">[] = [];
  for (const p of projects) {
    const firstLead = PROJECT_STORIES.find((e) => e.projectId === p.id && e.kind === "lead")?.from as PersonId | undefined;
    events.push({ projectId: p.id, on: p.start, kind: "created", by: firstLead ?? p.lead });
  }
  for (const e of PROJECT_STORIES) {
    events.push({ ...e });
    if (e.kind === "health" && e.reason) updates.push({ projectId: e.projectId, on: e.on, by: e.by, text: e.reason, kind: "health" });
  }
  for (const u of PLAIN_UPDATES) updates.push({ ...u, kind: "update" });
  for (const p of projects) {
    if (!p.wrapped) continue;
    events.push({ projectId: p.id, on: p.wrapped.on, kind: "wrapped", by: p.lead });
    updates.push({ projectId: p.id, on: p.wrapped.on, by: p.lead, text: `Wrapped: ${p.wrapped.stat}.`, kind: "wrapped" });
  }
  const sortedEvents = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.on.localeCompare(b.e.on) || a.i - b.i).map(({ e }) => e);
  const sortedUpdates = updates
    .map((u, i) => ({ u, i }))
    .sort((a, b) => a.u.on.localeCompare(b.u.on) || a.i - b.i)
    .map(({ u }, n) => ({ id: `upd-${n + 1}`, ...u }));
  // Plain updates also stand in the event log, so a timeline reads in one place.
  for (const u of sortedUpdates) if (u.kind === "update") sortedEvents.push({ projectId: u.projectId, on: u.on, kind: "update", to: u.id, text: u.text, by: u.by });
  return {
    events: sortedEvents.map((e, i) => ({ e, i })).sort((a, b) => a.e.on.localeCompare(b.e.on) || a.i - b.i).map(({ e }) => e),
    updates: sortedUpdates,
  };
}
