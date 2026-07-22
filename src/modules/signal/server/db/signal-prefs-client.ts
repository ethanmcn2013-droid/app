import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./signal-prefs-schema";

/**
 * Signal user-preferences DB client.
 *
 * S2 env rename: TURSO_ANALYTICS_DATABASE_URL / TURSO_ANALYTICS_AUTH_TOKEN →
 * SIGNAL_PREFS_DATABASE_URL / SIGNAL_PREFS_AUTH_TOKEN.
 *
 * NO dev-file fallback (S2 decision): the prefs DB is Turso-only. Missing
 * vars throw at first use so pages that never touch prefs (e.g. legacy brief
 * in demo mode) stay healthy. The throw is at getDb() call time, not at
 * module import.
 */

type DB = ReturnType<typeof drizzle<typeof schema>>;

let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const url = process.env.SIGNAL_PREFS_DATABASE_URL;
  const authToken = process.env.SIGNAL_PREFS_AUTH_TOKEN;
  if (!url) {
    throw new Error(
      "SIGNAL_PREFS_DATABASE_URL is not set. Add the URL to .env.local " +
        "(or SIGNAL_PREFS_DATABASE_URL in Vercel). The cadence/notification " +
        "preferences surface is unavailable without it.",
    );
  }
  _db = drizzle(createClient({ url, authToken }), { schema });
  return _db;
}

export const signalPrefsDb = new Proxy({} as DB, {
  get(_t, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
}) as DB;
