/**
 * Types for the demo's one shared sample store. Every surface in /demo reads
 * the same tasks, projects, people, calendar blocks and files from here, so a
 * count, an owner or a date is the same wherever it appears.
 *
 * Server-safe: types only.
 */

import type { TaskStatus } from "../../tasks/status";
import type { PEOPLE as WORLD_PEOPLE, PROJECTS as WORLD_PROJECTS } from "../world";

export type { TaskStatus };

/** "2026-09-25". Day precision, no time zone. */
export type IsoDate = string;
/** "09:15", 24-hour clock. */
export type ClockTime = string;

/* ── People ─────────────────────────────────────────────────────────── */

/** The team and the couple, as named in demo/world.ts. */
export type WorldPersonId = (typeof WORLD_PEOPLE)[number]["id"];
/** Clients and contacts outside the world file, used by the ledger's extra projects. */
export type ExtraPersonId = "ada" | "theo" | "sinead" | "mark" | "ruth";
export type PersonId = WorldPersonId | ExtraPersonId;
/** The seven people who work at The Orchard. Only they own tasks. */
export type TeamPersonId = Exclude<WorldPersonId, "mara" | "finn">;

export type Person = {
  id: PersonId;
  name: string;
  first: string;
  initials: string;
  role: string;
  /** --v3-project-n. Never amber, orange or red (5 to 7). */
  hue: number;
  /** A client or contact: can be waited on, never owns a task. */
  external?: boolean;
  /** Which project a client belongs to. */
  clientOf?: ProjectId;
};

/* ── Suppliers ──────────────────────────────────────────────────────── */

export type SupplierId =
  | "bloom"
  | "lawlor"
  | "lindens"
  | "kinsale-wine"
  | "weir"
  | "harbour"
  | "printhaus"
  | "linen-loft"
  | "sugar-loaf"
  | "aisling-moran"
  | "fern-photo"
  | "kerr"
  | "farrell"
  | "rossa"
  | "valentia"
  | "hayes"
  | "snapbox"
  | "barry"
  | "pop-party"
  | "safecert";

export type Supplier = {
  id: SupplierId;
  name: string;
  /** What they are, lower case: "florist", "marquee hire". */
  what: string;
};

/* ── Projects ───────────────────────────────────────────────────────── */

export type WorldProjectId = (typeof WORLD_PROJECTS)[number]["id"];
export type ExtraProjectId =
  | "keane-legal"
  | "food-fair"
  | "open-day"
  | "staff-rota"
  | "photo-shoot"
  | "wine-list"
  | "path-lighting"
  | "venue-upkeep"
  | "doyle-chen"
  | "garden-parties"
  | "bar-fitout"
  | "spring-tastings";
export type ProjectId = WorldProjectId | ExtraProjectId;

export type Health = "on_track" | "at_risk" | "off_track";
export type ProjectKind = "wedding" | "event" | "season" | "works" | "marketing" | "operations";

export type Milestone = { id: string; title: string; date: IsoDate; done: boolean };

/** One shared group vocabulary per project, e.g. the wedding's "Food and drink". */
export type Workstream = { id: string; name: string };

export type Project = {
  id: ProjectId;
  name: string;
  short: string;
  /** --v3-project-n. */
  hue: number;
  /** The day itself, or when it is due. */
  date: IsoDate;
  /** When work began. */
  start: IsoDate;
  /** A season that runs past its date, to its last day. */
  end?: IsoDate;
  /** Stored health, set by the lead. Off track and At risk always carry a reason. */
  health: Health;
  healthReason?: string;
  lead: TeamPersonId;
  people: PersonId[];
  kind: ProjectKind;
  /** One short line: what is true about it now. */
  note: string;
  milestones: Milestone[];
  workstreams: Workstream[];
  /** Task id prefix: "mf" makes "mf-12". */
  prefix: string;
  /** One of the seven projects in demo/world.ts: the main, fully told stories. */
  canon: boolean;
  /** Too new to judge: health shows On track, but forecasts should say it is early. */
  tooEarly?: boolean;
  /**
   * A finished project. Its tasks are not kept as records; these figures stand
   * in for them so the ledger can still show "41 of 41".
   */
  wrapped?: { on: IsoDate; tasks: number; stat: string };
  /** The template a project made during a review was seeded from. */
  template?: string;
};

/* ── Tasks ──────────────────────────────────────────────────────────── */

export type Priority = "none" | "low" | "medium" | "high" | "urgent";

export type Subtask = { id: string; title: string; done: boolean };

export type WaitingOn = {
  /** A person id (usually a client) or a supplier id. */
  who: PersonId | SupplierId;
  /** The day the wait began. */
  since: IsoDate;
};

export type Task = {
  /** "mf-12": the project's prefix and a number. */
  id: string;
  title: string;
  project: ProjectId;
  /** A workstream id from the project's own list. */
  workstream: string;
  status: TaskStatus;
  owner: TeamPersonId;
  /** Other people it leans on. */
  helpers?: PersonId[];
  /** Undefined means no date. */
  due?: IsoDate;
  /** When work is planned to start (the overview's bar start). */
  start?: IsoDate;
  created: IsoDate;
  /** The day it entered its current status. Drives ages and stuck. */
  since: IsoDate;
  /** Set exactly when status is "done". */
  doneOn?: IsoDate;
  priority: Priority;
  /** Set exactly when status is "waiting". */
  waitingOn?: WaitingOn;
  supplier?: SupplierId;
  /** Euro. */
  cost?: number;
  paid?: boolean;
  guests?: number;
  notes?: string;
  subtasks?: Subtask[];
  labels?: string[];
  /** Calendar estimate in minutes. */
  estimate?: number;
  /** Work that follows the project's date on purpose (return the marquee). */
  afterEvent?: boolean;
  /** Where on the grounds it happens, for event work (the list's Room column). */
  room?: Room;
};

/** The Orchard's rooms and grounds. */
export type Room = "Long barn" | "Orchard marquee" | "Walled garden" | "Terrace" | "Orchard hall";

/* ── Task history ───────────────────────────────────────────────────── */

/**
 * What happened to a task. "created" carries the status it was born with in
 * `to`; "status" carries `from` and `to` statuses; "owner", "due" and
 * "priority" carry the old and new values; "waiting" carries who in `to`;
 * "nudged" carries who was nudged in `to`; "note" carries its text in `note`.
 * "removed" is written when a task is deleted during a review.
 */
export type TaskEventKind = "created" | "status" | "owner" | "due" | "priority" | "waiting" | "nudged" | "note" | "removed";

export type TaskEvent = {
  taskId: string;
  on: IsoDate;
  kind: TaskEventKind;
  from?: string;
  to?: string;
  by?: PersonId;
  /** Free text for "note" and "nudged". */
  note?: string;
};

/* ── Project history and updates ────────────────────────────────────── */

/**
 * What happened to a project. "health" carries `from`, `to` and the `reason`
 * (from and to are equal when only the reason changed); "lead" and "date" carry
 * old and new values; "update" carries the update's id in `to` and its text in
 * `text`; "milestone" carries the milestone id in `to` and "done" or "open" in
 * `reason`; "note" carries the old and new note.
 */
export type ProjectEventKind = "created" | "health" | "lead" | "date" | "update" | "wrapped" | "unwrapped" | "milestone" | "note";

export type ProjectEvent = {
  projectId: ProjectId;
  on: IsoDate;
  kind: ProjectEventKind;
  from?: string;
  to?: string;
  reason?: string;
  text?: string;
  by: PersonId;
};

/** One post in a project's updates feed. Health changes post their reason here too. */
export type ProjectUpdate = {
  id: string;
  projectId: ProjectId;
  on: IsoDate;
  by: PersonId;
  text: string;
  kind: "update" | "health" | "wrapped";
};

/* ── Calendar ───────────────────────────────────────────────────────── */

/** A task placed on someone's calendar. */
export type Block = {
  id: string;
  taskId: string;
  day: IsoDate;
  start: ClockTime;
  minutes: number;
  person: TeamPersonId;
};

/** Something on the calendar that is not a task. */
export type FixedEvent = {
  id: string;
  title: string;
  day: IsoDate;
  start: ClockTime;
  minutes: number;
  /** Whose calendar it sits on. "team" is everyone. */
  person: TeamPersonId | "team";
  personal?: boolean;
  where?: string;
  project?: ProjectId;
};

export type DayWindow = { open: ClockTime; start: ClockTime; end: ClockTime };

/** The calendar owner's day: working window and the minutes set aside for tasks. */
export type DayCapacity = {
  day: IsoDate;
  /** Null is a day off. */
  window: DayWindow | null;
  minutes: number;
  note: string;
};

/* ── Files ──────────────────────────────────────────────────────────── */

export type FileKind = "sheet" | "doc" | "pdf" | "image" | "design" | "link";
export type FileState = "approved" | "awaiting" | "draft" | "signed";

export type FileRef = {
  id: string;
  title: string;
  project: ProjectId;
  kind: FileKind;
  by: PersonId;
  date: IsoDate;
  /** Versions of one document share a series. */
  series?: string;
  version: number;
  state: FileState;
  approvedBy?: PersonId;
  approvedOn?: IsoDate;
  /** Who still has to approve it, when state is "awaiting". */
  awaiting?: PersonId;
  /** The task it belongs to. */
  taskId?: string;
  /** One line a surface can quote. */
  summary?: string;
};

/* ── State ──────────────────────────────────────────────────────────── */

/**
 * Everything that can change during a review: tasks, calendar blocks, the
 * task history, projects, their history and their updates feed. People,
 * suppliers and files are fixed.
 */
export type DemoState = {
  tasks: Task[];
  blocks: Block[];
  /** Every task's events, oldest first. */
  history: TaskEvent[];
  /** Every project, active and wrapped, with the lead's edits. */
  projects: Project[];
  /** Every project's events, oldest first. */
  projectEvents: ProjectEvent[];
  /** Every project's updates feed, oldest first. */
  updates: ProjectUpdate[];
};

/** A narrowing for selectors: one project, one owner, or anyone involved. */
export type Scope = {
  project?: ProjectId;
  /** Tasks this person owns. */
  owner?: PersonId;
  /** Tasks this person owns or helps with. */
  person?: PersonId;
};
