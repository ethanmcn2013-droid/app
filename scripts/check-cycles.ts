/**
 * check-cycles — print the max cycle number per project from the live
 * roadmap Turso DB. Run any time you suspect drift between phase.md
 * and the live cycle log (referenced in roadmap AGENTS.md).
 *
 * Speaks raw SQL to libsql via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN —
 * the same connection log-cycle.ts writes through. Bypasses the
 * per-product drizzle schema entirely so this script stays alive
 * across schema reshuffles. (The previous drizzle `roadmap-db` import
 * layer was removed and this script broke silently on import; raw SQL
 * is the durable shape, same rationale as log-cycle.ts.)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL not set — check .env.local");
  }

  const db = createClient({ url, authToken });

  for (const slug of ["studio", "tasks", "roadmap", "portfolio", "luminary-studio"]) {
    const res = await db.execute({
      sql: `SELECT cycle_label FROM tasks WHERE project_slug = ?`,
      args: [slug],
    });
    const cycles = res.rows
      .map((r) => r.cycle_label as string | null)
      .filter((c): c is string => Boolean(c));
    const ints = cycles.flatMap(
      (c) => c.match(/\d+/g)?.map((m) => Number.parseInt(m, 10)) ?? [],
    );
    const max = ints.length ? Math.max(...ints) : null;
    console.log(
      `${slug}: ${res.rows.length} rows · ${cycles.length} cycle-labelled · max=${max}`,
    );
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
