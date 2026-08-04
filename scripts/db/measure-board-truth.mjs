#!/usr/bin/env node

/**
 * Read-only production measurement for the board-truth data migration
 * (0024) — the founder's gate: measure before writing or executing SQL.
 *
 * Prints, without modifying anything:
 *   - lane='waiting' rows, total and per workspace
 *   - any other non-canonical lane text present
 *   - board_column_key claims, per key
 *   - stored column configs among the affected workspaces
 *   - rows whose assignees still carry a design-lab fixture id (T·119's
 *     honest edge; counted here so the cleanup can be sized)
 *
 * Runs wherever the Tasks DB env is present; in CI it is dispatched via
 * the db-migrate workflow's `measure` command, where the production
 * credentials already live as repo secrets.
 */

import { createClient } from "@libsql/client";

const url = process.env.TASKS_DATABASE_URL ?? "file:tasks.db";
const authToken = process.env.TASKS_AUTH_TOKEN;

const FIXTURE_IDS = ["ethan", "maya", "noah", "aisha", "luca", "erin", "sam", "imani"];
const CANONICAL = ["todo", "doing", "review", "done"];

const client = createClient(authToken ? { url, authToken } : { url });

async function one(sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows;
}

const out = {};

out.waitingRowsTotal = Number(
  (await one("SELECT COUNT(*) AS n FROM tasks WHERE lane = 'waiting'"))[0].n,
);
out.waitingRowsByWorkspace = (
  await one(
    "SELECT workspace_id, COUNT(*) AS n FROM tasks WHERE lane = 'waiting' GROUP BY workspace_id ORDER BY n DESC",
  )
).map((row) => ({ workspaceId: row.workspace_id, rows: Number(row.n) }));

out.otherStrayLanes = (
  await one(
    `SELECT lane, COUNT(*) AS n FROM tasks WHERE lane NOT IN (${CANONICAL.map(() => "?").join(",")}) AND lane != 'waiting' GROUP BY lane`,
    CANONICAL,
  )
).map((row) => ({ lane: row.lane, rows: Number(row.n) }));

out.columnClaimsByKey = (
  await one(
    "SELECT board_column_key AS key, COUNT(*) AS n FROM tasks WHERE board_column_key IS NOT NULL GROUP BY board_column_key ORDER BY n DESC",
  )
).map((row) => ({ key: row.key, rows: Number(row.n) }));

out.storedColumnConfigs = Number(
  (await one("SELECT COUNT(*) AS n FROM meta WHERE key LIKE 'board:%:columns'"))[0].n,
);
out.affectedWorkspacesWithStoredConfig = Number(
  (
    await one(
      `SELECT COUNT(*) AS n FROM meta m
       WHERE m.key LIKE 'board:%:columns'
         AND EXISTS (
           SELECT 1 FROM tasks t
           WHERE t.lane = 'waiting'
             AND m.key = 'board:' || t.workspace_id || ':columns'
         )`,
    )
  )[0].n,
);

out.fixtureAssigneeRows = Number(
  (
    await one(
      `SELECT COUNT(*) AS n FROM tasks
       WHERE ${FIXTURE_IDS.map(() => "assignees LIKE ?").join(" OR ")}`,
      FIXTURE_IDS.map((id) => `%"${id}"%`),
    )
  )[0].n,
);

out.doneCanonicalTasks = Number(
  (await one("SELECT COUNT(*) AS n FROM tasks WHERE lane = 'done' AND board_column_key IS NULL"))[0].n,
);
out.doneTasksWithProvableCompletion = Number(
  (
    await one(
      `SELECT COUNT(*) AS n FROM tasks t
       WHERE t.lane = 'done' AND t.board_column_key IS NULL
         AND EXISTS (
           SELECT 1 FROM activities a
           WHERE a.task_id = t.id
             AND ((a.kind = 'toggleComplete' AND json_extract(a.payload, '$.to') = 'done')
               OR (a.kind = 'move' AND json_extract(a.payload, '$.to') = 'done'))
         )`,
    )
  )[0].n,
);

out.schemaMigrationRows = (
  await one(
    "SELECT id, sha256, review_receipt_id, review_receipt_sha256, status FROM signal_schema_migrations ORDER BY applied_at, id",
  )
).map((row) => ({
  id: row.id,
  sha256: String(row.sha256).slice(0, 12),
  receiptId: row.review_receipt_id,
  receiptSha256: String(row.review_receipt_sha256).slice(0, 12),
  status: row.status,
}));

console.log(JSON.stringify(out, null, 2));
client.close();
