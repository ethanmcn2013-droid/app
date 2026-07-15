"use server";

import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { tasks, workspaceMembers, workspaces } from "@/server/db/schema";
import {
  ACTIVE_WORKSPACE_COOKIE_NAME,
  getCurrentUser,
} from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";

/**
 * Flat row shape for the cross-workspace overdue popover. One entry
 * per overdue task, already joined to its workspace's display name +
 * slug so the client can render the chip + navigate without an extra
 * round-trip.
 */
export type CrossWorkspaceOverdueItem = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  taskId: string;
  title: string;
  /** Original human-readable due label as stored on the task. */
  due: string | null;
  /** ISO date (YYYY-MM-DD) suitable for client-side relative
   *  formatting. Derived from `dueAt` when set, otherwise parsed
   *  from the `due` text when it matches an ISO date. */
  dueIsoDate: string | null;
};

/**
 * Every overdue task across every workspace the current user is a
 * member of (owner or member, both come back from
 * `workspace_members`). Sorted most-overdue-first.
 *
 * Overdue heuristic:
 *   1. Prefer the structured `dueAt` timestamp, strictly < start of
 *      today in server time.
 *   2. Fall back to parsing the human `due` text when it matches an
 *      ISO date like `2026-04-12` and the date is < today. Free-form
 *      labels ("Today", "Tomorrow", "Mon", "Mar 12") are intentionally
 *      skipped, they're ambiguous without the source year, and the
 *      digest-quality answer is good enough for v1.
 *
 * Tasks already in the `done` lane are excluded, finished work
 * isn't overdue, just late-shipped.
 */
export async function getOverdueAcrossWorkspacesAction(): Promise<
  CrossWorkspaceOverdueItem[]
> {
  if (isDemoMode()) return [];
  const me = await getCurrentUser();

  // Resolve the user's workspaces in one shot, name + slug come from
  // the join so the client doesn't need a second lookup.
  const memberships = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      workspaceSlug: workspaces.slug,
      workspaceName: workspaces.name,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, me));

  if (memberships.length === 0) return [];

  const workspaceIds = memberships.map((m) => m.workspaceId);
  const workspaceMeta = new Map(
    memberships.map((m) => [
      m.workspaceId,
      { slug: m.workspaceSlug, name: m.workspaceName },
    ]),
  );

  // Midnight today, server time. `dueAt` is a UTC timestamp column;
  // anything strictly less than this is past-due as of "today".
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Pull every candidate row in one query: rows in any of the user's
  // workspaces, not in the `done` lane. Filter for the actual overdue
  // condition in JS so we can apply both branches of the heuristic
  // (structured `dueAt` OR parseable ISO text) without two queries.
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      workspaceId: tasks.workspaceId,
      due: tasks.due,
      dueAt: tasks.dueAt,
      lane: tasks.lane,
    })
    .from(tasks)
    .where(
      and(
        inArray(
          // Cast through `sql` so a possibly-null workspaceId column
          // still type-checks against the non-null id list.
          sql`${tasks.workspaceId}`,
          workspaceIds,
        ),
        ne(tasks.lane, "done"),
      ),
    )
    .orderBy(asc(tasks.dueAt));

  const todayStartMs = startOfToday.getTime();
  const todayIso = isoDay(startOfToday);

  type Scored = CrossWorkspaceOverdueItem & { sortKey: number };
  const out: Scored[] = [];

  for (const r of rows) {
    if (!r.workspaceId) continue;
    const meta = workspaceMeta.get(r.workspaceId);
    if (!meta) continue;

    // Branch 1: structured timestamp wins when present.
    if (r.dueAt) {
      const t = r.dueAt.getTime();
      if (t < todayStartMs) {
        out.push({
          workspaceId: r.workspaceId,
          workspaceSlug: meta.slug,
          workspaceName: meta.name,
          taskId: r.id,
          title: r.title,
          due: r.due ?? null,
          dueIsoDate: isoDay(r.dueAt),
          sortKey: t,
        });
        continue;
      }
      // dueAt set but in the future, not overdue.
      continue;
    }

    // Branch 2: text-only, accept exactly ISO `YYYY-MM-DD`.
    const iso = parseIsoDay(r.due);
    if (iso && iso < todayIso) {
      // Synthesize a sort key from the ISO date at midnight UTC; good
      // enough for ordering against `dueAt`-derived keys above.
      const synthetic = Date.parse(iso + "T00:00:00Z");
      out.push({
        workspaceId: r.workspaceId,
        workspaceSlug: meta.slug,
        workspaceName: meta.name,
        taskId: r.id,
        title: r.title,
        due: r.due ?? null,
        dueIsoDate: iso,
        sortKey: Number.isFinite(synthetic) ? synthetic : todayStartMs,
      });
    }
  }

  // Most overdue first, smallest timestamp is furthest in the past.
  out.sort((a, b) => a.sortKey - b.sortKey);

  return out.map(({ sortKey, ...rest }) => {
    void sortKey;
    return rest;
  });
}

/**
 * Set the active-workspace cookie so a subsequent navigation to
 * `/app/board` resolves into the chosen workspace. Validates
 * membership server-side, a hand-crafted call with someone else's
 * id is silently ignored. Returns `{ ok: true }` regardless to keep
 * the client path simple; the navigation that follows will land
 * the user wherever `getActiveWorkspace` resolves.
 */
export async function selectWorkspaceAction(
  workspaceId: string,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };
  const me = await getCurrentUser();
  const [membership] = await db
    .select({ id: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, me),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    );
  if (!membership) return { ok: true };
  const c = await cookies();
  c.set(ACTIVE_WORKSPACE_COOKIE_NAME, workspaceId, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    // 30 days, matches the lifetime expectations of a "remember
    // which workspace I was in" preference.
    maxAge: 60 * 60 * 24 * 30,
  });
  return { ok: true };
}

/** Format a `Date` as `YYYY-MM-DD` in local time. */
function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Accept `YYYY-MM-DD` only, return null for anything else. */
function parseIsoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

