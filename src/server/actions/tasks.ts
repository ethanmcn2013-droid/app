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
  type Recurrence,
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
 */
export async function getSubtasksAction(
  parentTaskId: string,
): Promise<Task[]> {
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
  return (max ?? 0) + 1.0;
}

export async function moveTaskAction(
  id: string,
  toLane: LaneId,
): Promise<Task[]> {
  const ws = await getActiveWorkspace();
  // Pre-read prior lane so we can record a meaningful "from → to".
  const [row] = await db
    .select({ lane: tasks.lane })
    .from(tasks)
    .where(eq(tasks.id, id));
  if (!row || row.lane === toLane) return getTasks(ws);
  // Park the moved task at the end of its new lane so cross-lane drops
  // get a stable, predictable order without renumbering siblings.
  const position = await nextPositionForLane(toLane, ws);
  await db
    .update(tasks)
    .set({ lane: toLane, idleDays: null, position, ...bump() })
    .where(eq(tasks.id, id));
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
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
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
      .where(eq(tasks.id, id));
    await recordActivity(id, { kind: "toggleComplete", to: "done" });
    revalidatePath("/app", "layout");
    emitTasksChanged({ kind: "tasks" });
    return getTasks(ws);
  }

  const target: LaneId = row.lane === "done" ? "todo" : "done";
  await db
    .update(tasks)
    .set({ lane: target, idleDays: null, ...bump() })
    .where(eq(tasks.id, id));
  await recordActivity(id, {
    kind: "toggleComplete",
    to: target === "done" ? "done" : "open",
  });
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

function advanceDate(from: Date, r: Recurrence): Date {
  const interval = r.interval ?? 1;
  const d = new Date(from);
  if (r.freq === "daily") d.setDate(d.getDate() + interval);
  else if (r.freq === "weekly") d.setDate(d.getDate() + 7 * interval);
  else if (r.freq === "monthly") d.setMonth(d.getMonth() + interval);
  // If `from` is in the past, bump forward until the next instance is
  // in the future. Otherwise a long-untouched recurring task would
  // resurface with a stale-looking date.
  const now = Date.now();
  while (d.getTime() < now) {
    if (r.freq === "daily") d.setDate(d.getDate() + interval);
    else if (r.freq === "weekly") d.setDate(d.getDate() + 7 * interval);
    else if (r.freq === "monthly") d.setMonth(d.getMonth() + interval);
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
  // Drizzle accepts only known columns — strip undefined to avoid
  // overwriting with NULL when the caller sends a sparse patch.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) cleaned[k] = v;
  }
  if ("cents" in cleaned) {
    cleaned.cents = sanitizeCents(cleaned.cents as number | null);
  }
  await db
    .update(tasks)
    .set({ ...cleaned, ...bump() })
    .where(eq(tasks.id, id));

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
  return getTasks(await getActiveWorkspace());
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
  const [row] = await db
    .select({ lane: tasks.lane })
    .from(tasks)
    .where(eq(tasks.id, id));
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
    .where(eq(tasks.id, id));

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
  // No activity recorded — task is going away; FK cascade drops
  // any existing activities for this task with it.
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(await getActiveWorkspace());
}
