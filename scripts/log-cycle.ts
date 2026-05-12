/**
 * log-cycle — append a cycle row to the shared roadmap Turso DB.
 *
 * Usage:
 *   tsx scripts/log-cycle.ts \
 *     --project tasks \
 *     --cycle 22 \
 *     --title "Live cycle metadata + log-cycle workflow" \
 *     --date 2026-05-07 \
 *     [--status shipped] \
 *     [--description "..."]
 *
 * Notes:
 * - status defaults to "shipped" (log cycles on ship)
 * - kind is "cycle"
 * - cycleLabel is computed as "Cycle <n>"
 * - id is generated as "<slug>-c<n>"; if it collides, the script
 *   appends -2, -3 etc. so re-runs are safe-ish but not idempotent
 *   for the same cycle number with a different title
 *
 * Speaks raw SQL to libsql via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 * Bypasses the per-product drizzle schema entirely so this script
 * stays alive across schema reshuffles.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@libsql/client";

type Args = {
  project: string;
  cycle: number;
  title: string;
  date: string;
  status: "shipped" | "in-flight" | "next" | "blocked" | "refused";
  description?: string;
};

function parseArgs(argv: string[]): Args {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith("--")) {
      const key = k.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith("--")) {
        throw new Error(`Missing value for --${key}`);
      }
      out[key] = val;
      i++;
    }
  }
  for (const required of ["project", "cycle", "title", "date"] as const) {
    if (!out[required]) {
      throw new Error(`Missing --${required}`);
    }
  }
  const cycle = Number.parseInt(out.cycle, 10);
  if (!Number.isFinite(cycle)) throw new Error("--cycle must be an integer");
  const status = (out.status ?? "shipped") as Args["status"];
  return {
    project: out.project,
    cycle,
    title: out.title,
    date: out.date,
    status,
    description: out.description,
  };
}

const PORTFOLIO_WORKSPACE_SLUG = "portfolio";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL not set — check .env.local");
  }

  const db = createClient({ url, authToken });

  // Idempotent workspace row.
  const portfolioOwnerId =
    process.env.PORTFOLIO_OWNER_USER_ID ?? "portfolio";
  await db.execute({
    sql: `
      INSERT OR IGNORE INTO workspaces
        (slug, name, owner_user_id, plan, created_at, updated_at)
      VALUES (?, 'Portfolio', ?, 'free', unixepoch(), unixepoch())
    `,
    args: [PORTFOLIO_WORKSPACE_SLUG, portfolioOwnerId],
  });

  // Find a non-colliding id.
  const baseId = `${args.project}-c${args.cycle}`;
  let id = baseId;
  let suffix = 2;
  while (true) {
    const existing = await db.execute({
      sql: `SELECT id FROM tasks WHERE id = ? LIMIT 1`,
      args: [id],
    });
    if (existing.rows.length === 0) break;
    id = `${baseId}-${suffix}`;
    suffix++;
  }

  const cycleLabel = `Cycle ${args.cycle}`;
  const nowMs = Date.now();
  const completedAt = args.status === "shipped" ? nowMs : null;

  await db.execute({
    sql: `
      INSERT INTO tasks (
        id, project_slug, workspace_slug, title, description, status,
        kind, cycle_label, target_date, sort_order, assignee, is_launch,
        created_at, updated_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'cycle', ?, ?, ?, 'claude-code', 0, ?, ?, ?)
    `,
    args: [
      id,
      args.project,
      PORTFOLIO_WORKSPACE_SLUG,
      `${cycleLabel} — ${args.title}`,
      args.description ?? args.title,
      args.status,
      cycleLabel,
      args.date,
      args.cycle * 10,
      nowMs,
      nowMs,
      completedAt,
    ],
  });

  await db.execute({
    sql: `
      INSERT INTO activity (
        id, workspace_slug, entity_kind, entity_id, action, payload, created_at
      )
      VALUES (?, ?, 'task', ?, 'cycle-logged', ?, ?)
    `,
    args: [
      `act-${id}-${nowMs}`,
      PORTFOLIO_WORKSPACE_SLUG,
      id,
      JSON.stringify({
        cycleLabel,
        status: args.status,
        date: args.date,
      }),
      nowMs,
    ],
  });

  console.log(
    `Logged ${id} → ${args.project} · ${cycleLabel} · ${args.status} · ${args.date}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exit(1);
  });
