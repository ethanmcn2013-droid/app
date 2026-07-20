import type { Config } from "drizzle-kit";

/**
 * Drizzle-kit config for the Notes module database.
 *
 * Used by `notes:db:push:unsafe` (local dev only — never run against prod).
 * The Notes DB is a separate Turso instance from the Tasks DB; migrations
 * 0001–0007 in notes.git remain the canonical ledger for the prod schema.
 *
 * D2: dev fallback is file:notes.db, matching the module client's fallback.
 */
export default {
  schema: "./src/modules/notes/server/db/notes-schema.ts",
  out: "./drizzle-notes",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.NOTES_DATABASE_URL ?? "file:notes.db",
  },
  verbose: false,
  strict: true,
} satisfies Config;
