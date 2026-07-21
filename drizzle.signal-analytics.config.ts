import type { Config } from "drizzle-kit";

/**
 * Drizzle-kit config for the Signal module analytics database.
 *
 * Used by `signal:analytics:db:push:unsafe` (local dev only — never run against prod).
 * The analytics DB is a separate Turso instance; signal.git migrations remain
 * the canonical ledger for the prod schema.
 *
 * S2: SIGNAL_ANALYTICS_DATABASE_URL (renamed from TURSO_DATABASE_URL in signal.git).
 *     Dev fallback: file:analytics.db (matches signal-analytics-client.ts fallback).
 *
 * S8: ported copy — prod schema owned by signal.git cron + its own drizzle migrations.
 */
export default {
  schema: "./src/modules/signal/server/db/signal-analytics-schema.ts",
  out: "./drizzle-signal-analytics",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SIGNAL_ANALYTICS_DATABASE_URL ?? "file:analytics.db",
  },
  verbose: false,
  strict: true,
} satisfies Config;
