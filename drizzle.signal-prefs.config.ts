import type { Config } from "drizzle-kit";

/**
 * Drizzle-kit config for the Signal module prefs database.
 *
 * Used by `signal:prefs:db:push:unsafe` (local dev only — never run against prod).
 * The prefs DB is a separate Turso instance; signal.git migrations remain
 * the canonical ledger for the prod schema.
 *
 * S2: SIGNAL_PREFS_DATABASE_URL (renamed from TURSO_ANALYTICS_DATABASE_URL in signal.git).
 *     NO dev fallback — throws at first use if unset (no local file:prefs.db fallback
 *     per S2 binding decision). Must be set explicitly in dev to exercise prefs.
 *
 * S8: ported copy — prod schema owned by signal.git cron + its own drizzle migrations.
 */
const url = process.env.SIGNAL_PREFS_DATABASE_URL;
if (!url) {
  throw new Error(
    "SIGNAL_PREFS_DATABASE_URL is required — the prefs DB has no dev fallback (S2).",
  );
}

export default {
  schema: "./src/modules/signal/lib/db/signal-prefs-schema.ts",
  out: "./drizzle-signal-prefs",
  dialect: "sqlite",
  dbCredentials: {
    url,
  },
  verbose: false,
  strict: true,
} satisfies Config;
