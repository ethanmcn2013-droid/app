import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

/**
 * libSQL client for Tasks. In production (VERCEL=1) this connects to
 * the dedicated tasks Turso database via TASKS_DATABASE_URL +
 * TASKS_AUTH_TOKEN. In local dev it falls back to a file: URL so the
 * dev workflow stays zero-config — `pnpm dev` will create tasks.db in
 * the repo root on first boot exactly as before.
 *
 * TASKS_DATABASE_URL is intentionally separate from TURSO_DATABASE_URL
 * (which is used by roadmap-db/index.ts and points at the shared
 * roadmap DB). Keeping them apart prevents the tasks seed from hitting
 * the roadmap schema and emitting "table comments has no column named
 * workspace_id".
 *
 * Switching on TASKS_DATABASE_URL presence (not just VERCEL) so a
 * local dev session can also point at the remote DB by setting the env
 * var, which is useful for post-migration smoke tests.
 */

if (process.env.VERCEL === "1" && !process.env.TASKS_DATABASE_URL) {
  throw new Error(
    "TASKS_DATABASE_URL is required in Vercel environments. " +
      "Set it (and TASKS_AUTH_TOKEN) in the Vercel project settings.",
  );
}

const url = process.env.TASKS_DATABASE_URL ?? "file:tasks.db";
const authToken = process.env.TASKS_AUTH_TOKEN;

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });

// Seed once per process (globalThis guard so it doesn't re-run on
// hot-reload in dev). In production the Turso DB is pre-seeded via
// the migration runbook and this becomes a cheap count=0 check that
// exits immediately.
const globalForDb = globalThis as unknown as { _seeded?: boolean };

if (process.env.NODE_ENV === "development" && !globalForDb._seeded) {
  globalForDb._seeded = true;
  // Fire-and-forget: seed errors are logged but don't crash the
  // module load. The DB is usable even if seed fails (e.g. already
  // seeded, or a transient network hiccup on first cold start).
  try {
    void Promise.resolve(
      seedIfEmpty(db as unknown as Parameters<typeof seedIfEmpty>[0]),
    ).catch((err) => {
      globalForDb._seeded = false;
      console.error("[db] seedIfEmpty failed:", err);
    });
  } catch (err) {
    globalForDb._seeded = false;
    console.error("[db] seedIfEmpty failed:", err);
  }
}
