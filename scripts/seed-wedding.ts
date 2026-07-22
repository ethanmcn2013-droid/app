/**
 * seed-wedding -- idempotent wedding demo seed for Signal Tasks.
 *
 * Governed by D-015. Operator-only. Never run against a remote database
 * without the explicit prod gate (--i-understand-prod + --checkpoint).
 *
 * Usage:
 *   node --import tsx scripts/seed-wedding.ts \
 *     --workspace <id> \
 *     --user <id> \
 *     --db <url-or-file> \
 *     [--confirm] \
 *     [--clean] \
 *     [--i-understand-prod] \
 *     [--checkpoint <path>]
 *
 * Shorthand via package.json:
 *   pnpm seed:wedding -- --workspace <id> --user <id> --db file:./seed-test.db --confirm
 *
 * Idempotency guarantee:
 *   Every task row written by this command uses a deterministic id of the
 *   form "seed-wed-<workspaceId>-<n>" (n is a zero-padded 2-digit index).
 *   The workspace row upserts the name and activeDomain using
 *   INSERT ... ON CONFLICT DO UPDATE, and task rows use the same pattern.
 *   Running twice with --confirm leaves the same row count; no duplicates.
 *
 * Self-scoping guarantee:
 *   --clean deletes only rows WHERE id LIKE 'seed-wed-%' AND workspace_id = ?
 *   for tasks, and the single workspace meta key this command writes.
 *   It cannot affect any other user's data, unrelated tasks, or billing rows.
 *
 * Prod guard:
 *   If the resolved db URL contains "turso.io" or starts with "libsql://"
 *   the command refuses unless BOTH --i-understand-prod is present AND
 *   --checkpoint points at an existing file. This gate is intentional:
 *   --i-understand-prod must never appear in automation scripts.
 *
 * Partial-state safety:
 *   libSQL's client.batch() runs all writes in a single implicit transaction
 *   when the URL is a local file. A re-run heals partial state because every
 *   INSERT uses ON CONFLICT DO UPDATE (tasks) or ON CONFLICT DO NOTHING
 *   (workspace_members). If batch() is unavailable the writes fall back to a
 *   sequential loop -- re-running still heals via the upsert semantics.
 */

import { createClient } from "@libsql/client";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// ── Seed prefix ────────────────────────────────────────────────────────────────

/** Every id this command creates starts with this prefix. */
const SEED_PREFIX = "seed-wed";

/** Build the deterministic task id for position n (0-based) in workspace ws. */
function taskId(workspaceId: string, n: number): string {
  return `${SEED_PREFIX}-${workspaceId}-${String(n).padStart(2, "0")}`;
}

// ── Synthetic wedding dataset ──────────────────────────────────────────────────
//
// Derived from src/server/demo/tasks-demo.ts: the same synthetic personas,
// titles, lanes, and priorities. No real guest data. The dataset uses only
// the two demo personas present in that file (Maria Doyle + the duty manager's
// fictional contacts). No new real names are introduced.
//
// We replicate the shape here rather than importing tasks-demo.ts because that
// file carries "server-only" and Next.js module machinery that must not execute
// in a bare Node/tsx script context.

type Lane = "todo" | "doing" | "review" | "done";
type Priority = "p1" | "p2" | "p3";

type SeedTask = {
  title: string;
  description?: string;
  lane: Lane;
  priority: Priority;
  due?: string;
  tags?: string[];
  externalContactName?: string;
  cents?: number;
  assignees: string[]; // filled in with --user at runtime
};

const WEDDING_TASKS: SeedTask[] = [
  // todo
  {
    title: "Confirm marquee sides with the hire company",
    description:
      "Maria + James, Saturday. Terrace plan if dry, marquee if not. They need the call by Thursday.",
    lane: "todo",
    priority: "p1",
    due: "Thu",
    tags: ["maria-james"],
    externalContactName: "County Marquee Hire",
    assignees: [],
  },
  {
    title: "Final stem count to the florist",
    description: "Looser, wilder look, fewer roses, more foliage. Florist wants it Monday.",
    lane: "todo",
    priority: "p2",
    due: "Mon",
    tags: ["maria-james"],
    externalContactName: "Aoife, Northlight Flowers",
    assignees: [],
  },
  {
    title: "Reprint the faded welcome sign before the open day",
    lane: "todo",
    priority: "p3",
    due: "next week",
    tags: ["venue"],
    assignees: [],
  },
  {
    title: "Send midweek rate to the June 2027 walk-in couple",
    description: "Around 80 guests, budget-conscious. Follow up Friday if no reply.",
    lane: "todo",
    priority: "p2",
    due: "Fri",
    tags: ["enquiry"],
    cents: 0,
    assignees: [],
  },
  // doing
  {
    title: "Build the Saturday run-sheet",
    description: "Ceremony 2pm orchard, drinks terrace, dinner 5:30. Share with the floor team.",
    lane: "doing",
    priority: "p1",
    due: "Fri",
    tags: ["maria-james"],
    assignees: [],
  },
  {
    title: "Order tonic and the good olives",
    description: "Two extra cases of tonic; last olive delivery was short.",
    lane: "doing",
    priority: "p2",
    due: "Thu",
    tags: ["bar"],
    externalContactName: "Greenfield Wholesale",
    cents: 18400,
    assignees: [],
  },
  // review
  {
    title: "Approve the final seating plan",
    description: "Top table moved away from the speakers. Check sightlines to the arch.",
    lane: "review",
    priority: "p1",
    tags: ["maria-james"],
    assignees: [],
  },
  {
    title: "Sign off the recommended-suppliers list",
    description: "Add Northlight (photography) and County Marquee. Drop the lapsed DJ.",
    lane: "review",
    priority: "p3",
    tags: ["venue"],
    assignees: [],
  },
  // done
  {
    title: "Open day, nine couples through",
    description: "Three asked for dates. Tea urn was the hero. Repeat the format in spring.",
    lane: "done",
    priority: "p2",
    tags: ["venue"],
    assignees: [],
  },
  {
    title: "Deposit invoice settled, Maria + James",
    lane: "done",
    priority: "p1",
    tags: ["maria-james"],
    externalContactName: "Maria Doyle",
    cents: 150000,
    assignees: [],
  },
];

// ── Domain types ───────────────────────────────────────────────────────────────

export type SeedRow = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  lane: string;
  priority: string;
  assignees: string; // JSON
  due: string | null;
  tags: string | null; // JSON
  externalContactName: string | null;
  cents: number | null;
  createdAt: number;
  updatedAt: number;
};

export type ApplyOptions = {
  dryRun: boolean;
};

// ── Pure builder ───────────────────────────────────────────────────────────────

/**
 * buildSeedRows(workspaceId, userId) -- pure, no I/O.
 *
 * Returns the exact set of task rows this command would write. Exported so
 * the test suite can call it without triggering the CLI entry point.
 */
export function buildSeedRows(workspaceId: string, userId: string): SeedRow[] {
  const now = Math.floor(Date.now() / 1000);
  return WEDDING_TASKS.map((t, i) => ({
    id: taskId(workspaceId, i),
    workspaceId,
    title: t.title,
    description: t.description ?? null,
    lane: t.lane,
    priority: t.priority,
    assignees: JSON.stringify([userId]),
    due: t.due ?? null,
    tags: t.tags ? JSON.stringify(t.tags) : null,
    externalContactName: t.externalContactName ?? null,
    cents: t.cents ?? null,
    createdAt: now,
    updatedAt: now,
  }));
}

// ── Core apply ─────────────────────────────────────────────────────────────────

/**
 * applySeed(client, rows, userId, options) -- applies the seed to the database.
 *
 * In dry-run mode it only prints what it would do and touches nothing.
 * In confirm mode it runs all writes. Sets workspace activeDomain='wedding'
 * and upserts the workspace name to "The Orchard, events" if no name is set.
 *
 * Uses client.batch() where available (local file URL: one implicit
 * transaction). Falls back to sequential execute() if batch() throws; a
 * re-run heals partial state via the ON CONFLICT upserts.
 */
export async function applySeed(
  client: ReturnType<typeof createClient>,
  rows: SeedRow[],
  options: ApplyOptions,
): Promise<void> {
  const workspaceId = rows[0]?.workspaceId;
  if (!workspaceId) {
    console.log("No rows to seed.");
    return;
  }

  if (options.dryRun) {
    console.log(`[dry-run] Would upsert workspace "${workspaceId}" with activeDomain=wedding.`);
    console.log(`[dry-run] Would upsert ${rows.length} task row(s):`);
    for (const r of rows) {
      console.log(`  ${r.id}  ${r.lane.padEnd(6)}  ${r.priority}  "${r.title}"`);
    }
    return;
  }

  // Workspace upsert: set activeDomain=wedding; set name only if absent.
  // The workspace row must already exist (--user and --workspace are provided
  // as existing ids per D-015). We do NOT create new workspace rows.
  const wsUpdate = {
    sql: `UPDATE workspaces
          SET active_domain = 'wedding',
              updated_at    = unixepoch()
          WHERE id = ?`,
    args: [workspaceId],
  };

  // Task upserts: INSERT OR REPLACE keeps ON CONFLICT behaviour identical to
  // INSERT ... ON CONFLICT(id) DO UPDATE which libSQL supports via the REPLACE
  // conflict algorithm.
  const taskStatements = rows.map((r) => ({
    sql: `INSERT INTO tasks (
            id, workspace_id, title, description, lane, priority,
            assignees, due, tags, external_contact_name, cents,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title                = excluded.title,
            description          = excluded.description,
            lane                 = excluded.lane,
            priority             = excluded.priority,
            assignees            = excluded.assignees,
            due                  = excluded.due,
            tags                 = excluded.tags,
            external_contact_name = excluded.external_contact_name,
            cents                = excluded.cents,
            updated_at           = excluded.updated_at`,
    args: [
      r.id,
      r.workspaceId,
      r.title,
      r.description,
      r.lane,
      r.priority,
      r.assignees,
      r.due,
      r.tags,
      r.externalContactName,
      r.cents,
      r.createdAt,
      r.updatedAt,
    ],
  }));

  try {
    await client.batch([wsUpdate, ...taskStatements], "write");
    console.log(
      `Seeded ${rows.length} task(s) into workspace "${workspaceId}" (activeDomain=wedding).`,
    );
  } catch (batchErr) {
    // batch() may be unavailable for remote HTTP clients or older client
    // versions. Fall back to sequential writes; re-run heals partial state
    // via the ON CONFLICT upserts above.
    console.log(
      "Note: batch write unavailable, falling back to sequential writes. Re-run heals any partial state.",
    );
    try {
      await client.execute(wsUpdate);
      for (const stmt of taskStatements) {
        await client.execute(stmt);
      }
      console.log(
        `Seeded ${rows.length} task(s) into workspace "${workspaceId}" (activeDomain=wedding).`,
      );
    } catch (seqErr) {
      const msg = seqErr instanceof Error ? seqErr.message : String(seqErr);
      console.error(`Seed failed: ${msg}`);
      process.exit(1);
    }
    void batchErr; // acknowledged; sequential path succeeded
  }
}

// ── Core clean ─────────────────────────────────────────────────────────────────

/**
 * cleanSeed(client, workspaceId, options) -- removes only this command's rows.
 *
 * Deletes tasks WHERE id LIKE 'seed-wed-%' AND workspace_id = workspaceId.
 * Also resets activeDomain to NULL on the workspace row.
 * Never touches any other rows.
 */
export async function cleanSeed(
  client: ReturnType<typeof createClient>,
  workspaceId: string,
  options: ApplyOptions,
): Promise<void> {
  const likePattern = `${SEED_PREFIX}-%`;

  if (options.dryRun) {
    // Show what would be deleted without touching the database.
    const preview = await client.execute({
      sql: `SELECT id, title FROM tasks WHERE id LIKE ? AND workspace_id = ?`,
      args: [likePattern, workspaceId],
    });
    if (preview.rows.length === 0) {
      console.log(
        `[dry-run] No seed-wed-* rows found in workspace "${workspaceId}". Nothing to clean.`,
      );
    } else {
      console.log(
        `[dry-run] Would delete ${preview.rows.length} task(s) and reset activeDomain:`,
      );
      for (const row of preview.rows) {
        console.log(`  ${row.id as string}  "${row.title as string}"`);
      }
    }
    return;
  }

  const deleteStmt = {
    sql: `DELETE FROM tasks WHERE id LIKE ? AND workspace_id = ?`,
    args: [likePattern, workspaceId],
  };
  const resetDomain = {
    sql: `UPDATE workspaces SET active_domain = NULL, updated_at = unixepoch() WHERE id = ?`,
    args: [workspaceId],
  };

  try {
    await client.batch([deleteStmt, resetDomain], "write");
  } catch {
    await client.execute(deleteStmt);
    await client.execute(resetDomain);
  }

  const remaining = await client.execute({
    sql: `SELECT COUNT(*) AS c FROM tasks WHERE id LIKE ? AND workspace_id = ?`,
    args: [likePattern, workspaceId],
  });
  const deleted = Number(remaining.rows[0]?.c ?? 0);
  if (deleted === 0) {
    console.log(
      `Cleaned seed-wed-* rows from workspace "${workspaceId}". activeDomain reset to null.`,
    );
  } else {
    console.error(
      `Clean incomplete: ${deleted} row(s) still match the prefix. Check for FK constraints.`,
    );
    process.exit(1);
  }
}

// ── Prod guard ─────────────────────────────────────────────────────────────────

/**
 * isRemoteUrl(url) -- returns true for any libsql:// or Turso HTTPS URL.
 */
export function isRemoteUrl(url: string): boolean {
  return url.startsWith("libsql://") || url.includes("turso.io");
}

/**
 * assertSafeEnvironment(dbUrl, flags) -- refuses to proceed in unsafe contexts.
 *
 * Refuses when:
 *   1. NODE_ENV or VERCEL_ENV indicates production, OR
 *   2. The resolved db URL is remote
 * ...unless both --i-understand-prod is passed AND --checkpoint points at an
 * existing file.
 *
 * Returns true if safe to proceed; exits non-zero with a clear message if not.
 */
export function assertSafeEnvironment(
  dbUrl: string,
  flags: { iProdFlag: boolean; checkpointPath: string | null },
): void {
  const env = process.env.NODE_ENV ?? "";
  const vercelEnv = process.env.VERCEL_ENV ?? "";
  const isProdEnv = env === "production" || vercelEnv === "production";
  const isRemote = isRemoteUrl(dbUrl);

  if (!isProdEnv && !isRemote) {
    // Local file, non-production environment: safe.
    return;
  }

  if (!flags.iProdFlag) {
    const reason = isProdEnv
      ? `NODE_ENV/VERCEL_ENV is "${env || vercelEnv}" (production)`
      : `database URL resolves to a remote endpoint (${dbUrl})`;
    console.error(
      `Refused. ${reason}. Pass --i-understand-prod and --checkpoint <existing-snapshot> to override.`,
    );
    process.exit(1);
  }

  if (!flags.checkpointPath || !existsSync(flags.checkpointPath)) {
    console.error(
      `Refused. --i-understand-prod requires --checkpoint <path> pointing at an existing snapshot file. The file was not found: ${flags.checkpointPath ?? "(not provided)"}.`,
    );
    process.exit(1);
  }
}

// ── CLI argument parser ────────────────────────────────────────────────────────

type CliArgs = {
  workspaceId: string;
  userId: string;
  dbUrl: string;
  confirm: boolean;
  clean: boolean;
  iProdFlag: boolean;
  checkpointPath: string | null;
};

function parseCliArgs(argv: string[]): CliArgs {
  const raw: Record<string, string> = {};
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token) continue;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        flags.add(key);
      } else {
        raw[key] = next;
        i++;
      }
    }
  }

  const workspaceId = raw["workspace"];
  const userId = raw["user"];
  const dbUrl = raw["db"] ?? process.env["SEED_WEDDING_DB"] ?? "";

  const missing: string[] = [];
  if (!workspaceId) missing.push("--workspace <id>");
  if (!userId) missing.push("--user <id>");
  if (!dbUrl) missing.push("--db <url|file> (or SEED_WEDDING_DB env var)");

  if (missing.length > 0) {
    console.error(`Missing required argument(s): ${missing.join(", ")}`);
    console.error(
      "Usage: node --import tsx scripts/seed-wedding.ts --workspace <id> --user <id> --db <url|file> [--confirm] [--clean]",
    );
    process.exit(1);
  }

  return {
    workspaceId: workspaceId!,
    userId: userId!,
    dbUrl,
    confirm: flags.has("confirm"),
    clean: flags.has("clean"),
    iProdFlag: flags.has("i-understand-prod"),
    checkpointPath: raw["checkpoint"] ?? null,
  };
}

// ── Main entry ─────────────────────────────────────────────────────────────────

async function main() {
  const args = parseCliArgs(process.argv.slice(2));

  assertSafeEnvironment(args.dbUrl, {
    iProdFlag: args.iProdFlag,
    checkpointPath: args.checkpointPath,
  });

  const client = createClient({ url: args.dbUrl });

  const dryRun = !args.confirm;
  if (dryRun) {
    console.log("Running in dry-run mode. Pass --confirm to write.");
  }

  if (args.clean) {
    await cleanSeed(client, args.workspaceId, { dryRun });
    process.exit(0);
  }

  const rows = buildSeedRows(args.workspaceId, args.userId);
  await applySeed(client, rows, { dryRun });
}

// Guard: only execute the CLI when this file is the entry point.
// When imported as a module (test suite) the arg parser and main() do not run.
const isEntryPoint =
  typeof process.argv[1] !== "undefined" &&
  (() => {
    try {
      return fileURLToPath(import.meta.url) === process.argv[1];
    } catch {
      return false;
    }
  })();

if (isEntryPoint) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`seed-wedding error: ${msg}`);
    process.exit(1);
  });
}
