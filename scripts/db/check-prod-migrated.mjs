// CI drift gate: fail if the production tasks DB has migrations that the
// deployed code expects but that were never applied. This catches the exact
// failure mode behind the 2026-07-22 /app outage — a merge that shipped code
// needing migrations 0017-0020 while prod sat at 0016 (no such column:
// theme_mode). Applying migrations is a separate receipt-gated operator step
// (scripts/db/migrate.mjs), so nothing else guarantees they were run.
//
// Read-only: it only runs `migrationStatus` (SELECTs). Requires
// TASKS_DATABASE_URL + TASKS_AUTH_TOKEN (production, read is enough).
import { createClient } from "@libsql/client";
import { migrationStatus } from "./migrate.mjs";

const url = process.env.TASKS_DATABASE_URL || process.env.TURSO_DATABASE_URL;
const authToken =
  process.env.TASKS_AUTH_TOKEN ||
  process.env.TASKS_DATABASE_AUTH_TOKEN ||
  process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error(
    "check-prod-migrated: TASKS_DATABASE_URL and TASKS_AUTH_TOKEN are required.",
  );
  process.exit(2);
}

const client = createClient({ url, authToken });
try {
  const status = await migrationStatus({ client });
  const pending = status.pending ?? [];
  if (pending.length > 0) {
    console.error(
      `\n✖ Production tasks DB is behind the code by ${pending.length} migration(s):\n` +
        pending.map((id) => `    - ${id}`).join("\n") +
        `\n\nThe deployed code expects these columns/tables. Apply them with the\n` +
        `receipt-gated runner before (or right after) the deploy:\n` +
        `    node scripts/db/migrate.mjs migrate --confirm-production=tasks \\\n` +
        `      --environment production --receipt <execution-receipt.json>\n`,
    );
    process.exit(1);
  }
  console.log(`✓ Production tasks DB is current (${status.applied?.length ?? 0} applied, 0 pending).`);
} catch (error) {
  console.error(`check-prod-migrated: ${error.message}`);
  process.exit(2);
} finally {
  client.close();
}
