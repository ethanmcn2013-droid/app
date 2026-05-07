import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

/**
 * SQLite-backed Drizzle. Locally this opens `./tasks.db` (writable).
 *
 * On Vercel the working directory is read-only at request time; the
 * deploy ships a pre-seeded `tasks.db` (committed alongside this file)
 * which the bundler copies into `/var/task`. We open it via an
 * absolute path resolved from this module's own URL so the lookup
 * survives the bundler's path mangling. WAL journal mode requires a
 * writable filesystem — Vercel gives us `/tmp`, so we copy the bundled
 * file there once per cold start and open the copy in WAL.
 */

import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ON_VERCEL = !!process.env.VERCEL;

function resolveDbPath(): string {
  if (!ON_VERCEL) return "./tasks.db";
  // Find the bundled tasks.db relative to project root inside /var/task.
  // Next.js bundles it because we reference it via process.cwd() below.
  const cwd = process.cwd();
  const bundled = join(cwd, "tasks.db");
  const writable = "/tmp/tasks.db";
  try {
    mkdirSync("/tmp", { recursive: true });
    if (existsSync(bundled) && !existsSync(writable)) {
      copyFileSync(bundled, writable);
    }
  } catch {
    // Surface as a regular DB-open failure below.
  }
  return writable;
}

const globalForDb = globalThis as unknown as {
  _sqlite?: Database.Database;
  _seeded?: boolean;
};

const sqlite =
  globalForDb._sqlite ??
  (globalForDb._sqlite = new Database(resolveDbPath()));

// /tmp on Vercel doesn't tolerate WAL well — MEMORY journaling keeps
// the per-instance DB self-contained without touching the filesystem
// for the journal file. Locally we keep the standard WAL.
sqlite.pragma(ON_VERCEL ? "journal_mode = MEMORY" : "journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

if (!globalForDb._seeded) {
  globalForDb._seeded = true;
  try {
    seedIfEmpty(db);
  } catch (err) {
    globalForDb._seeded = false;
    throw err;
  }
}
