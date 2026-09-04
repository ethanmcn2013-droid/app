import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { databaseIdentitySha256, migrationStatus, runMigrations } from "./migrate.mjs";

const [databaseUrl, releaseSha] = process.argv.slice(2);
assert.ok(databaseUrl?.startsWith("file:"), "Rehearsal requires a local file; remote targets are refused");
assert.match(releaseSha ?? "", /^[a-f0-9]{40}$/);
const client = createClient({ url: databaseUrl });
try {
  const first = await runMigrations({ client, databaseUrl, environment: "test", releaseSha });
  assert.equal(first.status, "applied");
  const second = await runMigrations({ client, databaseUrl, environment: "test", releaseSha });
  assert.equal(second.status, "no-op");
  const status = await migrationStatus({ client });
  assert.equal(status.state, "current");
  assert.deepEqual(status.pending, []);
  assert.equal(String((await client.execute("PRAGMA integrity_check")).rows[0].integrity_check), "ok");
  assert.equal((await client.execute("PRAGMA foreign_key_check")).rows.length, 0);
  console.log(JSON.stringify({
    schema: "january-migration-rehearsal/1", releaseSha, environment: "test",
    target: "disposable-local-file", targetIdentitySha256: databaseIdentitySha256(databaseUrl),
    firstApply: first.status, secondApply: second.status, state: status.state,
    appliedMigrations: status.applied.map((row) => row.id),
    integrity: "ok", foreignKeyViolations: 0, productionVerified: false,
  }, null, 2));
} finally {
  client.close();
}
