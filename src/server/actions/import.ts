"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { tasks, workspaces } from "@/server/db/schema";
import { recordActivity } from "@/server/db/activity";
import { emitTasksChanged } from "@/server/events";
import { getActiveWorkspace } from "@/server/auth";
import type { LaneId, Priority } from "@/lib/data";
import { LANE_ORDER } from "@/lib/data";

/**
 * Server-side import target — the wire shape sent from the wizard.
 *
 * `dueAt` crosses the boundary as either an ISO string (when the client
 * serializes through JSON) or a Date instance (when the action is
 * called from a Server Component). Both are tolerated.
 */
export type ImportTaskInput = {
  title: string;
  lane: LaneId;
  priority: Priority;
  due?: string;
  dueAt?: Date | string;
  assignees: string[];
  tags: string[];
};

const MAX_ROWS = 500;

const PRIORITY_SET: ReadonlySet<Priority> = new Set<Priority>([
  "p0",
  "p1",
  "p2",
  "p3",
]);

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function bump() {
  return { updatedAt: new Date(nowSeconds() * 1000) };
}

function freshId(): string {
  const rnd =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `t-${rnd.slice(0, 8)}`;
}

function coerceDate(value: Date | string | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Compute next position per-lane. Single query, in-memory bump for the batch. */
async function laneStartPositions(
  workspaceId: string,
): Promise<Record<LaneId, number>> {
  const rows = await db
    .select({ lane: tasks.lane, max: sql<number | null>`MAX(${tasks.position})` })
    .from(tasks)
    .where(eq(tasks.workspaceId, workspaceId))
    .groupBy(tasks.lane);
  const positions: Record<LaneId, number> = {
    todo: 0,
    doing: 0,
    review: 0,
    done: 0,
  };
  for (const r of rows) {
    if (LANE_ORDER.includes(r.lane as LaneId)) {
      positions[r.lane as LaneId] = r.max ?? 0;
    }
  }
  return positions;
}

/**
 * Bulk-insert imported tasks. Single transaction — any row that fails
 * validation rolls the whole batch back so the user doesn't end up
 * with a half-imported workspace.
 *
 * Activities are recorded outside the txn (best-effort observability)
 * after the rows commit; if those fail we still return success.
 */
export async function importCsvAction(
  inputs: ImportTaskInput[],
): Promise<{ inserted: number; workspaceId: string }> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { inserted: 0, workspaceId: await getActiveWorkspace() };
  }
  if (inputs.length > MAX_ROWS) {
    throw new Error(
      `importCsvAction: ${inputs.length} rows exceeds the ${MAX_ROWS}-row import cap. Split into smaller batches.`,
    );
  }
  const ws = await getActiveWorkspace();

  // Pre-compute starting positions per lane; we increment in-memory as we
  // walk the batch so every inserted row gets a strictly-greater position
  // than the last existing task in its lane.
  const positions = await laneStartPositions(ws);

  const newIds: string[] = [];

  // better-sqlite3 + Drizzle expose a synchronous transaction; everything
  // inside runs atomically and any throw rolls back.
  db.transaction((tx) => {
    for (const raw of inputs) {
      const title = (raw.title ?? "").trim();
      if (!title) {
        throw new Error("importCsvAction: row missing title");
      }
      const lane: LaneId = LANE_ORDER.includes(raw.lane) ? raw.lane : "todo";
      const priority: Priority = PRIORITY_SET.has(raw.priority)
        ? raw.priority
        : "p2";
      positions[lane] = (positions[lane] ?? 0) + 1;
      const id = freshId();
      const dueAt = coerceDate(raw.dueAt);
      tx.insert(tasks)
        .values({
          id,
          workspaceId: ws,
          title,
          lane,
          priority,
          assignees: Array.isArray(raw.assignees) ? raw.assignees : [],
          tags: Array.isArray(raw.tags) && raw.tags.length > 0 ? raw.tags : null,
          due: raw.due,
          dueAt,
          position: positions[lane],
          ...bump(),
        })
        .run();
      newIds.push(id);
    }
  });

  // Record activities outside the txn — they're observability, not
  // a transactional invariant. A failed activity write must not undo
  // the user's import.
  await Promise.all(
    newIds.map((id) =>
      recordActivity(id, { kind: "taskAdd", lane: "todo" }).catch(() => {}),
    ),
  );

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return { inserted: newIds.length, workspaceId: ws };
}

/** Read-only — the import wizard's confirm step labels the CTA with this. */
export async function getActiveWorkspaceNameAction(): Promise<string> {
  const ws = await getActiveWorkspace();
  const [row] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(and(eq(workspaces.id, ws)));
  return row?.name ?? "your workspace";
}
