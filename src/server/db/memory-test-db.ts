import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Build a fresh in-memory libSQL database for integration tests.
 *
 * Normal tests apply the content-addressed current-schema baseline. Historical
 * files 0000-0013 are adoption evidence, not a bootstrap path, and must never
 * be replayed against an existing database.
 *
 * Foreign keys are OFF on purpose: tests that assert tenant deletes and reads
 * must prove the explicit predicates do the work, never a cascade.
 */
export type MemoryTestDbOptions = Readonly<{
  /** Exceptional hook for the focused 0013 legacy-data migration test only. */
  beforeMigration?: (
    filename: string,
    client: ReturnType<typeof createClient>,
  ) => Promise<void>;
}>;

export async function freshMemoryDb(options: MemoryTestDbOptions = {}) {
  const here = dirname(fileURLToPath(import.meta.url));
  const drizzleDir = join(here, "..", "..", "..", "drizzle");
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = OFF");

  if (!options.beforeMigration) {
    await client.executeMultiple(
      readFileSync(join(drizzleDir, "0014_current_schema_baseline.sql"), "utf8"),
    );
  } else {
    // Deliberately isolated historical replay used only to prove 0013's data
    // transformation. The old chain depended on this push-only attachment
    // table, so it is not the supported fresh-database runner.
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
    `);
    const files = readdirSync(drizzleDir)
      .filter((file) => /^\d{4}_.+\.sql$/.test(file) && file < "0014_")
      .sort();
    for (const file of files) {
      await options.beforeMigration(file, client);
      await client.executeMultiple(readFileSync(join(drizzleDir, file), "utf8"));
    }
  }

  return { client, db: drizzle(client, { schema }) };
}
