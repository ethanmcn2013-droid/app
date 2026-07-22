import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./notes-schema";

type Db = LibSQLDatabase<typeof schema>;

// Lazy init, defer the env-var check until the first DB call so that
// build-time prerender + dev-without-keys both run cleanly. Queries
// without a configured DB will still throw, just at call-time.

let _libsql: Client | null = null;
let _db: Db | null = null;

function getDb(): Db {
  if (_db) return _db;
  const url =
    process.env.NOTES_DATABASE_URL ?? "file:notes.db"; // dev fallback per D2
  const authToken = process.env.NOTES_AUTH_TOKEN;
  if (!url) {
    throw new Error("NOTES_DATABASE_URL is required");
  }
  _libsql = createClient({ url, authToken });
  _db = drizzle(_libsql, { schema });
  return _db;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const actual = getDb();
    const value = (actual as unknown as Record<string | symbol, unknown>)[prop as string];
    if (typeof value === "function") {
      return value.bind(actual);
    }
    return value;
  },
});
