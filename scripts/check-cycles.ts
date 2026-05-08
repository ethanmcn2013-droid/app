// Load env BEFORE the db module evaluates. The db module reads
// process.env at module-evaluation time, so any static import of
// it would lock in whatever env was present at script start —
// usually nothing. We dynamic-import inside main() instead, after
// dotenv has populated process.env.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { db } = await import("../src/server/roadmap-db/index");
  const { tasks } = await import("../src/server/roadmap-db/schema");
  const { eq } = await import("drizzle-orm");

  for (const slug of ["studio", "tasks", "roadmap", "portfolio", "luminary-studio"]) {
    const rows = await db
      .select({ cl: tasks.cycleLabel })
      .from(tasks)
      .where(eq(tasks.projectSlug, slug));
    const cycles = rows.map((r) => r.cl).filter(Boolean) as string[];
    const ints = cycles.flatMap(
      (c) => c.match(/\d+/g)?.map((m) => Number.parseInt(m, 10)) ?? [],
    );
    const max = ints.length ? Math.max(...ints) : null;
    console.log(`${slug}: ${rows.length} rows · ${cycles.length} cycle-labelled · max=${max}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
