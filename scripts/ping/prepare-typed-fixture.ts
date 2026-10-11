import { pathToFileURL } from "node:url";
import { validPingId } from "@/lib/ping/command";
import { createPingProofFixture, seedProofTask } from "@/server/ping/proof-fixture";
import { PING_TYPED_FIXTURE_KEY, PING_TYPED_FIXTURE_VALUE } from "@/server/ping/runtime";

// Explicit disposable setup; an optional approved test Clerk mapping is never an auth stub.
async function main() {
  const clerkId = process.argv[2];
  if (clerkId !== undefined && !validPingId(clerkId)) throw new Error("invalid_test_mapping");
  const fixture = await createPingProofFixture();
  try {
  await fixture.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,?)", args: [PING_TYPED_FIXTURE_KEY, PING_TYPED_FIXTURE_VALUE] });
  await seedProofTask(fixture.client, "typed-target-a", { assignees: ["bob"], startDay: 2, durationDays: 2 });
  await seedProofTask(fixture.client, "typed-target-b", { assignees: ["bob"], startDay: 4, durationDays: 3 });
  if (clerkId) await fixture.client.execute({ sql: "UPDATE users SET clerk_id=? WHERE id='alice'", args: [clerkId] });
  // Intentional local setup output, never a general request log or public metadata.
  console.log(JSON.stringify({ kind: "isolated_synthetic_typed_setup", databaseUrl: pathToFileURL(fixture.databasePath).href,
    fixtureVersion: PING_TYPED_FIXTURE_VALUE, testMappingSupplied: Boolean(clerkId) }));
  } finally { fixture.client.close(); }
}
void main().catch(() => { console.error("synthetic_typed_setup_failed"); process.exitCode = 1; });
