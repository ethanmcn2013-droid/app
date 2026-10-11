import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";
import { isDemoMode, isProductionMode } from "@/lib/access-mode";
import { shouldSeedImplicitDevelopmentDatabase } from "./development-seed-policy";

/**
 * libSQL client for Tasks. In production (VERCEL=1) this connects to
 * the dedicated tasks Turso database via TASKS_DATABASE_URL +
 * TASKS_AUTH_TOKEN. In local dev it falls back to a file: URL so the
 * dev workflow stays zero-config, `pnpm dev` will create tasks.db in
 * the repo root on first boot exactly as before.
 *
 * One canonical pair since the 2026-07-31 reset — the legacy
 * TURSO_-prefixed portfolio-era variables are retired everywhere.
 *
 * Switching on TASKS_DATABASE_URL presence (not just VERCEL) so a
 * local dev session can also point at the remote DB by setting the env
 * var, which is useful for post-migration smoke tests.
 */

// Fail closed on authenticated Vercel deploys (production AND preview).
// Explicit demo/review previews are the exception: they are intentionally
// database-free and bind to the in-memory client below.
const demoMode = isDemoMode();

if (
  process.env.VERCEL === "1" &&
  !demoMode &&
  !process.env.TASKS_DATABASE_URL
) {
  throw new Error(
    "TASKS_DATABASE_URL is required in all Vercel environments (production and preview). " +
      "Set it (and TASKS_AUTH_TOKEN) in the Vercel project settings.",
  );
}

// Defense in depth: demo/review never receives the configured Turso client.
// Even if a future action forgets its early return, the only reachable data
// store is a process-local, empty SQLite database.
const url = demoMode
  ? "file::memory:"
  : (process.env.TASKS_DATABASE_URL ?? "file:tasks.db");
const authToken = demoMode ? undefined : process.env.TASKS_AUTH_TOKEN;

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });

// Seed the zero-config local fixture once per process. Explicit targets
// and authenticated production access are managed by their own runbooks.
// The global guard prevents repeats during development hot reload.
const globalForDb = globalThis as unknown as { _seeded?: boolean };

if (shouldSeedImplicitDevelopmentDatabase(process.env, {
  demoMode,
  productionMode: isProductionMode(),
  alreadySeeded: globalForDb._seeded === true,
})) {
  globalForDb._seeded = true;
  // Fire-and-forget: seed errors are logged but don't crash the
  // module load. The DB is usable even if seed fails (e.g. already
  // seeded, or a transient network hiccup on first cold start).
  void seedIfEmpty(db).catch((err) => {
    globalForDb._seeded = false;
    console.error("[db] seedIfEmpty failed:", err);
  });
}
