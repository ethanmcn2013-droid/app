// Note: `import "server-only"` would guard against a client-bundle
// import, but it throws at node:test import time. This module is only
// reached via get-source.ts → the cron route / preview surfaces (all
// already server-only), so the guard is redundant in practice and its
// removal lets the pure mappers below be unit-tested. Same exception
// dispatch.ts documents.
import { createClient, type Client, type Value } from "@libsql/client";
import type { BriefingContext, BriefingSource } from "./source";
import type { Lane, TaskSignal } from "./types";
import { assertTasksBriefingQuery } from "./tasks-read-contract";

/**
 * Reads the signed-in user's Tasks workspaces and maps them to
 * TaskSignal[]. Joins on the immutable suite subject (`clerk_id`).
 * Email is a display/delivery field only and is never an authorization key.
 *
 * Read-only by design, the token used here must be a Turso
 * read-only token. The data flow is Analytics ← Tasks; never the
 * other way.
 *
 * Engine fields produced from the real DB:
 *   - lane:        canonicalised todo/doing/review/done → next/in-flight/in-flight/shipped
 *   - priority:    "P0"|"P1"|"P2"|"P3" string → 0|1|2|3 number
 *   - dueAt:       Tasks SQLite seconds converted to unix ms or null
 *   - idleDays:    passed through (Tasks pre-computes this)
 *   - blockedBy:   JSON-parsed; defaults to []
 *   - commentCount:set to 0 for v1, a JOIN on comments per task is
 *                 measurable cost and the engine doesn't use this in
 *                 v1 triggers
 *   - sourceLabel: "Tasks · {workspace.name}"
 *   - movedToShippedAt: real read of the activities table, most
 *                 recent toggleComplete or move event per task,
 *                 converted from unix seconds to ms. Used only when
 *                 lane='shipped'; null otherwise. The just-shipped
 *                 trigger fires reliably from real data now.
 */
/** Heuristic: does this error look like the read-only Turso token
 *  expired / was revoked? If so we drop the cached client so the
 *  next call rebuilds it instead of returning [] for every user for
 *  the rest of the process lifetime. */
export function isAuthError(err: unknown): boolean {
  const s = String(err).toLowerCase();
  return (
    s.includes("401") ||
    s.includes("403") ||
    s.includes("unauthorized") ||
    s.includes("forbidden") ||
    s.includes("token") ||
    s.includes("auth")
  );
}

export function makeTasksDbSource(): BriefingSource | null {
  const url = process.env.TASKS_DATABASE_URL;
  const authToken = process.env.TASKS_AUTH_TOKEN;
  if (!url || !authToken) return null;

  // Lazily created and reset on auth-class failures so a rotated /
  // expired read-only token self-heals on the next run.
  let client: Client | null = null;
  function getClient(): Client {
    if (!client) client = createClient({ url: url!, authToken: authToken! });
    return client;
  }
  function dropClientIfAuth(err: unknown) {
    if (isAuthError(err)) client = null;
  }

  return {
    async getSignalsForUser(ctx: BriefingContext): Promise<TaskSignal[]> {
      assertTasksBriefingQuery({ subject: ctx.userId });
      // Resolve immutable suite subject → Tasks user_id. Never use email for
      // authorization: it can change, collide, or be absent during linking.
      // Any Tasks DB outage / expired token / schema drift here must
      // not abort the cron run, return [] so the empty-state render
      // fires for this user and the fanout continues for the rest.
      const signals: TaskSignal[] = [];
      let tasksUserId: Value | undefined;
      try {
        const userRow = await getClient().execute({
          sql: "SELECT id FROM users WHERE clerk_id = ? LIMIT 1",
          args: [ctx.userId],
        });
        tasksUserId = userRow.rows[0]?.id;
      } catch (err) {
        dropClientIfAuth(err);
        console.error(
          "[tasks-db-source] user lookup failed, returning empty signals:",
          { userId: ctx.userId, error: String(err) },
        );
        return [];
      }
      if (!tasksUserId) return [];

      // Get all tasks in workspaces this user belongs to, with the
      // most recent shipping-relevant activity timestamp joined in.
      // Limit 200, defends the engine if a workspace is huge; the
      // cap-3-per-bucket renderer doesn't need more than that.
      //
      // shipped_activity_at:
      //   activities.created_at is unix SECONDS (default unixepoch());
      //   we multiply by 1000 to align with the rest of the engine's
      //   millisecond clock. Considered only on lane=done tasks
      //   below, null on everything else.
      let rows: Awaited<ReturnType<Client["execute"]>>["rows"];
      try {
        const result = await getClient().execute({
          sql: `
            SELECT
              t.id           AS id,
              t.title        AS title,
              t.lane         AS lane,
              t.priority     AS priority,
              t.due_at       AS due_at,
              t.idle_days    AS idle_days,
              t.blocked_by   AS blocked_by,
              w.name         AS workspace_name,
              (
                SELECT MAX(a.created_at) * 1000
                FROM activities a
                WHERE a.task_id = t.id
                  AND a.kind IN ('toggleComplete', 'move')
              ) AS shipped_activity_at
            FROM tasks t
            INNER JOIN workspaces w ON w.id = t.workspace_id
            WHERE t.workspace_id IN (
              SELECT workspace_id FROM workspace_members WHERE user_id = ?
            )
              AND t.parent_task_id IS NULL
            ORDER BY t.id
            LIMIT 200
          `,
          args: [String(tasksUserId)],
        });
        rows = result.rows;
      } catch (err) {
        dropClientIfAuth(err);
        console.error(
          "[tasks-db-source] signals query failed, returning empty signals:",
          { userId: ctx.userId, error: String(err) },
        );
        return [];
      }

      for (const row of rows) signals.push(mapTasksBriefingRow(row));
      return signals;
    },
  };
}

type RawTasksBriefingRow = Readonly<Record<string, Value>>;

/** Adapt one raw libSQL Tasks row to the Signal contract. Raw SQLite
 * `due_at` values are integer seconds; TaskSignal uses Unix milliseconds. */
export function mapTasksBriefingRow(row: RawTasksBriefingRow): TaskSignal {
  const lane = canonicaliseLane(String(row.lane ?? ""));
  const shippedAt = row.shipped_activity_at;
  return {
    id: String(row.id),
    title: String(row.title),
    lane,
    priority: parsePriority(String(row.priority ?? "")),
    dueAt: tasksDueAtToUnixMilliseconds(row.due_at),
    idleDays: Number(row.idle_days ?? 0),
    commentCount: 0,
    blockedBy: parseBlockedBy(typeof row.blocked_by === "string" ? row.blocked_by : null),
    sourceLabel: `Tasks · ${String(row.workspace_name ?? "")}`,
    // activities.created_at is Unix seconds and the SQL query multiplies it
    // by 1000 to align with Signal's millisecond clock.
    movedToShippedAt: lane === "shipped" && shippedAt != null ? Number(shippedAt) : null,
  };
}

/** Tasks stores due_at as seconds, while the briefing engine compares Unix ms.
 * Null stays absent, negative timestamps remain valid, and malformed or out
 * of range SQLite values fail closed as undated rather than leaking NaN. */
export function tasksDueAtToUnixMilliseconds(rawDueAt: Value): number | null {
  if (rawDueAt == null) return null;
  if (typeof rawDueAt === "string" && !/^-?\d+$/.test(rawDueAt)) return null;
  if (typeof rawDueAt !== "number" && typeof rawDueAt !== "bigint" && typeof rawDueAt !== "string") return null;
  const seconds = Number(rawDueAt);
  if (!Number.isSafeInteger(seconds)) return null;
  const milliseconds = seconds * 1000;
  if (!Number.isSafeInteger(milliseconds) || Math.abs(milliseconds) > 8.64e15) return null;
  return milliseconds;
}

export function canonicaliseLane(raw: string): Lane {
  switch (raw) {
    case "todo":
      return "next";
    case "doing":
    case "review":
      return "in-flight";
    case "done":
      return "shipped";
    default:
      return "next";
  }
}

export function parsePriority(raw: string): 0 | 1 | 2 | 3 {
  const m = /^P([0-3])$/.exec(raw ?? "");
  if (m) return Number(m[1]) as 0 | 1 | 2 | 3;
  // Tasks pre-2024 uses numeric strings; tolerate them.
  const n = Number(raw);
  if (n >= 0 && n <= 3) return n as 0 | 1 | 2 | 3;
  return 2;
}

export function parseBlockedBy(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map(String);
    return [];
  } catch {
    return [];
  }
}
