import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Signal user-preferences schema — ported from signal/src/lib/db/schema.ts.
 * Owns cadence/unsubscribeToken for the briefing email.
 */

export const CADENCES = ["daily", "weekly", "off"] as const;
export type Cadence = (typeof CADENCES)[number];

export const userPreferences = sqliteTable(
  "user_preferences",
  {
    userId: text("user_id").primaryKey(),
    email: text("email").notNull(),
    cadence: text("cadence").notNull().default("weekly"),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    lastSentAt: integer("last_sent_at"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("user_preferences_cadence_last_sent_idx").on(
      t.cadence,
      t.lastSentAt,
    ),
  ],
);

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
