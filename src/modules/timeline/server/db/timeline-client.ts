import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./timeline-schema";

/**
 * libSQL client for the Timeline module.
 *
 * Production reads the Timeline Turso instance via TIMELINE_DATABASE_URL /
 * TIMELINE_AUTH_TOKEN. Preview builds may not have the Turso secrets, so
 * they fall back to a local file client keeping Vercel preview deployable.
 *
 * Env: TIMELINE_DATABASE_URL / TIMELINE_AUTH_TOKEN (2026-07-31 convention).
 *
 * The original roadmap DB env vars are intentionally NOT read here so a
 * production misconfiguration (old var name left in Vercel) fails fast
 * at init rather than silently reading the wrong database.
 */

const url = process.env.TIMELINE_DATABASE_URL ?? "file:roadmap.db";
const authToken = process.env.TIMELINE_AUTH_TOKEN;

// Remote Turso connections require a token. Fail loudly at startup rather
// than silently passing undefined and getting auth errors mid-request.
if (url.startsWith("libsql:") && !authToken) {
  throw new Error(
    "TIMELINE_AUTH_TOKEN required for remote Turso DB " +
      "(url starts with libsql:). Set the env var or switch to a local " +
      "file URL for development.",
  );
}

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
export { schema };
