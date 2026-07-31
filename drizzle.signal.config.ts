import type { Config } from "drizzle-kit";

/**
 * Drizzle-kit config for the Signal module database.
 *
 * 2026-07-31 data-layer reset: one Signal database — the briefing engine
 * tables plus the folded-in `user_preferences` table (the separate prefs DB
 * is retired). `drizzle-signal/` holds the tracked baseline the production
 * database is created from; `signal:db:push:unsafe` remains local-dev only.
 *
 * Env: SIGNAL_DATABASE_URL / SIGNAL_AUTH_TOKEN.
 * Dev fallback: file:signal.db (matches signal-analytics-client.ts).
 */
export default {
  schema: "./src/modules/signal/server/db/signal-analytics-schema.ts",
  out: "./drizzle-signal",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SIGNAL_DATABASE_URL ?? "file:signal.db",
  },
  verbose: false,
  strict: true,
} satisfies Config;
