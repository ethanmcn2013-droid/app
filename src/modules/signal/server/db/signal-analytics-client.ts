import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./signal-analytics-schema";

/**
 * Signal DB client — the briefing engine tables plus, since the 2026-07-31
 * data-layer reset, the folded-in `user_preferences` table (the old separate
 * signal-prefs database is retired; one Signal module, one database).
 *
 * Env: SIGNAL_DATABASE_URL / SIGNAL_AUTH_TOKEN.
 * Dev fallback: file:signal.db when SIGNAL_DATABASE_URL is unset outside
 * production.
 *
 * Lazy singleton — construction is deferred to first use so marketing routes
 * and processes without the env vars don't throw at module import.
 */

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const url =
    process.env.SIGNAL_DATABASE_URL ??
    (process.env.NODE_ENV !== "production" ? "file:signal.db" : undefined);
  const authToken = process.env.SIGNAL_AUTH_TOKEN;
  if (!url) {
    throw new Error(
      "SIGNAL_DATABASE_URL is not set. Create a Turso database and " +
        "add the URL to .env.local (or SIGNAL_DATABASE_URL in Vercel).",
    );
  }
  _db = drizzle(createClient({ url, authToken }), { schema });
  return _db;
}

/**
 * Proxy keeps `import { signalAnalyticsDb }` call sites unchanged while
 * deferring client construction to first real use.
 */
export const signalAnalyticsDb = new Proxy({} as DB, {
  get(_t, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
}) as DB;
