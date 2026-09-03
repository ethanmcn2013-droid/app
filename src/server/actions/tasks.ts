"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { readWorkspaceColumnConfig } from "@/server/db/board-config-read";
import { isDoneColumnKey, isTaskDone } from "@/lib/board-columns";
import { nextTaskSeq } from "@/server/db/task-seq";
import {
  activities,
  attachments,
  comments,
  notifications,
  resources,
  tasks,
} from "@/server/db/schema";
import { getSubtasks, getTasks } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import { emitTasksChanged } from "@/server/events";
import { getActiveWorkspaceOrNull, getCurrentUser } from "@/server/auth";
import {
  authorizeProjectCandidate,
  authorizeStoredProject,
  readableProjectOrNull,
  scopeForTask,
} from "@/server/actions/project-authz";
import { isDemoMode } from "@/lib/access-mode";
import { maybeAwardCompletionMilestone } from "@/server/milestones";
import { demoTasks } from "@/server/demo/tasks-demo";
import {
  LANE_ORDER,
  type LaneId,
  type Priority,
  type RecurrenceSpec,
  type Task,
  type UpdateField,
  type UserId,
} from "@/lib/data";
import {
  classifyLaneTransition,
  recordSponsoredUse,
} from "@/lib/account/instrumentation/call-site";
import { deleteNativeByteCleanupTargetConfirmed } from "@/server/attachments/native-byte-cleanup";
import { repairExactNativeByteCleanupReceipts } from "@/server/attachments/native-upload-cleanup";
import { deleteNativeAttachmentRowsInTransaction } from "@/server/attachments/native-upload-custody";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";

/**
 * Pure read pass-through used by the realtime sync hook to refetch
 * the canonical task list when an SSE "tasks-changed" event arrives.
 * Resolves the active workspace from the session cookie.
 */
export async function getTasksAction(): Promise<Task[]> {
  if (isDemoMode()) return demoTasks();
  // Fail-closed: a caller who belongs to nothing gets no tasks, where the old
  // accessor handed back LEGACY_WORKSPACE_ID and this returned its rows (D-005).
  const ambient = await getActiveWorkspaceOrNull();
  const ws = await readableProjectOrNull(ambient);
  return ws ? getTasks(ws) : [];
}

/**
 * Server-action wrapper around `getSubtasks` so the detail panel's
 * SubtasksSection can fetch a parent's children client-side without
 * importing server-only code. Returned rows are ordered oldest-first.
 *
 * Project guard: the parent's own Project is proved openable to the caller
 * before its subtasks are returned. A caller who knows a foreign
 * parentTaskId gets an empty array, not a data leak — and a caller who is
 * simply looking at a Project other than the cookie's gets their subtasks
 * rather than a false empty.
 */
export async function getSubtasksAction(
  parentTaskId: string,
): Promise<Task[]> {
  if (isDemoMode()) return [];
  const me = await getCurrentUser();
  const scope = await scopeForTask(parentTaskId, me, "open");
  if (!scope.ok) return [];
  const ws = scope.ws;
  const [parent] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, parentTaskId), eq(tasks.workspaceId, ws)));
  if (!parent) return [];
  return getSubtasks(parentTaskId, ws);
}

/**
 * What a refused or unknown target returns.
 *
 * The caller's own list, never the target's — a refusal must not become a
 * channel for reading the Project it refused. `Task[]` has no room for "no",
 * so the honest neutral answer is the list the caller already had.
 */
async function neutralTaskList(ambient: string | null): Promise<Task[]> {
  const ws = await readableProjectOrNull(ambient);
  return ws ? getTasks(ws) : [];
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

/**
 * The completedAt stamp for a done-state transition (T·122). Done-ness is
 * the config predicate — a rename or an extra done column changes what
 * counts — and the stamp only moves on a real transition, so nudging a
 * task around inside done columns keeps its original completion time.
 */
function completionStamp(
  wasDone: boolean,
  isDoneNow: boolean,
): { completedAt?: Date | null } {
  if (wasDone === isDoneNow) return {};
  return { completedAt: isDoneNow ? new Date() : null };
}

export async function moveTaskAction(
  id: string,
  toLane: LaneId,
): Promise<Task[]> {
  if (!id || !LANE_ORDER.includes(toLane)) return [];
  if (isDemoMode()) return demoTasks();
  // Same Promise.all shape as toggleCompleteAction, so resolving the subject
  // adds no serial round-trip to a write path. `ambient` is context for the
  // neutral response only; it is not an input to the authorization decision.
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const scope = await scopeForTask(id, me);
  if (!scope.ok) return neutralTaskList(ambient);
  const ws = scope.ws;
  // Pre-read prior lane under the proved Project, so a row that moved between
  // the proof and here is refused rather than written blind.
  const [row] = await db
    .select({ lane: tasks.lane, boardColumnKey: tasks.boardColumnKey })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  if (!row || (row.lane === toLane && !row.boardColumnKey)) return getTasks(ws);
  // Park the moved task at the end of its new lane so cross-lane drops
  // get a stable, predictable order without renumbering siblings.
  const position = await nextPositionForLane(toLane, ws);
  // A lane move is canonical: it clears any custom-column claim (the same
  // contract as moveTaskToColumnAction) and stamps the done transition.
  const columnConfig = await readWorkspaceColumnConfig(ws);
  const stamp = completionStamp(
    isTaskDone(row, columnConfig),
    isDoneColumnKey(toLane, columnConfig),
  );
  await db
    .update(tasks)
    .set({ lane: toLane, boardColumnKey: null, idleDays: null, position, ...stamp, ...bump() })
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  await recordActivity(id, {
    kind: "move",
    from: row.lane,
    to: toLane,
  }, { workspaceId: ws });
  {
    // The no-op guard above already returned, so any transition here is real.
    const transition = classifyLaneTransition(row.lane, toLane);
    if (transition) {
      await recordSponsoredUse(
        { product: "tasks", kind: transition, objectKey: id, subjectId: me, workspaceId: ws },
        true,
      );
    }
  }
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

export async function toggleCompleteAction(id: string): Promise<Task[]> {
  if (isDemoMode()) return demoTasks();
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const scope = await scopeForTask(id, me);
  if (!scope.ok) return neutralTaskList(ambient);
  const ws = scope.ws;
  // Re-read under the proved Project: a foreign or moved row is refused here
  // rather than toggled.
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  if (!row) return getTasks(ws);

  // Recurring tasks that are being completed don't go to "done", they
  // bounce back to "todo" with the due date advanced by one interval.
  if (row.recurrence && row.lane !== "done") {
    const nextDueAt = advanceDate(row.dueAt ?? new Date(), row.recurrence);
    await db
      .update(tasks)
      .set({
        lane: "todo",
        boardColumnKey: null,
        idleDays: null,
        dueAt: nextDueAt,
        due: formatDueLabelForStorage(nextDueAt),
        // The recurring task bounces back open, but a completion DID
        // happen — completedAt records the moment it was last finished.
        completedAt: new Date(),
        ...bump(),
      })
      .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
    await recordActivity(id, { kind: "toggleComplete", to: "done" }, { workspaceId: ws });
    // Recurrence path always records a completion — award milestones accordingly.
    await maybeAwardCompletionMilestone(me, id).catch(() => {});
    await recordSponsoredUse(
      {
        product: "tasks",
        kind: "task_completed",
        objectKey: id,
        subjectId: me,
        workspaceId: ws,
      },
      true,
    );
    revalidatePath("/app", "layout");
    emitTasksChanged({ kind: "tasks" });
    return getTasks(ws);
  }

  // Done-ness is the config predicate: a task in a custom done column
  // reopens to todo; anything open completes into the canonical done
  // lane. Both directions clear any custom-column claim so the card
  // lands where the action says it does.
  const columnConfig = await readWorkspaceColumnConfig(ws);
  const wasDone = isTaskDone(row, columnConfig);
  const target: LaneId = wasDone ? "todo" : "done";
  await db
    .update(tasks)
    .set({
      lane: target,
      boardColumnKey: null,
      idleDays: null,
      ...completionStamp(wasDone, !wasDone),
      ...bump(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  await recordActivity(id, {
    kind: "toggleComplete",
    to: wasDone ? "open" : "done",
  }, { workspaceId: ws });
  {
    const transition = classifyLaneTransition(row.lane, target);
    if (transition) {
      await recordSponsoredUse(
        { product: "tasks", kind: transition, objectKey: id, subjectId: me, workspaceId: ws },
        true,
      );
    }
  }
  // Only award a milestone when the task actually became done.
  if (!wasDone) {
    await maybeAwardCompletionMilestone(me, id).catch(() => {});
  }
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

/** Walk `d` forward to the next day matching `weekday` (0-6). Capped
 *  at 7 iterations: a valid weekday is always reachable within a
 *  week, so a corrupt value (e.g. 8 from a bad migration row) can no
 *  longer spin the server action forever, it just stops after a
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
  // a clock skew can't hang the request, well past any real
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

/**
 * Columns in the `Task` type that `updateTaskAction` is permitted to
 * write. Structural / ownership / identity columns are intentionally
 * absent and will be stripped even if the caller somehow submits them.
 *
 * Non-patchable via this action (and why):
 *   - `id`           , PK; never mutated after insert
 *   - `workspaceId`  , tenant boundary; relocating a task into a
 *                       foreign workspace is the P1-1 vuln
 *   - `parentTaskId` , structural relationship; set only at creation
 *                       via `addTaskAction`
 *   - `sourceNoteId` , provenance metadata; set at creation only
 *   - `isMilestone`  , has its own dedicated `setTaskMilestoneAction`
 *   - `createdAt`    , server-managed; immutable after insert
 *   - `updatedAt`    , server-managed; always written via `bump()`
 *   - `comments`     , derived count in the query layer, not a column
 */
const PATCHABLE_TASK_COLUMNS = new Set([
  "title",
  "description",
  "lane",
  "priority",
  "assignees",
  "due",
  "dueAt",
  "estimate",
  "tags",
  "idleDays",
  "blockedBy",
  "recurrence",
  "startDay",
  "durationDays",
  "position",
  "externalContactName",
  "externalContactEmail",
  "cents",
] as const);

export async function updateTaskAction(
  id: string,
  patch: Partial<Omit<Task, "id">>,
): Promise<Task[]> {
  if (isDemoMode()) return demoTasks();
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const scope = await scopeForTask(id, me);
  if (!scope.ok) return neutralTaskList(ambient);
  const ws = scope.ws;
  // Resolve the target through the *proved* Project before doing any
  // side-effects. Without this read, a foreign id is a no-op update but
  // still emits activity against the foreign task.
  //
  // This read stays even though `scopeForTask` has already touched the row:
  // it re-reads under the proved scope, so a task that changed Project
  // between the proof and the write is refused instead of updated, and the
  // extra columns below are needed anyway. The ordering it pins —
  // owned row resolved before any activity is emitted — is asserted by
  // `tasks-security-regression.test.mjs`.
  //
  // The extra columns are for the sponsored-use diff: a patch that rewrites
  // identical values is not a reassignment or a reschedule, and comparing
  // costs nothing on a read this function already performs.
  const [ownedTask] = await db
    .select({
      id: tasks.id,
      lane: tasks.lane,
      assignees: tasks.assignees,
      due: tasks.due,
      dueAt: tasks.dueAt,
      startDay: tasks.startDay,
      durationDays: tasks.durationDays,
    })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  if (!ownedTask) return getTasks(ws);
  // Build the SET payload from only explicitly allowed columns.
  // This is an action-boundary allowlist, it strips ownership /
  // structural / identity columns (workspaceId, parentTaskId,
  // sourceNoteId, isMilestone, createdAt, updatedAt) regardless of
  // what the caller submits, and independently of the input type.
  // Also strips undefined values so Drizzle doesn't overwrite with NULL
  // on a sparse patch.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && PATCHABLE_TASK_COLUMNS.has(k as never)) {
      cleaned[k] = v;
    }
  }
  if ("cents" in cleaned) {
    cleaned.cents = sanitizeCents(cleaned.cents as number | null);
  }
  // A lane patch through the generic update is still a workflow move:
  // clear any custom-column claim and stamp the done transition so no
  // write path can change done-ness without moving completedAt (T·122).
  if ("lane" in cleaned) {
    const columnConfig = await readWorkspaceColumnConfig(ws);
    cleaned.boardColumnKey = null;
    Object.assign(
      cleaned,
      completionStamp(
        isTaskDone(ownedTask, columnConfig),
        isDoneColumnKey(cleaned.lane as string, columnConfig),
      ),
    );
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
      recordActivity(id, { kind: "update", field }, { workspaceId: ws }),
    ),
  );

  // One gesture can be several facts: a patch may move a lane and reschedule.
  // Each is emitted once, and only when the value genuinely changed.
  {
    const changed = (key: keyof typeof ownedTask) =>
      key in cleaned &&
      JSON.stringify((cleaned as Record<string, unknown>)[key]) !==
        JSON.stringify(ownedTask[key]);

    const emits: Array<"task_reassigned" | "task_rescheduled" | "task_completed" | "task_reopened" | "task_status_changed"> = [];
    if (changed("assignees")) emits.push("task_reassigned");
    if (["due", "dueAt", "startDay", "durationDays"].some((k) => changed(k as keyof typeof ownedTask))) {
      emits.push("task_rescheduled");
    }
    if (changed("lane")) {
      const transition = classifyLaneTransition(
        ownedTask.lane,
        (cleaned as { lane?: string }).lane,
      );
      if (transition) emits.push(transition);
    }
    for (const kind of emits) {
      await recordSponsoredUse(
        { product: "tasks", kind, objectKey: id, subjectId: me, workspaceId: ws },
        true,
      );
    }
  }

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
   *  subtask, it inherits its parent's workspace and stays out of
   *  the top-level views (`getTasks` filters on parent_task_id IS
   *  NULL). One level of nesting only in v1. */
  parentTaskId?: string | null;
  /**
   * Optional explicit destination Project (ADR 0001 §9, create/list).
   * Additive: a caller that knows its Project names it and stops depending on
   * the cookie; a caller that does not keeps working. Naming one is not a
   * privilege — it is proved against live membership exactly like the ambient
   * value, so a Project the caller is not in is refused either way.
   */
  projectId?: string;
}): Promise<Task[]> {
  if (isDemoMode()) return demoTasks();
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const grant = await authorizeProjectCandidate({
    candidateProjectId: input.projectId ?? ambient,
    capability: "createOrEditTasks",
    actorUserId: me,
  });
  // No proved Project means no destination. The old accessor would have
  // offered LEGACY_WORKSPACE_ID here and this would have created the task
  // inside it (D-005).
  if (!grant.ok) return neutralTaskList(ambient);
  const ws = grant.projectId;
  const id =
    input.id ??
    `t-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;
  const lane = input.lane ?? "todo";
  // Creating straight into a done column is a completion (T·122).
  const createdDone = isDoneColumnKey(lane, await readWorkspaceColumnConfig(ws));
  if (input.parentTaskId) {
    // A subtask inherits its parent's tenant. Require a top-level parent in
    // the active workspace; this rejects both foreign-parent injection and
    // unsupported deeper nesting before any child row is inserted.
    const [parent] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.id, input.parentTaskId),
          eq(tasks.workspaceId, ws),
          isNull(tasks.parentTaskId),
        ),
      );
    if (!parent) {
      throw new Error(
        "addTaskAction: parent task is not in the active workspace",
      );
    }
  }
  const position = await nextPositionForLane(lane, ws);
  await db.insert(tasks).values({
    id,
    workspaceId: ws,
    seq: nextTaskSeq(ws),
    title: input.title,
    description: input.description,
    lane,
    completedAt: createdDone ? new Date() : null,
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
  }, { workspaceId: ws });
  await recordSponsoredUse(
    { product: "tasks", kind: "task_created", objectKey: id, subjectId: me, workspaceId: ws },
    true,
  );
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

/**
 * Persist a drag, write the new lane and float position. When the
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
  if (isDemoMode()) return demoTasks();

  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const scope = await scopeForTask(id, me);
  if (!scope.ok) return neutralTaskList(ambient);
  const ws = scope.ws;
  // Re-read under the proved Project so a row that moved between the proof
  // and the write is refused rather than reordered.
  const [row] = await db
    .select({ lane: tasks.lane, boardColumnKey: tasks.boardColumnKey })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  if (!row) return getTasks(ws);

  const laneChanged = row.lane !== lane;
  // Positional reorder is a canonical lane placement: clear any claim and
  // stamp a done transition exactly like moveTaskAction (T·122).
  const columnConfig = await readWorkspaceColumnConfig(ws);
  const stamp = completionStamp(
    isTaskDone(row, columnConfig),
    isDoneColumnKey(lane, columnConfig),
  );
  await db
    .update(tasks)
    .set({
      lane,
      boardColumnKey: null,
      position,
      ...stamp,
      ...(laneChanged ? { idleDays: null } : {}),
      ...bump(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));

  if (laneChanged) {
    await recordActivity(id, {
      kind: "move",
      from: row.lane,
      to: lane,
    }, { workspaceId: ws });
  }

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

export async function removeTaskAction(id: string): Promise<Task[]> {
  if (isDemoMode()) return demoTasks();
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  // Destructive, and it deletes a subtree. The capability proof is explicit
  // and precedes every read below, so no empty result anywhere in this
  // function is ever the thing that decides a delete may proceed.
  const scope = await scopeForTask(id, me);
  if (!scope.ok) return neutralTaskList(ambient);
  const ws = scope.ws;

  // FK cascade does NOT fire over Turso stateless HTTP, so delete the full
  // subtree explicitly. Native byte receipts, attachment rows, child rows and
  // the parent commit under one writer lock: no upload can enter between the
  // attachment snapshot and task deletion.
  const deletion = await db.transaction(
    async (transaction) => {
      const grant = await authorizeStoredProject({
        storedProjectId: ws,
        capability: "createOrEditTasks",
        actorUserId: me,
        executor: transaction,
      });
      if (!grant.ok) {
        return { deleted: false, cleanupReceiptKeys: [] as string[] };
      }
      await assertProjectNotDeleting(transaction, ws);
      const [parent] = await transaction
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)))
        .limit(1);
      if (!parent) {
        return { deleted: false, cleanupReceiptKeys: [] as string[] };
      }
      const childRows = await transaction
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.parentTaskId, id), eq(tasks.workspaceId, ws)));
      const childIds = childRows.map((row) => row.id);
      const taskIds = [id, ...childIds];
      const attachmentRows = await transaction
        .select({ id: attachments.id })
        .from(attachments)
        .where(inArray(attachments.taskId, taskIds));
      const { cleanupReceiptKeys } =
        await deleteNativeAttachmentRowsInTransaction(transaction, {
          workspaceId: ws,
          attachmentIds: attachmentRows.map((row) => row.id),
        });

      await transaction
        .delete(activities)
        .where(inArray(activities.taskId, taskIds));
      await transaction
        .delete(comments)
        .where(inArray(comments.taskId, taskIds));
      await transaction
        .delete(notifications)
        .where(inArray(notifications.taskId, taskIds));
      await transaction
        .delete(resources)
        .where(inArray(resources.taskId, taskIds));
      if (childIds.length > 0) {
        await transaction.delete(tasks).where(inArray(tasks.id, childIds));
      }
      const deletedParent = await transaction
        .delete(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)))
        .returning({ id: tasks.id });
      if (deletedParent.length !== 1) {
        throw new Error("task deletion conflicted");
      }
      return { deleted: true, cleanupReceiptKeys };
    },
    { behavior: "immediate" },
  );
  if (!deletion.deleted) return getTasks(ws);
  await repairExactNativeByteCleanupReceipts(
    { database: db, deleteTarget: deleteNativeByteCleanupTargetConfirmed },
    deletion.cleanupReceiptKeys,
  );

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

/**
 * Archive or restore a task. Non-destructive: sets/clears `archived_at`
 * so the task leaves (or returns to) every active view without deleting
 * it. Workspace-guarded like every other write here. Returns the active
 * task list (archived rows are filtered out of it by getTasks).
 *
 * Cascades to children in the same write (per review §1.2 option (a)):
 * archiving a parent hides the whole subtree; restoring a parent restores
 * every child too. Emits per-task activity for the parent and each child.
 */
export async function setTaskArchivedAction(
  id: string,
  archived: boolean,
): Promise<Task[]> {
  if (isDemoMode()) return demoTasks();
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const scope = await scopeForTask(id, me);
  if (!scope.ok) return neutralTaskList(ambient);
  const ws = scope.ws;

  // Re-read under the proved Project before the cascade.
  const [ownedTask] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  if (!ownedTask) return getTasks(ws);

  const archivedAt = archived ? new Date() : null;
  const activityPayload = archived
    ? ({ kind: "archived" } as const)
    : ({ kind: "restored" } as const);

  // Update parent.
  await db
    .update(tasks)
    .set({ archivedAt, ...bump() })
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  await recordActivity(id, activityPayload, { workspaceId: ws });

  // Cascade to children — fetch their ids then update + record per-child.
  const children = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.parentTaskId, id), eq(tasks.workspaceId, ws)));
  for (const child of children) {
    await db
      .update(tasks)
      .set({ archivedAt, ...bump() })
      .where(and(eq(tasks.id, child.id), eq(tasks.workspaceId, ws)));
    await recordActivity(child.id, activityPayload, { workspaceId: ws });
  }

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

/** Mint a fresh task id in the `t-<8hex>` convention. */
function freshTaskId(): string {
  return `t-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 8)}`;
}

/**
 * Duplicate a task within the active workspace (Phase 3E "Duplicate in
 * session"). Copies the reusable fields — title, description, lane,
 * priority, assignees, estimate, dates, tags, recurrence, external
 * contact, amount, milestone flag, and board column — plus every subtask,
 * as fresh rows. Deliberately does NOT copy immutable identifiers, the
 * activity history, comments, or cross-product provenance (sourceNote*).
 *
 * The copy is positioned directly after the original in its lane (a hair
 * past the original's float position) so it lands as the next card.
 */
export async function duplicateTaskAction(id: string): Promise<Task[]> {
  if (isDemoMode()) return demoTasks();
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const scope = await scopeForTask(id, me);
  if (!scope.ok) return neutralTaskList(ambient);
  const ws = scope.ws;

  const [source] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws), isNull(tasks.parentTaskId)));
  if (!source) return getTasks(ws); // workspace guard / unknown id → no-op

  const newId = freshTaskId();
  const basePosition =
    typeof source.position === "number"
      ? source.position + 0.0001
      : await nextPositionForLane(source.lane as LaneId, ws);

  await db.insert(tasks).values({
    id: newId,
    workspaceId: ws,
    seq: nextTaskSeq(ws),
    title: source.title,
    description: source.description,
    lane: source.lane,
    priority: source.priority,
    assignees: source.assignees,
    estimate: source.estimate,
    due: source.due,
    dueAt: source.dueAt,
    tags: source.tags,
    recurrence: source.recurrence,
    blockedBy: source.blockedBy,
    startDay: source.startDay,
    durationDays: source.durationDays,
    position: basePosition,
    externalContactName: source.externalContactName,
    externalContactEmail: source.externalContactEmail,
    cents: sanitizeCents(source.cents ?? null),
    isMilestone: source.isMilestone,
    boardColumnKey: source.boardColumnKey,
    completedAt: source.completedAt ?? null,
    parentTaskId: null,
    ...bump(),
  });

  // Copy every subtask as a child of the new task.
  const children = await getSubtasks(id, ws);
  for (const child of children) {
    await db.insert(tasks).values({
      id: freshTaskId(),
      workspaceId: ws,
      seq: nextTaskSeq(ws),
      title: child.title,
      description: child.description,
      lane: child.lane,
      priority: child.priority,
      assignees: child.assignees,
      estimate: child.estimate,
      due: child.due,
      dueAt: child.dueAt,
      tags: child.tags,
      cents: sanitizeCents(child.cents ?? null),
      parentTaskId: newId,
      ...bump(),
    });
  }

  await recordActivity(newId, { kind: "taskAdd", lane: source.lane }, { workspaceId: ws });
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}

/**
 * RW-3b, toggle the milestone flag on a task.
 *
 * D6 contract: setting isMilestone=true fills the Roadmap's PRIVATE draft
 * only. Nothing here auto-publishes. The publish gate is separate and
 * lives entirely in the Roadmap app. This action ONLY sets the flag.
 *
 * Reversible: calling with `false` unsets the flag. If a Roadmap node
 * was generated from this task, the Roadmap curation overlay controls
 * visibility (hide toggle), the node is NOT auto-deleted on unset,
 * preventing accidental data loss from an accidental mis-tap.
 *
 * Project guard: this was the one task mutation with no pre-read at all — a
 * bare `UPDATE … WHERE id = ? AND workspace_id = <cookie>`, where the guard
 * was structural rather than stated. Behaviourally that matched its siblings,
 * and it shared their defect: a task in a Project other than the cookie's
 * matched nothing, promoted nothing, and reported success. It now gets the
 * same explicit treatment as every other mutation here — the target's own
 * Project is derived and proved before the update, which is also the only way
 * the caller can be told apart from someone guessing task ids.
 */
export async function setTaskMilestoneAction(
  id: string,
  isMilestone: boolean,
): Promise<Task[]> {
  if (isDemoMode()) return demoTasks();
  const [me, ambient] = await Promise.all([
    getCurrentUser(),
    getActiveWorkspaceOrNull(),
  ]);
  const scope = await scopeForTask(id, me);
  if (!scope.ok) return neutralTaskList(ambient);
  const ws = scope.ws;
  await db
    .update(tasks)
    .set({ isMilestone, ...bump() })
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, ws)));
  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return getTasks(ws);
}
