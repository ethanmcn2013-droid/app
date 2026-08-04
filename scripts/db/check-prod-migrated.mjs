// Read-only CI alarm: fail when production is behind the exact source
// migration ledger. Applying migrations remains a separate receipt-gated
// operator action in scripts/db/migrate.mjs.
import { createClient } from "@libsql/client";
import { migrationStatus } from "./migrate.mjs";

const url = process.env.TASKS_DATABASE_URL;
const authToken = process.env.TASKS_AUTH_TOKEN;

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
      `Production Tasks is behind the source ledger by ${pending.length} migration(s):\n` +
        pending.map((id) => `- ${id}`).join("\n") +
        "\nApply them with the receipt-gated production migration runner.",
    );
    process.exit(1);
  }

  console.log(
    `Production Tasks is current (${status.applied?.length ?? 0} applied, 0 pending).`,
  );
} catch (error) {
  console.error(`check-prod-migrated: ${error.message}`);
  process.exit(2);
} finally {
  client.close();
}
