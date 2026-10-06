/* The Tasks list's view of the demo store. Every row is a store task, mapped
   to the sheet's typed cells, and every edit goes back through the store's
   mutations, so the list, the board and the calendar always agree. Only the
   sheet's own furniture (sheets, columns, widths, custom fields) lives here. */

import { TASK_STATUSES, type TaskStatus } from "../../tasks/status";
import { supplierByName } from "../../tasks/grammar";
import {
  TEAM,
  TODAY as STORE_TODAY,
  ageInStatus,
  fmtDate as storeFmtDate,
  fmtDay as storeFmtDay,
  isStuck as storeIsStuck,
  personById,
  supplierById,
  waitingOnName,
  type ProjectId,
  type Room,
  type Task,
  type TeamPersonId,
} from "../../demo/store";
import type { TaskPatch } from "../../demo/store/client";
import { isActiveProject, liveActiveProjects, liveProject, liveState } from "../../tasks/projects";

export const TODAY = STORE_TODAY; // Friday 25 Sep
const DAY = 86_400_000;

/** The shared Tasks vocabulary: the same five stages as the board. */
export type StatusId = TaskStatus;
export type PersonId = TeamPersonId;
export type EventId = ProjectId;
export type RoomId = "barn" | "marquee" | "garden" | "terrace" | "hall";
export type PriorityId = "urgent" | "high" | "medium" | "low";

export const STATUSES: { id: StatusId; name: string }[] = TASK_STATUSES.map((x) => ({ id: x.key, name: x.name }));

/** Highest first. Priority is drawn in ink, never in warning colours. */
export const PRIORITIES: { id: PriorityId; name: string; rank: number }[] = [
  { id: "urgent", name: "Urgent", rank: 4 },
  { id: "high", name: "High", rank: 3 },
  { id: "medium", name: "Medium", rank: 2 },
  { id: "low", name: "Low", rank: 1 },
];
export const PRIORITY_IDS = PRIORITIES.map((x) => x.id);

const tone = (hue?: number) => `var(--v3-project-${hue ?? 2})`;

/** The team: the only people who own tasks. */
export const PEOPLE = Object.fromEntries(
  TEAM.map((id) => {
    const p = personById(id)!;
    return [id, { name: p.first, full: p.name, initial: p.initials, tone: tone(p.hue) }];
  }),
) as Record<PersonId, { name: string; full: string; initial: string; tone: string }>;
export const PERSON_IDS = [...TEAM] as PersonId[];

export type EventInfo = { name: string; short: string; tone: string; date: string; guests: number };

/** Expected guests per project: the largest headcount any of its tasks plans for. Cached per task list. */
const guestCache = new WeakMap<readonly Task[], Map<string, number>>();
function guestsOf(project: string): number {
  const tasks = liveState().tasks;
  let m = guestCache.get(tasks);
  if (!m) {
    m = new Map();
    for (const t of tasks) if (t.guests) m.set(t.project, Math.max(m.get(t.project) ?? 0, t.guests));
    guestCache.set(tasks, m);
  }
  return m.get(project) ?? 0;
}

/**
 * One project as the sheet's Event column knows it, read from the live
 * store: a project made this session is here, with its own hue. Undefined
 * for an id that is not a project, so callers guard.
 */
export function eventOf(id: string | null | undefined): EventInfo | undefined {
  const p = liveProject(id);
  return p ? { name: p.name, short: p.short, tone: tone(p.hue), date: p.date, guests: guestsOf(p.id) } : undefined;
}

/** The active projects' ids, live: wrapped projects drop out. */
export const eventIds = (): EventId[] => liveActiveProjects().map((p) => p.id) as EventId[];

/** The Orchard's five rooms and grounds, as the store names them (`Task.room`). */
export const ROOMS: Record<RoomId, { name: Room; seats: number }> = {
  barn: { name: "Long barn", seats: 150 },
  marquee: { name: "Orchard marquee", seats: 200 },
  garden: { name: "Walled garden", seats: 120 },
  terrace: { name: "Terrace", seats: 60 },
  hall: { name: "Orchard hall", seats: 180 },
};
export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];
const roomIdOf = (name?: Room): RoomId | null => ROOM_IDS.find((id) => ROOMS[id].name === name) ?? null;

export type CellValue = string | number | boolean | null;
export type Row = {
  id: string;
  table: string;
  cells: Record<string, CellValue>;
  /** The store task the row shows. */
  task: Task;
  /** Who a Waiting task is waiting on, for the nudge. */
  waitingOn?: string;
};

/** A store task as the sheet's cells. `extra` holds this view's own custom fields. */
export function taskToRow(t: Task, extra?: Record<string, CellValue>): Row {
  return {
    id: t.id,
    table: "main",
    task: t,
    waitingOn: waitingOnName(t),
    cells: {
      title: t.title,
      status: t.status,
      owner: t.owner,
      priority: t.priority === "none" ? null : t.priority,
      due: t.due ?? null,
      event: t.project,
      room: roomIdOf(t.room),
      supplier: t.supplier ? (supplierById(t.supplier)?.name ?? null) : null,
      cost: t.cost ?? null,
      paid: !!t.paid,
      guests: t.guests ?? null,
      notes: t.notes ?? null,
      ...extra,
    },
  };
}

/** The store fields the sheet's built-in columns write. */
export const STORE_COLUMNS = new Set(["title", "status", "owner", "priority", "due", "event", "room", "supplier", "cost", "paid", "guests", "notes"]);

/**
 * One cell's new value as a store patch, or null when the store can't hold
 * it (no owner, an unknown supplier, a project that isn't active).
 */
export function cellPatch(col: string, value: CellValue): TaskPatch | null {
  switch (col) {
    case "title":
      return typeof value === "string" && value.trim() ? { title: value.trim() } : null;
    case "status":
      return typeof value === "string" ? { status: value as StatusId } : null;
    case "owner":
      return typeof value === "string" && (TEAM as readonly string[]).includes(value) ? { owner: value as TeamPersonId } : null;
    case "priority":
      return { priority: (value as PriorityId | null) ?? "none" };
    case "due":
      return { due: typeof value === "string" ? value : undefined };
    case "event":
      return typeof value === "string" && isActiveProject(value) ? { project: value as ProjectId } : null;
    case "room":
      if (value == null || value === "") return { room: undefined };
      return typeof value === "string" && value in ROOMS ? { room: ROOMS[value as RoomId].name } : null;
    case "supplier": {
      if (value == null || value === "") return { supplier: undefined };
      const id = supplierByName(String(value));
      return id ? { supplier: id } : null;
    }
    case "cost":
      return { cost: typeof value === "number" ? value : undefined };
    case "paid":
      return { paid: value === true };
    case "guests":
      return { guests: typeof value === "number" ? value : undefined };
    case "notes":
      return { notes: typeof value === "string" && value ? value : undefined };
    default:
      return null;
  }
}

/** Days in the current status for started work, from the store. Null for To do and Done. */
export const rowAge = (r: Row): number | null => (r.task.status === "todo" || r.task.status === "done" ? null : ageInStatus(r.task));
export const rowStuck = (r: Row) => storeIsStuck(r.task);

/* What the "Try an example paste" button puts on the clipboard: the band's
   and the caterer's add-ons for Mara & Finn, as a planner would copy them
   out of their own spreadsheet. */
export const EXAMPLE_PASTE = [
  "Item\tSupplier\tCost\tDue\tPaid",
  "Chair covers, ivory\tLinen Loft\t€210\t29 Sep\tno",
  "Buttonholes for the groomsmen\tFern and Furrow\t€96\t30 Sep\tno",
  "Hot port station\tKinsale Wine Co\t€185\t1 Oct\tno",
  "Sparklers for the send-off\tPop Party Supplies\t€64\t2 Oct\tno",
].join("\n");

/* ── Dates ─────────────────────────────────────────────────────────── */

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
export function toIso(t: number) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
export function addDays(iso: string, n: number) {
  return toIso(parseIso(iso) + n * DAY);
}
export function daysFromToday(iso: string) {
  return Math.round((parseIso(iso) - parseIso(TODAY)) / DAY);
}
export function weekday(iso: string) {
  return WD[new Date(parseIso(iso)).getUTCDay()];
}
/** "Fri 25 Sep", with the year outside 2026: "Sun 14 Mar 2027". The store's words. */
export const fmtDate = (iso: string) => storeFmtDay(iso);
/** Short and human, for the phone's second line. */
export function fmtRelative(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n > 1 && n < 7) return weekday(iso);
  return storeFmtDate(iso);
}
export function monthName(y: number, m: number) {
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m]} ${y}`;
}
/** Accepts "6 Oct", "6 October", "2026-10-06", "06/10/2026". */
export function parseLooseDate(raw: string): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dmY = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (dmY) {
    const y = dmY[3].length === 2 ? 2000 + Number(dmY[3]) : Number(dmY[3]);
    return toIso(Date.UTC(y, Number(dmY[2]) - 1, Number(dmY[1])));
  }
  const dm = t.match(/^(?:[a-z]{3,9}\s+)?(\d{1,2})\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?$/i);
  if (dm) {
    const mi = MO.findIndex((m) => dm[2].toLowerCase().startsWith(m.toLowerCase()));
    if (mi >= 0) return toIso(Date.UTC(dm[3] ? Number(dm[3]) : 2026, mi, Number(dm[1])));
  }
  return null;
}

/* ── Money and numbers ─────────────────────────────────────────────── */

const EUR0 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const EUR2 = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NUM = new Intl.NumberFormat("en-IE", { maximumFractionDigits: 1 });

export function eur(n: number) {
  return Number.isInteger(n) ? EUR0.format(n) : EUR2.format(n);
}
export function num(n: number) {
  return NUM.format(n);
}
