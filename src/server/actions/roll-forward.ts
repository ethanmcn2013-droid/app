"use server";

import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { getActiveWorkspace } from "@/server/auth";

/**
 * End-of-day "Roll forward" action.
 *
 * Sweeps every uncompleted task whose due date is strictly before
 * end-of-today in server time and slides it to tomorrow. Single
 * transaction — the inbox sees one atomic flip rather than a stutter
 * of moving rows.
 *
 * Overdue heuristic mirrors `cross-workspace.ts`:
 *   1. Structured `dueAt` < end of TODAY wins when set.
 *   2. Else, accept the human `due` text only when it matches an
 *      ISO date `YYYY-MM-DD` and that date is < today. Free-form
 *      labels ("Today", "Mon", "Mar 12") are intentionally skipped —
 *      ambiguous without the source year.
 *
 * The `done` lane is excluded; finished work isn't overdue, just
 * late-shipped.
 */
export async function rollForwardIncompleteAction(): Promise<{
  ok: true;
  rolled: number;
}> {
  const ws = await getActiveWorkspace();

  // Boundaries in server-local time.
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const tomorrow = new Date(endOfToday);
  const todayIso = isoDay(startOfToday);
  const endOfTodayMs = endOfToday.getTime();

  // Pull every candidate row in this workspace that isn't already
  // closed. We filter overdue in JS so both branches of the heuristic
  // (structured `dueAt` OR parseable ISO text) live in one pass.
  const rows = await db
    .select({
      id: tasks.id,
      due: tasks.due,
      dueAt: tasks.dueAt,
    })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, ws), ne(tasks.lane, "done")));

  type Roll = {
    id: string;
    nextDueAt: Date;
    nextDue: string | null;
  };
  const queued: Roll[] = [];

  for (const r of rows) {
    // Branch 1: structured timestamp wins when present.
    if (r.dueAt) {
      if (r.dueAt.getTime() < endOfTodayMs) {
        const nextDueAt = addDays(r.dueAt, 1);
        queued.push({
          id: r.id,
          nextDueAt,
          nextDue: r.due ? formatDueLabel(nextDueAt, startOfToday) : null,
        });
      }
      continue;
    }
    // Branch 2: text-only — accept exactly ISO `YYYY-MM-DD`.
    const iso = parseIsoDay(r.due);
    if (iso && iso < todayIso) {
      // Synthesize a dueAt at local midnight of the parsed date plus
      // one day, so the row gains a structured timestamp on its way
      // forward — better data quality after one click.
      const parsed = new Date(`${iso}T00:00:00`);
      const nextDueAt = addDays(parsed, 1);
      queued.push({
        id: r.id,
        nextDueAt,
        nextDue: formatDueLabel(nextDueAt, startOfToday),
      });
    }
  }

  if (queued.length === 0) {
    return { ok: true, rolled: 0 };
  }

  // Single transaction so the inbox flips atomically.
  const updatedAt = new Date();
  await db.transaction(async (tx) => {
    for (const q of queued) {
      await tx.update(tasks)
        .set({
          dueAt: q.nextDueAt,
          // Only overwrite the human label when the row already had
          // one — preserve "no label" rows as-is.
          ...(q.nextDue !== null ? { due: q.nextDue } : {}),
          updatedAt,
        })
        .where(eq(tasks.id, q.id))
        .run();
    }
  });

  revalidatePath("/app", "layout");

  // Suppress the unused `tomorrow` warning while keeping the variable
  // available for future "rolled to <weekday>" copy.
  void tomorrow;

  return { ok: true, rolled: queued.length };
}

/**
 * Server-side count of overdue-today tasks in the active workspace.
 * Cheap pre-flight read so the inbox page can decide whether to
 * render the roll-forward button at all (zero overdue → hide).
 *
 * Same heuristic as `rollForwardIncompleteAction` — keep them in
 * lockstep so the rendered count matches what the action would
 * actually move.
 */
export async function getOverdueTodayCount(): Promise<number> {
  const ws = await getActiveWorkspace();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const todayIso = isoDay(startOfToday);
  const endOfTodayMs = endOfToday.getTime();

  const rows = await db
    .select({
      due: tasks.due,
      dueAt: tasks.dueAt,
    })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, ws), ne(tasks.lane, "done")));

  let n = 0;
  for (const r of rows) {
    if (r.dueAt) {
      if (r.dueAt.getTime() < endOfTodayMs) n += 1;
      continue;
    }
    const iso = parseIsoDay(r.due);
    if (iso && iso < todayIso) n += 1;
  }
  return n;
}

// ────────────────────────────────────────────────────────────────────
// Helpers — kept private to this module so the canonical heuristic
// in `cross-workspace.ts` stays the public reference.
// ────────────────────────────────────────────────────────────────────

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Format a `Date` as `YYYY-MM-DD` in local time. */
function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Accept `YYYY-MM-DD` only — return null for anything else. */
function parseIsoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

const SHORT_WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/**
 * Friendly label for the new due date, relative to today.
 *   - tomorrow → "Tomorrow"
 *   - within next 7 days → short weekday ("Mon", "Tue"…)
 *   - else → ISO `YYYY-MM-DD`
 */
function formatDueLabel(target: Date, startOfToday: Date): string {
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (t.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) {
    return SHORT_WEEKDAYS[t.getDay()];
  }
  return isoDay(t);
}
