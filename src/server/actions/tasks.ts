"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { getSubtasks, getTasks } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import { emitTasksChanged } from "@/server/events";
import { getActiveWorkspace } from "@/server/auth";
import {
  LANE_ORDER,
  type LaneId,
  type Priority,
  type RecurrenceSpec,
  type Task,
  type UpdateField,
  type UserId,
} from "@/lib/data";

/**
 * Pure read pass-through used by the realtime sync hook to refetch
 * the canonical task list when an SSE "tasks-changed" event arrives.
 * Resolves the active workspace from the session cookie.
 */
export async function getTasksAction(): Promise<Task[]> {
  const ws = await getActiveWorkspace();
  return getTasks(ws);
}

/**
 * Server-action wrapper around `getSubtasks` so the detail panel's
 * SubtasksSection can fetch a parent's children client-side without
 * importing server-only code. Returned rows are ordered oldest-first.
 *
 * Workspace guard: verify the parent task belongs to the caller's
 * active workspace before returning its subtasks. A caller who knows a
 * foreign parentTaskId gets an empty array, not a data leak.
 */
export async function getSubtasksAction(
  parentTaskId: string,
): Promise<Task[]> {
  const ws = await getActiveWorkspace();
  const [parent] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, parentTaskId), eq(tasks.workspaceId, ws)));
  if (!parent) return [];
  return getSubtasks(parentTaskId);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function bump() {
  return { updatedAt: new Date(nowSeconds() * 1000) };
}

/** Compute the next gap-number for end-of-lane inserts. Workspace-
 *  scoped so a tenant's positions don't fight with another tenant's. */
async function nextPositionForLane(
  lane: LaneId,
  workspaceId: string,
): Promise<number> {
  const [row] = await db
    .select({ max: sql<number | null>`MAX(${tasks.position})` })
    .from(tasks)
    .where(
      and(
        eq(tasks.lane, lane),
        eq(tasks.workspaceId, workspaceId),
      ),
    );
  const max = row?.max ?? 0;
  return max + 1.0;
}

export async function moveTaskAction(
  id: string,
  toLane: LaneId,
): Promise<Task[]> {
  if (!id || !LANE_ORDER.includes(toLane)) return [];
  const ws = await getActiveWorkspace();
  // Pre-read prior lane — workspace guard on the read so a caller who
  // knows a foreign task id gets a silent no-op instead of leaking the
  // lane value (or worse, re-parking the task).
  const [row] = await db
    .select({ lane: tasks.lane })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  if (!row || row.lane === toLane) return getTasks(ws);
  // Park the moved task at the end of its new lane so cross-lane drops
  // get a stable, predictable order without renumbering siblings.
  const position = await nextPositionForLane(toLane, ws);
  await db
    .update(tasks)
    .set({ lane: toLane, idleDays: null, position, ...bump() })
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  await recordActivity(id, {
    kind: "move",
    from: row.lane,
    to: toLane,
  });
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

export async function toggleCompleteAction(id: string): Promise<Task[]> {
  const ws = await getActiveWorkspace();
  // Workspace guard on the read: scope to the caller's workspace so a
  // foreign task id is a silent no-op rather than a cross-tenant toggle.
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  if (!row) return getTasks(ws);

  // Recurring tasks that are being completed don't go to "done" — they
  // bounce back to "todo" with the due date advanced by one interval.
  if (row.recurrence && row.lane !== "done") {
    const nextDueAt = advanceDate(row.dueAt ?? new Date(), row.recurrence);
    await db
      .update(tasks)
      .set({
        lane: "todo",
        idleDays: null,
        dueAt: nextDueAt,
        due: formatDueLabelForStorage(nextDueAt),
        ...bump(),
      })
      .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
    await recordActivity(id, { kind: "toggleComplete", to: "done" });
    revalidatePath("/app", "layout");
    emitTasksChanged({ kind: "tasks" });
    return getTasks(ws);
  }

  const target: LaneId = row.lane === "done" ? "todo" : "done";
  await db
    .update(tasks)
    .set({ lane: target, idleDays: null, ...bump() })
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  await recordActivity(id, {
    kind: "toggleComplete",
    to: target === "done" ? "done" : "open",
  });
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

/** Walk `d` forward to the next day matching `weekday` (0-6). Capped
 *  at 7 iterations: a valid weekday is always reachable within a
 *  week, so a corrupt value (e.g. 8 from a bad migration row) can no
 *  longer spin the server action forever — it just stops after a
 *  full week and returns whatever day it's on. */
function walkToWeekday(d: Date, weekday: number): void {
  for (let i = 0; i < 7 && d.getDay() !== weekday; i++) {
    d.setDate(d.getDate() + 1);
  }
}

function advanceDate(from: Date, r: RecurrenceSpec): Date {
  const d = new Date(from);

  if (r.kind === "weekly") {
    // Advance to the next occurrence of the target weekday.
    d.setDate(d.getDate() + 7);
    walkToWeekday(d, r.weekday);
  } else if (r.kind === "monthly-day") {
    // Same calendar day next month.
    d.setMonth(d.getMonth() + 1);
    d.setDate(r.day);
  } else if (r.kind === "monthly-first-weekday") {
    // First occurrence of the target weekday next month.
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    walkToWeekday(d, r.weekday);
  }

  // If the computed date is already in the past, keep advancing by
  // one interval until we land in the future. Hard-capped at 600
  // iterations (~50 years of monthly steps) so a malformed spec or
  // a clock skew can't hang the request — well past any real
  // recurrence horizon.
  const now = Date.now();
  for (let guard = 0; d.getTime() < now && guard < 600; guard++) {
    if (r.kind === "weekly") {
      d.setDate(d.getDate() + 7);
    } else if (r.kind === "monthly-day") {
      d.setMonth(d.getMonth() + 1);
      d.setDate(r.day);
    } else if (r.kind === "monthly-first-weekday") {
      d.setMonth(d.getMonth() + 1);
      d.setDate(1);
      walkToWeekday(d, r.weekday);
    } else {
      break;
    }
  }

  return d;
}

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDueLabelForStorage(d: Date): string {
  const now = new Date();
  const startOfDay = (x: Date) => {
    const c = new Date(x);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const dayDelta = (startOfDay(d) - startOfDay(now)) / (24 * 60 * 60 * 1000);
  if (dayDelta === 0) return "Today";
  if (dayDelta === 1) return "Tomorrow";
  if (dayDelta > 1 && dayDelta < 7) return DOW_SHORT[d.getDay()];
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

const TRACKED_UPDATE_FIELDS: ReadonlySet<UpdateField> = new Set([
  "title",
  "description",
  "priority",
  "due",
  "assignees",
  "tags",
  "estimate",
  "recurrence",
]);

/** Server-side guardrail for `cents` writes. Mirrors the client cap
 *  ($999,999.99 = 99_999_999¢) but also rejects NaN / Infinity / floats
 *  in case a hand-rolled client slips a bad value past the editor. */
function sanitizeCents(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value)) return null;
  const int = Math.round(value);
  if (int <= 0) return null;
  return Math.min(int, 99_999_999);
}

export async function updateTaskAction(
  id: string,
  patch: Partial<Omit<Task, "id">>,
): Promise<Task[]> {
  const ws = await getActiveWorkspace();
  // Drizzle accepts only known columns — strip undefined to avoid
  // overwriting with NULL when the caller sends a sparse patch.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) cleaned[k] = v;
  }
  if ("cents" in cleaned) {
    cleaned.cents = sanitizeCents(cleaned.cents as number | null);
  }
  // Workspace guard: a write only lands when the row belongs to the
  // caller's active workspace. Without this clause an authenticated
  // user who knows any task id could overwrite cross-tenant rows.
  await db
    .update(tasks)
    .set({ ...cleaned, ...bump() })
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));

  // Emit one activity per tracked field (parallel; observability,
  // not transactional). Untracked fields like `idleDays` are skipped.
  const trackedKeys = Object.keys(patch).filter((k): k is UpdateField =>
    TRACKED_UPDATE_FIELDS.has(k as UpdateField),
  );
  await Promise.all(
    trackedKeys.map((field) =>
      recordActivity(id, { kind: "update", field }),
    ),
  );

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

export async function addTaskAction(input: {
  id?: string;
  title: string;
  description?: string;
  lane?: LaneId;
  priority?: Priority;
  assignees?: UserId[];
  estimate?: number;
  due?: string;
  /** Structured datetime parallel to `due`. Set by the NLP quick-add
   *  parser. Date instances cross the server boundary as ISO strings;
   *  Drizzle's `mode: "timestamp"` column accepts Date directly. */
  dueAt?: Date;
  tags?: string[];
  /** Optional recurrence spec parsed from the NLP quick-add input. */
  recurrence?: RecurrenceSpec;
  /** Optional outside-person contact attached at create time. Both
   *  fields independently nullable. */
  externalContactName?: string | null;
  externalContactEmail?: string | null;
  /** Optional dollar amount in integer cents. Clamped server-side to
   *  [0, 99_999_999]; NaN / Infinity collapse to null. */
  cents?: number | null;
  /** Optional parent task id. When set, this row is created as a
   *  subtask — it inherits its parent's workspace and stays out of
   *  the top-level views (`getTasks` filters on parent_task_id IS
   *  NULL). One level of nesting only in v1. */
  parentTaskId?: string | null;
}): Promise<Task[]> {
  const ws = await getActiveWorkspace();
  const id =
    input.id ??
    `t-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;
  const lane = input.lane ?? "todo";
  const position = await nextPositionForLane(lane, ws);
  await db.insert(tasks).values({
    id,
    workspaceId: ws,
    title: input.title,
    description: input.description,
    lane,
    priority: input.priority ?? "p2",
    assignees: input.assignees ?? [],
    estimate: input.estimate,
    due: input.due,
    position,
    dueAt: input.dueAt,
    tags: input.tags,
    recurrence: input.recurrence,
    externalContactName: input.externalContactName ?? null,
    externalContactEmail: input.externalContactEmail ?? null,
    cents: sanitizeCents(input.cents ?? null),
    parentTaskId: input.parentTaskId ?? null,
    ...bump(),
  });
  await recordActivity(id, {
    kind: "taskAdd",
    lane: input.lane ?? "todo",
  });
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

/**
 * Persist a drag — write the new lane and float position. When the
 * lane changes, also record a "move" activity row matching what
 * `moveTaskAction` writes, so the conversation feed stays consistent
 * regardless of which entry point the user took.
 *
 * `position` uses gap-numbering: the client computes (prev + next) / 2
 * for an insert between two siblings, so neighbors never need
 * renumbering. Any finite float is accepted; the query layer ORDERs
 * by COALESCE(position, createdAt) ascending.
 */
export async function reorderTaskAction(
  id: string,
  lane: LaneId,
  position: number,
): Promise<Task[]> {
  if (!Number.isFinite(position)) {
    throw new Error(
      `reorderTaskAction: position must be finite, got ${position}`,
    );
  }
  if (!LANE_ORDER.includes(lane)) {
    throw new Error(`reorderTaskAction: unknown lane "${lane}"`);
  }

  const ws = await getActiveWorkspace();
  // Workspace guard on the read so a caller with a foreign task id
  // gets a no-op rather than accidentally moving a cross-tenant row.
  const [row] = await db
    .select({ lane: tasks.lane })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  if (!row) return getTasks(ws);

  const laneChanged = row.lane !== lane;
  await db
    .update(tasks)
    .set({
      lane,
      position,
      ...(laneChanged ? { idleDays: null } : {}),
      ...bump(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));

  if (laneChanged) {
    await recordActivity(id, {
      kind: "move",
      from: row.lane,
      to: lane,
    });
  }

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

export async function removeTaskAction(id: string): Promise<Task[]> {
  const ws = await getActiveWorkspace();
  // Workspace guard: deletes only fire when the row belongs to the
  // caller's active workspace. FK cascade drops activities for the row.
  await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}
