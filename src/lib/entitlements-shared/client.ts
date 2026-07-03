import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Drizzle client for the shared signal-entitlements DB.
 *
 * Connection envs:
 *   - TURSO_ENTITLEMENTS_DATABASE_URL, required
 *   - TURSO_ENTITLEMENTS_AUTH_TOKEN, required in prod
 *
 * On preview/dev environments where the envs are unset the client
 * throws on first use, not at import time, so build-time prerender
 * doesn't crash. Reads should always be wrapped in try/catch and
 * default to `free` on failure, entitlements should NEVER take a
 * product down.
 */
const url = process.env.TURSO_ENTITLEMENTS_DATABASE_URL;
const authToken = process.env.TURSO_ENTITLEMENTS_AUTH_TOKEN;

let cached: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function entitlementsDb() {
  if (cached) return cached;
  if (!url) {
    throw new Error(
      "TURSO_ENTITLEMENTS_DATABASE_URL is not set. Add it to .env.local " +
        "(see signal-entitlements Turso DB; provisioned 2026-05-14 in E-1).",
    );
  }
  const client = createClient({ url, authToken });
  cached = drizzle(client, { schema });
  return cached;
}
