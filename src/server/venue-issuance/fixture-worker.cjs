/* eslint-disable @typescript-eslint/no-require-imports -- Private child-process fixture for the paired Studio rehearsal. */
const { createInterface } = require("node:readline");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
// No environment file is loaded. Every database is a newly owned fixture.
process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
const auth = { secret: "synthetic-issuance-only-".repeat(3), usageSecret: "synthetic-usage-only-".repeat(3), keyEpoch: "fixture-1" };
async function main() {
  let f, action;
  const usagePath = join(__dirname, "../sponsored-use/fixture.cjs");
  if (process.argv.includes("--with-usage")) {
    if (!existsSync(usagePath)) throw Error("Usage action fixture dependency is missing");
    f = await require(usagePath).usageFixture({ seedClaim: false });
    action = f.action;
  } else {
    f = await require("../db/memory-test-db.ts").freshFileDb();
    const schema = require("../db/schema.ts");
    for (const id of ["owner", "other"]) await f.db.insert(schema.users).values({ id, clerkId: id, initials: "FX", color: "fixture" });
    for (const id of ["a", "b"]) {
      await f.db.insert(schema.workspaces).values({ id, slug: id, name: id, ownerUserId: "owner", contextType: "wedding" });
      await f.db.insert(schema.workspaceMembers).values({ workspaceId: id, userId: "owner", role: "owner" });
    }
  }
  const handler = require("./handler.ts").handleVenueIssuance;
  const claim = require("../db/comp-redemption.ts").claimCompEntitlement;
  const canonical = require("./canonical.ts").readCanonicalVenueClaim;
  const send = value => process.stdout.write(JSON.stringify(value) + "\n");
  send({ ready: true, actionAvailable: Boolean(action) });
  try {
    for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
      let request;
      try {
        request = JSON.parse(line);
        let result;
        if (request.operation === "http") {
          const response = await handler(new Request(request.url, { method: "POST", headers: request.headers, body: request.body }),
            { database: f.db, auth, environment: "internal_test", enabled: true });
          result = { status: response.status, body: await response.json() };
        } else if (request.operation === "claim") {
          const claimed = await claim(f.db, { code: request.code, actorUserId: request.actor ?? "owner", candidateProjectId: request.project ?? "a", now: new Date() });
          // Entitlement notes contain a bearer: never put them on the IPC result.
          result = claimed.ok ? { ok: true, id: claimed.entitlement.id, project: claimed.entitlement.workspaceId,
            expiresAt: claimed.entitlement.expiresAt?.getTime(), proof: await canonical(f.db, { entitlementId: claimed.entitlement.id }) }
            : { ok: false, reason: claimed.reason };
        } else if (request.operation === "counts") {
          result = {};
          for (const table of ["comp_codes", "entitlements", "tasks", "activities", ...(action ? ["sponsored_use_intents"] : [])])
            result[table] = Number((await f.client.execute("SELECT count(*) AS n FROM " + table)).rows[0].n);
        } else if (request.operation === "failure") {
          if (request.enabled) await f.client.execute("CREATE TRIGGER fixture_issue_failure BEFORE INSERT ON comp_codes WHEN (SELECT count(*) FROM comp_codes)>0 BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
          else await f.client.execute("DROP TRIGGER IF EXISTS fixture_issue_failure");
          result = { configured: true };
        } else if (request.operation === "task" && action) {
          await action({ id: request.taskId, title: "Synthetic first deliberate task", projectId: "a" });
          result = await f.counts();
        } else throw Error("Unknown fixture operation");
        send({ id: request.id, result });
      } catch { send({ id: request?.id, error: "fixture_operation_failed" }); }
    }
  } finally { (f.close ?? f.cleanup)(); }
}
void main().catch(() => { process.stderr.write("Venue fixture failed; no provider or production database used.\n"); process.exitCode = 1; });
