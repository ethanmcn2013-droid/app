"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { getTasks } from "@/server/db/queries";
import { recordActivity } from "@/server/db/activity";
import type { LaneId, Priority, Task, UpdateField, UserId } from "@/lib/data";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function bump() {
  return { updatedAt: new Date(nowSeconds() * 1000) };
}

export async function moveTaskAction(
  id: string,
  toLane: LaneId,
): Promise<Task[]> {
  // Pre-read prior lane so we can record a meaningful "from → to".
  const [row] = await db
    .select({ lane: tasks.lane })
    .from(tasks)
    .where(eq(tasks.id, id));
  if (!row || row.lane === toLane) return getTasks();
  await db
    .update(tasks)
    .set({ lane: toLane, idleDays: null, ...bump() })
    .where(eq(tasks.id, id));
  await recordActivity(id, {
    kind: "move",
    from: row.lane,
    to: toLane,
  });
  revalidatePath("/app", "layout");
  return getTasks();
}

export async function toggleCompleteAction(id: string): Promise<Task[]> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!row) return getTasks();
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
  return getTasks();
}

const TRACKED_UPDATE_FIELDS: ReadonlySet<UpdateField> = new Set([
  "title",
  "description",
  "priority",
  "due",
  "assignees",
  "tags",
  "estimate",
]);

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
  return getTasks();
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
  tags?: string[];
}): Promise<Task[]> {
  const id =
    input.id ??
    `t-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8)}`;
  await db.insert(tasks).values({
    id,
    title: input.title,
    description: input.description,
    lane: input.lane ?? "todo",
    priority: input.priority ?? "p2",
    assignees: input.assignees ?? [],
    estimate: input.estimate,
    due: input.due,
    tags: input.tags,
    ...bump(),
  });
  await recordActivity(id, {
    kind: "taskAdd",
    lane: input.lane ?? "todo",
  });
  revalidatePath("/app", "layout");
  return getTasks();
}

export async function removeTaskAction(id: string): Promise<Task[]> {
  // No activity recorded — task is going away; FK cascade drops
  // any existing activities for this task with it.
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidatePath("/app", "layout");
  return getTasks();
}
