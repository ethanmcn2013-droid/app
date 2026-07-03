"use server";

import "server-only";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { recordActivity } from "@/server/db/activity";
import { emitTasksChanged } from "@/server/events";
import { getActiveWorkspace } from "@/server/auth";

/**
 * "Repeat this task", clone the source task N times, each copy shifted
 * `dayStep` days further out from the source's `dueAt`. Use cases:
 *   - daily standup that should exist Mon–Fri (count 5, dayStep 1)
 *   - 7-day countdown to a wedding (count 7, dayStep 1)
 *   - monthly invoice reminder (count 12, dayStep 30)
 *
 * The original task is left untouched; only the duplicates are inserted.
 *
 * Server-side clamping is non-negotiable, a hand-rolled client could
 * try to slip count=10000 past the form, so we cap both inputs here
 * regardless of what the popover sent.
 */

const MAX_COUNT = 30;
const MIN_COUNT = 1;
const MIN_DAY_STEP = 1;
const MAX_DAY_STEP = 90;

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

/** Mirror of the formatter in tasks.ts, kept inline so this action
 *  doesn't import from the cents-extended file (collision avoidance). */
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

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const i = Math.trunc(value);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function newTaskId(): string {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `t-${raw.replace(/-/g, "").slice(0, 8)}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function duplicateTaskAction(
  taskId: string,
  count: number,
  dayStep: number,
): Promise<{ ok: true; created: number }> {
  // 1. Clamp inputs server-side. Don't trust the form.
  const safeCount = clamp(count, MIN_COUNT, MAX_COUNT);
  const safeStep = clamp(dayStep, MIN_DAY_STEP, MAX_DAY_STEP);

  // 2. Resolve tenant boundary.
  const ws = await getActiveWorkspace();

  // 3. Load source row; reject any cross-workspace request.
  const [source] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!source) {
    throw new Error("duplicateTaskAction: source task not found");
  }
  if (source.workspaceId !== ws) {
    throw new Error(
      "duplicateTaskAction: cross-workspace duplication is not permitted",
    );
  }

  const sourceDue = source.dueAt ?? null;
  const stamp = new Date(nowSeconds() * 1000);

  // 4. Build all N rows up front, then insert atomically.
  const newIds: string[] = [];
  const rows = Array.from({ length: safeCount }, (_, i) => {
    const offset = i + 1;
    const id = newTaskId();
    newIds.push(id);

    let nextDueAt: Date | null = null;
    let nextDueLabel: string | null = source.due ?? null;
    if (sourceDue) {
      const d = new Date(sourceDue);
      d.setDate(d.getDate() + offset * safeStep);
      nextDueAt = d;
      nextDueLabel = formatDueLabelForStorage(d);
    }

    return {
      id,
      workspaceId: source.workspaceId,
      title: source.title,
      description: source.description ?? null,
      lane: source.lane,
      priority: source.priority,
      assignees: source.assignees,
      due: nextDueLabel,
      dueAt: nextDueAt,
      estimate: source.estimate ?? null,
      tags: source.tags ?? null,
      // Reset per-instance state, comments, activity, idle accounting
      // belong to the original; the copies start fresh.
      idleDays: null,
      blockedBy: null,
      recurrence: source.recurrence ?? null,
      startDay: source.startDay ?? null,
      durationDays: source.durationDays ?? null,
      position: source.position ?? null,
      externalContactName: source.externalContactName ?? null,
      externalContactEmail: source.externalContactEmail ?? null,
      cents: source.cents ?? null,
      createdAt: stamp,
      updatedAt: stamp,
    };
  });

  // 5. Atomic batch insert. Any throw inside rolls back.
  await db.transaction(async (tx) => {
    for (const r of rows) {
      await tx.insert(tasks).values(r).run();
    }
  });

  // 6. Activity log per duplicate, observability, not transactional,
  //    so we walk these outside the txn.
  await Promise.all(
    newIds.map((id) =>
      recordActivity(id, { kind: "taskAdd", lane: source.lane }),
    ),
  );

  revalidatePath("/app", "layout");
  emitTasksChanged({ kind: "tasks" });
  return { ok: true, created: safeCount };
}
