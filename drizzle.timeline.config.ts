import type { Config } from "drizzle-kit";

/**
 * Drizzle-kit config for the Timeline module database.
 *
 * Used by `timeline:db:push:unsafe` (local dev only — never run against prod).
 * The Timeline DB is a separate Turso instance from the Tasks DB; migrations
 * 0000–0007 in timeline.git remain the canonical ledger for the prod schema.
 * Migration 0007 (audience) must be confirmed applied before cutover.
 *
 * T3 (manifest): TIMELINE_DATABASE_URL / TIMELINE_AUTH_TOKEN env vars.
 * Dev fallback is file:roadmap.db, matching the module client's fallback.
 */
export default {
  schema: "./src/modules/timeline/server/db/timeline-schema.ts",
  out: "./drizzle-timeline",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.TIMELINE_DATABASE_URL ?? "file:roadmap.db",
  },
  verbose: false,
  strict: true,
} satisfies Config;
