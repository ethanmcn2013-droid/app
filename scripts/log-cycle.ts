/**
 * log-cycle — append a cycle row to the roadmap DB.
 *
 * Usage:
 *   tsx scripts/log-cycle.ts \
 *     --project portfolio \
 *     --cycle 22 \
 *     --title "Live cycle metadata + log-cycle workflow" \
 *     --date 2026-05-07 \
 *     [--status shipped] \
 *     [--description "..."]
 *
 * Notes:
 * - status defaults to "shipped" (you only log cycles on ship)
 * - kind defaults to "cycle"
 * - cycleLabel is computed as "Cycle <n>"
 * - id is generated as "<slug>-c<n>"; if it collides, the script
 *   appends -2, -3 etc. so re-runs are safe-ish but not idempotent
 *   for the same cycle number with a different title
 */

// Load env BEFORE the db module evaluates. The db module reads
// process.env at module-evaluation time, so any static import of
// it would lock in whatever env was present at script start —
// usually nothing. We dynamic-import inside main() instead, after
// dotenv has populated process.env.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

type Args = {
  project: string;
  cycle: number;
  title: string;
  date: string;
  status?: "shipped" | "in-flight" | "next" | "blocked" | "refused";
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

/**
 * All portfolio data (Tasks, Luminary Studio, portfolio project rows)
 * lives under this workspace slug. Matches the backfill value applied
 * to legacy null-workspace rows during the Cycle 51 migration.
 */
const PORTFOLIO_WORKSPACE_SLUG = "portfolio";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { db } = await import("../src/server/roadmap-db/index");
  const { tasks, activity, workspaces } = await import("../src/server/roadmap-db/schema");
  const { eq, sql } = await import("drizzle-orm");

  // Ensure the portfolio workspace row exists before any inserts.
  // Uses raw SQL INSERT OR IGNORE so this is idempotent and never
  // collides with the real workspace if it was already created.
  const portfolioOwnerId =
    process.env.PORTFOLIO_OWNER_USER_ID ?? "portfolio";
  await db.run(sql`
    INSERT OR IGNORE INTO workspaces (slug, name, owner_user_id, plan, created_at, updated_at)
    VALUES (
      ${PORTFOLIO_WORKSPACE_SLUG},
      'Portfolio',
      ${portfolioOwnerId},
      'free',
      (unixepoch()),
      (unixepoch())
    )
  `);
  void workspaces; // keep import live

  const baseId = `${args.project}-c${args.cycle}`;
  let id = baseId;
  let suffix = 2;
  while (true) {
    const [existing] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);
    if (!existing) break;
    id = `${baseId}-${suffix}`;
    suffix++;
  }

  const cycleLabel = `Cycle ${args.cycle}`;
  const now = new Date();
  const completedAt = args.status === "shipped" ? now : null;

  await db.insert(tasks).values({
    id,
    projectSlug: args.project,
    workspaceSlug: PORTFOLIO_WORKSPACE_SLUG,
    title: `${cycleLabel} — ${args.title}`,
    description: args.description ?? args.title,
    status: args.status ?? "shipped",
    kind: "cycle",
    cycleLabel,
    targetDate: args.date,
    sortOrder: args.cycle * 10,
    assignee: "claude-code",
    isLaunch: false,
    createdAt: now,
    updatedAt: now,
    completedAt,
  });

  await db.insert(activity).values({
    id: `act-${id}-${Date.now()}`,
    workspaceSlug: PORTFOLIO_WORKSPACE_SLUG,
    entityKind: "task",
    entityId: id,
    action: "cycle-logged",
    payload: JSON.stringify({ cycleLabel, status: args.status, date: args.date }),
    createdAt: now,
  });

  console.log(
    `Logged ${id} → ${args.project} · ${cycleLabel} · ${args.status} · ${args.date}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
