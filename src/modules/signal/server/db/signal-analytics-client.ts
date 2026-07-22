import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./signal-analytics-schema";

/**
 * Signal analytics DB client.
 *
 * S2 env rename: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN →
 * SIGNAL_ANALYTICS_DATABASE_URL / SIGNAL_ANALYTICS_AUTH_TOKEN.
 *
 * Dev fallback: when SIGNAL_ANALYTICS_DATABASE_URL is unset, falls back to
 * file:analytics.db (matching the source repo's dev pattern, updated for the
 * renamed var).
 *
 * Lazy singleton — construction is deferred to first use so marketing routes
 * and processes without the env vars don't throw at module import.
 */

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const url =
    process.env.SIGNAL_ANALYTICS_DATABASE_URL ??
    (process.env.NODE_ENV !== "production" ? "file:analytics.db" : undefined);
  const authToken = process.env.SIGNAL_ANALYTICS_AUTH_TOKEN;
  if (!url) {
    throw new Error(
      "SIGNAL_ANALYTICS_DATABASE_URL is not set. Create a Turso database and " +
        "add the URL to .env.local (or SIGNAL_ANALYTICS_DATABASE_URL in Vercel).",
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
