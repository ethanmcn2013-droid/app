import assert from "node:assert/strict";
import { before, test } from "node:test";
import { eq, and } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { pathToFileURL } from "node:url";
import { freshFileDb } from "./memory-test-db";
import { entitlementFixture } from "./entitlements-test-db";
import * as schema from "./schema";
import { compCodes, entitlements, meta, tasks, users, workspaceMembers, workspaces } from "./schema";
import { coupleAccessExpiryMs } from "@/lib/venue-access-term";

let update: typeof import("./sponsored-wedding-date").updateSponsoredWeddingDate;
let read: typeof import("./sponsored-wedding-date").readSponsoredWeddingDate;
let claim: typeof import("./comp-redemption").claimCompEntitlement;
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  ({ updateSponsoredWeddingDate: update, readSponsoredWeddingDate: read } = await import("./sponsored-wedding-date"));
  claim = (await import("./comp-redemption")).claimCompEntitlement;
});
const now = new Date("2026-09-05T12:00:00Z");
const sponsor = JSON.stringify({ source_type: "venue_edition", sponsor_slug: "synthetic", sponsor_name: "Synthetic venue" });

test("current effective-tier reader sees the repaired term in its Project; revocation and personal/other-Project access remain unchanged", async () => {
  const f = await entitlementFixture(); try {
    const { getEffectiveTier } = await import("./entitlements");
    await f.local.db.update(workspaces).set({ contextType: "wedding" }).where(eq(workspaces.id, "project-a"));
    await f.local.db.insert(compCodes).values({ code: "SYNTHETIC", tier: "wedding", durationDays: 548, quantity: 1, notes: sponsor });
    await f.local.db.insert(entitlements).values({ id: "sponsored", userId: "buyer", workspaceId: "project-a", tier: "wedding", source: "comp", notes: "comp:SYNTHETIC", startedAt: new Date("2020-01-01T00:00:00Z"), expiresAt: new Date("2021-07-02T00:00:00Z") });
    assert.equal(await getEffectiveTier("buyer", "project-a", f.dependencies), "free");
    const result = await update(f.local.db, { actorUserId: "buyer", projectId: "project-a", expectedRevision: 1, weddingDate: "2030-06-01" }, now);
    assert.ok(result.ok);
    assert.equal(await getEffectiveTier("buyer", "project-a", f.dependencies), "wedding");
    assert.equal(await getEffectiveTier("buyer", "project-b", f.dependencies), "free");
    assert.equal(await getEffectiveTier("buyer", null, f.dependencies), "free");
    await f.local.db.update(entitlements).set({ expiresAt: new Date(0) });
    assert.ok((await update(f.local.db, { actorUserId: "buyer", projectId: "project-a", expectedRevision: 2, weddingDate: "2035-06-01" }, now)).ok);
    assert.equal(await getEffectiveTier("buyer", "project-a", f.dependencies), "free");
    assert.equal((await f.shared.select().from((await import("@/lib/entitlements-shared/schema")).entitlements)).length, 0);
  } finally { f.close(); }
});
async function fixture() {
  const f = await freshFileDb();
  await f.client.execute("PRAGMA journal_mode=WAL");
  for (const id of ["owner", "manager", "editor", "outsider"]) await f.db.insert(users).values({ id, clerkId: id, initials: "FX", color: "fixture" });
  for (const id of ["a", "b"]) {
    const owner = id === "a" ? "owner" : "outsider";
    await f.db.insert(workspaces).values({ id, slug: id, name: id, ownerUserId: owner, contextType: "wedding" });
    await f.db.insert(workspaceMembers).values({ workspaceId: id, userId: owner, role: "owner" });
  }
  await f.db.insert(workspaceMembers).values([{ workspaceId: "a", userId: "manager", role: "owner" }, { workspaceId: "a", userId: "editor", role: "member" }]);
  await f.db.insert(compCodes).values({ code: "SYNTHETIC", tier: "wedding", durationDays: 548, quantity: 4, notes: sponsor });
  assert.equal((await claim(f.db, { code: "SYNTHETIC", actorUserId: "owner", candidateProjectId: "a", now })).ok, true);
  await f.db.insert(meta).values({ key: "project-target-date:a", value: "2028-12-12" });
  const state = await read(f.db, { actorUserId: "owner", projectId: "a" }, now);
  assert.ok(state);
  return { ...f, input: { actorUserId: "owner", projectId: "a", expectedRevision: state.revision, weddingDate: "2029-06-01" } };
}
async function snapshot(f: Awaited<ReturnType<typeof fixture>>) {
  return { projects: await f.db.select().from(workspaces), grants: await f.db.select().from(entitlements), tasks: await f.db.select().from(tasks), meta: await f.db.select().from(meta) };
}

test("real claim starts without a date; canonical save extends its grant, never imports the old generic target or retimes tasks", async () => {
  const f = await fixture(); try {
    const before = await snapshot(f);
    assert.equal(before.projects.find(p => p.id === "a")!.primaryDate, null);
    assert.equal(before.grants[0].expiresAt!.getTime(), coupleAccessExpiryMs({ redeemedAtMs: now.getTime() }));
    const result = await update(f.db, f.input, now); assert.ok(result.ok); if (!result.ok) return;
    assert.equal(result.data.weddingDate, "2029-06-01");
    assert.deepEqual(result.data.access, { status: "active", expiresAt: "2029-08-30T00:00:00.000Z" });
    const after = await snapshot(f);
    assert.equal(after.projects.find(p => p.id === "a")!.primaryDate, "2029-06-01");
    assert.deepEqual(after.tasks, before.tasks); assert.deepEqual(after.meta, before.meta);
    assert.deepEqual(await read(f.db, { projectId: "a", actorUserId: "owner" }, now), result.data);
  } finally { f.cleanup(); }
});

test("earlier, later, missing and identical dates preserve granted time and return durable readbacks", async () => {
  const f = await fixture(); try {
    let input = f.input;
    let expectedEnd = "2029-08-30T00:00:00.000Z";
    for (const date of ["2029-06-01", "2028-02-29", null, "2030-06-01", "2030-06-01"]) {
      const result = await update(f.db, { ...input, weddingDate: date }, now); assert.ok(result.ok); if (!result.ok) return;
      if (date === "2030-06-01") expectedEnd = "2030-08-30T00:00:00.000Z";
      assert.equal(result.data.weddingDate, date); assert.equal(result.data.access.expiresAt, expectedEnd);
      input = { ...input, expectedRevision: result.data.revision };
    }
  } finally { f.cleanup(); }
});

test("unknown date keeps the 548-day floor; malformed dates reject without writes", async () => {
  const f = await fixture(); try {
    const initial = await snapshot(f);
    assert.ok((await update(f.db, { ...f.input, weddingDate: null }, now)).ok);
    assert.deepEqual(await snapshot(f), initial);
    for (const date of ["2027-02-29", "2028-02-30", "", "tomorrow", "2028-06-01T12:00:00Z", 9, {}]) {
      assert.deepEqual(await update(f.db, { ...f.input, weddingDate: date as string }, now), { ok: false, reason: "invalid-date" });
      assert.deepEqual(await snapshot(f), initial);
    }
  } finally { f.cleanup(); }
});

test("elapsed positive terms may extend under D-022; revoked grants stay revoked", async () => {
  for (const revoked of [false, true]) {
    const f = await fixture(); try {
      await f.db.update(entitlements).set({ startedAt: new Date("2020-01-01T00:00:00Z"), expiresAt: revoked ? new Date(0) : new Date("2021-07-02T00:00:00Z") });
      assert.equal((await read(f.db, { actorUserId: "owner", projectId: "a" }, now))!.access.status, revoked ? "revoked" : "expired");
      const result = await update(f.db, f.input, now); assert.ok(result.ok); if (!result.ok) return;
      assert.equal(result.data.access.status, revoked ? "revoked" : "active");
      assert.equal((await f.db.select().from(entitlements))[0].expiresAt!.toISOString(), revoked ? "1970-01-01T00:00:00.000Z" : "2029-08-30T00:00:00.000Z");
    } finally { f.cleanup(); }
  }
});

test("an expired term remains expired when the new wedding date cannot extend it into the present", async () => {
  const f = await fixture(); try {
    await f.db.update(entitlements).set({ startedAt: new Date("2020-01-01T00:00:00Z"), expiresAt: new Date("2021-07-02T00:00:00Z") });
    const result = await update(f.db, { ...f.input, weddingDate: "2021-01-01" }, now); assert.ok(result.ok); if (result.ok) assert.equal(result.data.access.status, "expired");
  } finally { f.cleanup(); }
});

test("co-manager can set the project date; own-account access readback does not claim another recipient's grant", async () => {
  const f = await fixture(); try {
    assert.equal((await read(f.db, { actorUserId: "manager", projectId: "a" }, now))!.canManage, true);
    const result = await update(f.db, { ...f.input, actorUserId: "manager" }, now); assert.ok(result.ok);
    if (result.ok) assert.deepEqual(result.data.access, { status: "none", expiresAt: null });
    assert.equal((await f.db.select().from(entitlements))[0].expiresAt!.toISOString(), "2029-08-30T00:00:00.000Z");
  } finally { f.cleanup(); }
});

for (const refusal of ["editor", "outsider", "wrong-project", "missing-project", "removed-manager", "demoted-manager", "archived", "wrong-domain"] as const) {
  test(refusal + " cannot change a date or any access", async () => {
    const f = await fixture(); try {
      const input = { ...f.input };
      if (refusal === "editor" || refusal === "outsider") input.actorUserId = refusal;
      if (refusal === "wrong-project") input.projectId = "b";
      if (refusal === "missing-project") input.projectId = "missing";
      if (refusal === "removed-manager" || refusal === "demoted-manager") {
        input.actorUserId = "manager";
        const where = and(eq(workspaceMembers.workspaceId, "a"), eq(workspaceMembers.userId, "manager"));
        if (refusal === "removed-manager") await f.db.delete(workspaceMembers).where(where);
        else await f.db.update(workspaceMembers).set({ role: "member" }).where(where);
      }
      if (refusal === "archived") await f.db.update(workspaces).set({ archivedAt: now }).where(eq(workspaces.id, "a"));
      if (refusal === "wrong-domain") await f.db.update(workspaces).set({ contextType: "project", activeDomain: "student" }).where(eq(workspaces.id, "a"));
      const before = await snapshot(f);
      assert.deepEqual(await update(f.db, input, now), { ok: false, reason: "unavailable" });
      assert.deepEqual(await snapshot(f), before);
    } finally { f.cleanup(); }
  });
}

test("project scope, grant provenance and recipient membership exclude independent and ineligible grants", async () => {
  const f = await fixture(); try {
    await f.db.insert(compCodes).values({ code: "GIFT", tier: "wedding", durationDays: 548, quantity: 2, notes: "ordinary gift" });
    const common = { userId: "owner", tier: "wedding" as const, source: "comp" as const, workspaceId: "a", startedAt: now, expiresAt: new Date("2028-03-06T12:00:00Z"), notes: "comp:SYNTHETIC" };
    await f.db.insert(entitlements).values([
      { ...common, id: "other-project", workspaceId: "b" }, { ...common, id: "personal-comp", workspaceId: null },
      { ...common, id: "event-purchase", tier: "event", source: "purchase", notes: "event-purchase" },
      { ...common, id: "personal-purchase", tier: "workspace", source: "purchase", workspaceId: null },
      { ...common, id: "ordinary-gift", notes: "comp:GIFT" }, { ...common, id: "departed", userId: "outsider" },
      { ...common, id: "future", startedAt: new Date("2030-01-01T00:00:00Z") }, { ...common, id: "unlimited", expiresAt: null },
    ]);
    const before = await f.db.select().from(entitlements);
    const fixed = new Set(["other-project", "personal-comp", "event-purchase", "personal-purchase", "ordinary-gift", "departed", "future", "unlimited"]);
    assert.ok((await update(f.db, f.input, now)).ok);
    assert.deepEqual((await f.db.select().from(entitlements)).filter(row => fixed.has(row.id)), before.filter(row => fixed.has(row.id)));
  } finally { f.cleanup(); }
});

for (const table of ["workspaces", "entitlements"]) {
  test("failure at " + table + " rolls back date, revision and term; retry repairs all", async () => {
    const f = await fixture(); try {
      const before = await snapshot(f);
      await f.client.execute(`CREATE TRIGGER fail_date BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'synthetic date failure'); END`);
      await assert.rejects(() => update(f.db, f.input, now));
      assert.deepEqual(await snapshot(f), before);
      await f.client.execute("DROP TRIGGER fail_date");
      assert.ok((await update(f.db, f.input, now)).ok);
    } finally { f.cleanup(); }
  });
}

test("stale concurrent managers cannot silently overwrite a newer date", async (t) => {
  const f = await fixture();
  const file = String((await f.client.execute("PRAGMA database_list")).rows[0].file);
  const client = createClient({ url: pathToFileURL(file).href });
  try {
    const other = drizzle(client, { schema });
    const results = await Promise.allSettled([update(f.db, f.input, now), update(other, { ...f.input, actorUserId: "manager", weddingDate: "2030-06-01" }, now)]);
    t.diagnostic(JSON.stringify(results));
    assert.equal(results.filter(r => r.status === "fulfilled" && r.value.ok).length, 1);
    for (const result of results) {
      if (result.status === "rejected") assert.match(String(result.reason), /busy|locked/i);
      else if (!result.value.ok) assert.equal(result.value.reason, "conflict");
    }
    // The pinned Windows native libSQL client leaves a failed BEGIN statement
    // open after SQLITE_BUSY. The retained bare-driver control reproduces it
    // without App imports. Reconnect this isolated fixture for the retry;
    // production remote-client recovery is not asserted by this test.
    if (results.some(result => result.status === "rejected")) await client.reconnect();
    assert.deepEqual(await update(other, f.input, now), { ok: false, reason: "conflict" });
  } finally { client.close(); f.cleanup(); }
});

test("an ordinary stale revision refuses without a reconnect or writes", async () => {
  const f = await fixture(); try {
    assert.ok((await update(f.db, f.input, now)).ok);
    const before = await snapshot(f);
    assert.deepEqual(await update(f.db, { ...f.input, weddingDate: "2030-06-01" }, now), { ok: false, reason: "conflict" });
    assert.deepEqual(await snapshot(f), before);
  } finally { f.cleanup(); }
});

for (const scope of ["actor", "owner", "project"]) {
  test(scope + " deletion intent refuses a save", async () => {
    const f = await fixture(); try {
      if (scope === "project") await f.client.execute({ sql: "INSERT INTO project_drive_operations (id,workspace_id,operation_kind,status,dedupe_key) VALUES ('deleting','a','project_delete','pending',?)", args: ["a".repeat(64)] });
      else {
        const { accountDeletionTombstoneKey } = await import("../account-deletion-lifecycle");
        await f.db.insert(meta).values({ key: accountDeletionTombstoneKey(scope === "owner" ? "owner" : "manager"), value: "erasure-requested:v1" });
      }
      const before = await snapshot(f);
      const attempt = () => update(f.db, { ...f.input, actorUserId: "manager" }, now);
      if (scope === "project") await assert.rejects(attempt, /being deleted/);
      else assert.deepEqual(await attempt(), { ok: false, reason: "unavailable" });
      assert.deepEqual(await snapshot(f), before);
    } finally { f.cleanup(); }
  });
}
