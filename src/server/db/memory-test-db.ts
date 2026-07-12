import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Build a fresh in-memory libSQL DB that matches the production Tasks schema,
 * for integration tests (account-erasure, account-export, …).
 *
 * Faithful to prod: replays every `drizzle/*.sql` migration in journal order,
 * after first creating the four tables that live in schema.ts but have NO
 * migration file (created on prod by `drizzle-kit push --force`), they must
 * exist before 0005's backfill `UPDATE attachments …` runs.
 *
 * Foreign keys are OFF on purpose: tests that assert tenant deletes/reads
 * must prove the EXPLICIT predicates do the work, never a cascade.
 */
export type MemoryTestDbOptions = Readonly<{
  beforeMigration?: (
    filename: string,
    client: ReturnType<typeof createClient>,
  ) => Promise<void>;
}>;

export async function freshMemoryDb(options: MemoryTestDbOptions = {}) {
  const here = dirname(fileURLToPath(import.meta.url)); // src/server/db
  const drizzleDir = join(here, "..", "..", "..", "drizzle");

  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = OFF");

  // push-only tables (no migration file), see schema.ts.
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS attachments (
      id text PRIMARY KEY NOT NULL,
      workspace_id text,
      task_id text NOT NULL,
      uploader_user_id text NOT NULL,
      filename text NOT NULL,
      stored_path text NOT NULL,
      mime_type text NOT NULL,
      size_bytes integer NOT NULL,
      created_at integer DEFAULT (unixepoch()) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS roadmap_items (
      id text PRIMARY KEY NOT NULL,
      week integer NOT NULL,
      week_theme text, week_range text, date text, day text,
      kind text NOT NULL,
      channel text, format text, source text, cta text, posting_time text, body text,
      status text DEFAULT 'pending' NOT NULL,
      is_launch integer DEFAULT false NOT NULL,
      note text, blocker_id text,
      ord integer DEFAULT 0 NOT NULL,
      created_at integer DEFAULT (unixepoch()) NOT NULL,
      updated_at integer DEFAULT (unixepoch()) NOT NULL,
      completed_at integer
    );
    CREATE TABLE IF NOT EXISTS blockers (
      id text PRIMARY KEY NOT NULL,
      title text NOT NULL,
      kind text NOT NULL,
      target_date text,
      description text NOT NULL,
      note text,
      resolved_at integer,
      ord integer DEFAULT 0 NOT NULL,
      created_at integer DEFAULT (unixepoch()) NOT NULL,
      updated_at integer DEFAULT (unixepoch()) NOT NULL
    );
    CREATE TABLE IF NOT EXISTS action_items (
      id text PRIMARY KEY NOT NULL,
      category text NOT NULL,
      title text NOT NULL,
      description text,
      status text DEFAULT 'pending' NOT NULL,
      blocker_id text,
      note text,
      priority text DEFAULT 'P1' NOT NULL,
      ord integer DEFAULT 0 NOT NULL,
      created_at integer DEFAULT (unixepoch()) NOT NULL,
      updated_at integer DEFAULT (unixepoch()) NOT NULL,
      completed_at integer
    );
  `);

  const files = readdirSync(drizzleDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    await options.beforeMigration?.(f, client);
    await client.executeMultiple(readFileSync(join(drizzleDir, f), "utf8"));
  }

  // push-only COLUMNS that live in schema.ts but were never migrated
  // (added on prod via `drizzle-kit push --force`). A full `select()` in the
  // code under test enumerates them, so they must exist here too.
  await client.executeMultiple(`
    ALTER TABLE workspaces ADD COLUMN template_id text;
  `);

  return { client, db: drizzle(client, { schema }) };
}
