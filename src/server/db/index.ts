import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

const globalForDb = globalThis as unknown as {
  _sqlite?: Database.Database;
  _seeded?: boolean;
};

const sqlite =
  globalForDb._sqlite ?? (globalForDb._sqlite = new Database("./tasks.db"));

sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Auto-seed exactly once per process (HMR-safe).
if (!globalForDb._seeded) {
  globalForDb._seeded = true;
  try {
    seedIfEmpty(db);
  } catch (err) {
    globalForDb._seeded = false;
    // Re-throw so the developer sees the failure clearly.
    throw err;
  }
}
