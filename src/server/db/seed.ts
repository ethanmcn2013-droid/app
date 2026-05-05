import "server-only";
import { sql } from "drizzle-orm";
import type { Database } from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { SEED_TASKS, USERS } from "@/lib/data";
import { tasks, users } from "./schema";

type DbType = ReturnType<typeof drizzle<typeof import("./schema")>>;

/**
 * Idempotent seed. Runs in a transaction so partial failure leaves
 * the DB empty for a retry on next boot.
 */
export function seedIfEmpty(db: DbType): void {
  const existing = db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .all();
  if ((existing[0]?.count ?? 0) > 0) return;

  // Use the underlying sqlite handle for a sync transaction
  // (better-sqlite3 transactions are sync, which fits here).
  const sqlite = (db.$client as unknown) as Database;
  const tx = sqlite.transaction(() => {
    for (const u of Object.values(USERS)) {
      db.insert(users).values(u).run();
    }
    for (const t of SEED_TASKS) {
      db.insert(tasks).values(t).run();
    }
  });
  tx();
}

// Allow `tsx src/server/db/seed.ts` for explicit re-seed.
if (require.main === module) {
  // Imported lazily to avoid circular boot.
  import("./index").then(({ db }) => {
    seedIfEmpty(db);
    // eslint-disable-next-line no-console
    console.log("seed: done");
  });
}
