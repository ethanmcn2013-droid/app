/**
 * tasks-milestone-source.ts, read-only milestone pull from the Tasks DB.
 *
 * Structural copy of analytics/src/lib/briefing/tasks-db-source.ts.
 * The immutable suite subject (`clerk_id`) is the only cross-product key.
 * Email is display data and never authorizes a Tasks read. ARCH_SPEC §1.2.
 *
 * Read-only by design, TASKS_AUTH_TOKEN must be a Turso read-only token.
 * Data flow: Roadmap ← Tasks. Never the other way.
 *
 * Null-return when env unset: callers handle the missing-config case gracefully.
 * Lazy client + isAuthError reset: expired tokens self-heal on next sync run.
 *
 * Generation (status → lane, ARCH_SPEC §1.4, D4, D8):
 *   todo    → status:"next"      (display: "Next")
 *   doing   → status:"in-flight" (display: "In flight")
 *   review  → status:"in-flight" (display: "In flight")
 *   done    → status:"shipped"   (display: "Shipped")
 *   no date → Later (presentational; status:"next" + view-layer grouping, D7)
 *
 * Node id: deterministic `ms-{tasksWorkspaceId}-{tasksTaskId}` (ARCH_SPEC §1.4).
 */

import { createClient, type Client } from "@libsql/client";
import type { SyncedMilestone } from "@/modules/timeline/server/db/timeline-queries";
import type { Status } from "@/modules/timeline/server/db/timeline-schema";
import { assertTasksMilestoneQuery } from "./tasks-read-contract";

// ── Auth-error heuristic (mirrors analytics tasks-db-source) ─────────────────

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

// ── Status mapper (Tasks lane → Roadmap Status) ───────────────────────────────

export function canonicaliseStatus(tasksLane: string): Status {
  switch (tasksLane) {
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

// ── Source factory ────────────────────────────────────────────────────────────

export interface MilestoneSyncSource {
  getMilestonesForClerkId(
    clerkId: string,
    canonicalWorkspaceId: string,
  ): Promise<SyncedMilestone[]>;
}

/**
 * Returns null when TASKS_DATABASE_URL or TASKS_AUTH_TOKEN env vars are absent.
 * The action layer surfaces a user-friendly "not configured" message in that case.
 */
export function makeMilestoneSyncSource(): MilestoneSyncSource | null {
  const url = process.env.TASKS_DATABASE_URL;
  const authToken = process.env.TASKS_AUTH_TOKEN;
  if (!url || !authToken) return null;

  // Lazily created and reset on auth-class failures so a rotated or
  // expired read-only token self-heals on the next sync run.
  let client: Client | null = null;
  function getClient(): Client {
    if (!client) client = createClient({ url: url!, authToken: authToken! });
    return client;
  }
  function dropClientIfAuth(err: unknown) {
    if (isAuthError(err)) client = null;
  }

  return {
    async getMilestonesForClerkId(
      clerkId: string,
      canonicalWorkspaceId: string,
    ): Promise<SyncedMilestone[]> {
      assertTasksMilestoneQuery({
        subject: clerkId,
        workspaceId: canonicalWorkspaceId,
      });
      // Step 1, immutable suite subject → Tasks user id.
      let tasksUserId: string | null = null;
      try {
        const userRow = await getClient().execute({
          sql: "SELECT id FROM users WHERE clerk_id = ? LIMIT 1",
          args: [clerkId],
        });
        const id = userRow.rows[0]?.id;
        tasksUserId = id != null ? String(id) : null;
      } catch (err) {
        dropClientIfAuth(err);
        console.error("[tasks-milestone-source] user lookup failed:", String(err));
        return [];
      }
      if (!tasksUserId) {
        // Subject not linked in Tasks DB, calm empty state, not an error.
        return [];
      }

      // Step 2, fetch milestones (is_milestone=1, top-level, workspace-scoped)
      // Reads: flag, lane, due_at, title, workspace_id, workspace.name
      // Limit 200 per ARCH_SPEC §1.2 (defends engine if workspace is huge)
      let rows: Awaited<ReturnType<Client["execute"]>>["rows"];
      try {
        const result = await getClient().execute({
          sql: `
            SELECT
              t.id           AS task_id,
              t.title        AS title,
              t.lane         AS lane,
              t.due_at       AS due_at,
              w.id           AS workspace_id,
              w.name         AS workspace_name,
              ROW_NUMBER() OVER (ORDER BY w.id, t.due_at NULLS LAST, t.id) - 1 AS sort_order
            FROM tasks t
            INNER JOIN workspaces w ON w.id = t.workspace_id
            WHERE t.is_milestone = 1
              AND t.parent_task_id IS NULL
              AND t.workspace_id = ?
              AND EXISTS (
                SELECT 1 FROM workspace_members wm
                WHERE wm.workspace_id = t.workspace_id AND wm.user_id = ?
              )
            ORDER BY t.due_at, t.id
            LIMIT 200
          `,
          args: [canonicalWorkspaceId, tasksUserId],
        });
        rows = result.rows;
      } catch (err) {
        dropClientIfAuth(err);
        console.error("[tasks-milestone-source] milestones query failed:", String(err));
        return [];
      }

      return rows.map((row, i) => {
        const tasksWorkspaceId = String(row.workspace_id);
        const tasksTaskId = String(row.task_id);
        const dueAt = row.due_at != null ? Number(row.due_at) : null;
        const targetDate = dueAt
          ? new Date(dueAt).toISOString().slice(0, 10)
          : null;

        return {
          id: `ms-${tasksWorkspaceId}-${tasksTaskId}`,
          // projectSlug resolved by the caller from sourceTasksWorkspaceId mapping
          projectSlug: "", // filled in by writeRoadmapNodes caller
          workspaceSlug: "", // filled in by caller
          title: String(row.title),
          status: canonicaliseStatus(String(row.lane)),
          targetDate,
          sortOrder: Number(row.sort_order ?? i),
        };
      });
    },
  };
}
