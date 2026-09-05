// Normal App development identity, real schema and comp claim; isolated files only.
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { freshFileDb } from "../../../src/server/db/memory-test-db";
import { comments, compCodes, entitlements, meta, tasks, users, workspaceMembers, workspaces } from "../../../src/server/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";

async function main() {
  const scratch = resolve(process.argv[2]);
  if (!scratch.includes("sponsored-wedding-date-2026-09-05")) throw Error("Expected task-owned scratch");
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  const { claimCompEntitlement } = await import("../../../src/server/db/comp-redemption");
  const f = await freshFileDb();
  const now = new Date("2026-09-04T12:00:00Z");
  for (const id of ["david", "fixture-owner"]) await f.db.insert(users).values({ id, clerkId: id, name: "Synthetic date reviewer", email: `${id}@example.invalid`, initials: "SD", color: "indigo" });
  await f.db.insert(compCodes).values({ code: "SYNTHETIC-DATE", tier: "wedding", durationDays: 548, quantity: 20, notes: JSON.stringify({ source_type: "venue_edition", sponsor_slug: "synthetic-venue", sponsor_name: "Synthetic venue" }) });
  const states = ["missing", "set", "expired", "revoked", "member", "ordinary"];
  for (const state of states) {
    const id = `wedding-date-${state}`;
    await f.db.insert(workspaces).values({ id, slug: id, name: state === "ordinary" ? "Synthetic launch project" : "Our wedding", ownerUserId: "david", contextType: state === "ordinary" ? "project" : "wedding", primaryDate: state === "set" ? "2029-06-01" : null });
    await f.db.insert(workspaceMembers).values({ workspaceId: id, userId: "david", role: "owner" });
    await f.db.insert(meta).values({ key: `project-target-date:${id}`, value: "2028-12-12" });
    if (state !== "ordinary") {
      // Separate synthetic codes retain the production unique per-user claim key.
      const code = `SYNTHETIC-DATE-${state}`;
      await f.db.insert(compCodes).values({ code, tier: "wedding", durationDays: 548, quantity: 1, notes: JSON.stringify({ source_type: "venue_edition", sponsor_slug: "synthetic-venue", sponsor_name: "Synthetic venue" }) });
      const result = await claimCompEntitlement(f.db, { code, actorUserId: "david", candidateProjectId: id, now });
      if (!result.ok) throw Error(JSON.stringify(result));
      if (state === "expired" || state === "revoked") await f.db.update(entitlements).set({ startedAt: new Date("2020-01-01T00:00:00Z"), expiresAt: state === "revoked" ? new Date(0) : new Date("2021-07-02T00:00:00Z") }).where(eq(entitlements.id, result.entitlement.id));
      if (state === "member") {
        await f.db.update(workspaces).set({ ownerUserId: "fixture-owner" }).where(eq(workspaces.id, id));
        await f.db.update(workspaceMembers).set({ role: "member" }).where(eq(workspaceMembers.workspaceId, id));
        await f.db.insert(workspaceMembers).values({ workspaceId: id, userId: "fixture-owner", role: "owner" });
      }
    }
  }
  const [task] = await f.db.select().from(tasks).limit(1);
  await f.db.insert(comments).values({ id: "synthetic-comment", workspaceId: task.workspaceId, taskId: task.id, userId: "david", body: "Synthetic local fixture." });
  const tasksPath = String((await f.client.execute("PRAGMA database_list")).rows[0].file);
  const sharedUrl = pathToFileURL(join(scratch, `shared-fixture-${Date.now()}.db`)).href;
  const shared = createClient({ url: sharedUrl });
  await shared.executeMultiple(`CREATE TABLE entitlements (id TEXT PRIMARY KEY, user_clerk_id TEXT NOT NULL, tier TEXT NOT NULL, source TEXT NOT NULL, source_ref TEXT, granted_at INTEGER DEFAULT 0, expires_at INTEGER, status TEXT NOT NULL, stripe_customer_id TEXT, stripe_subscription_id TEXT, metadata TEXT, created_at INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0)`);
  shared.close(); f.client.close();
  writeFileSync(join(scratch, "fixture.json"), JSON.stringify({ tasksUrl: pathToFileURL(tasksPath).href, sharedUrl, states, identity: "normal development fallback david; all rows synthetic", seededAt: new Date().toISOString() }, null, 2));
  console.log("Seeded isolated real-schema fixtures for " + states.join(", "));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
