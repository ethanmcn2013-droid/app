import assert from "node:assert/strict";
import { before, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { freshFileDb } from "@/server/db/memory-test-db";
import { compCodes, entitlements, meta, users, workspaces, workspaceMembers } from "@/server/db/schema";
import { eraseAccountData } from "@/server/account-erasure";
import { deleteProjectRowsInTransaction } from "@/server/projects/project-deletion-rows";
import { generateCompCode } from "@/lib/comp-code";
import { manifestHash, venueCodeFingerprint, VENUE_ISSUANCE_PATH, type IssuanceCommand } from "@/lib/venue-issuance/protocol";
import { signIssuanceRequest } from "@/lib/venue-issuance/service-auth";
import { handleVenueIssuance } from "./handler";
import { executeVenueIssuance } from "./store";
import { erasedConsumptionKey, readCanonicalVenueClaim } from "./canonical";

let claim: typeof import("@/server/db/comp-redemption").claimCompEntitlement;
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  claim = (await import("@/server/db/comp-redemption")).claimCompEntitlement;
});
const now = Date.parse("2026-09-05T09:00:00Z");
const auth = { secret: "synthetic-issuance-".repeat(3), usageSecret: "synthetic-usage-".repeat(3), keyEpoch: "erasure-1" };
function request(command: IssuanceCommand) {
  const body = JSON.stringify(command);
  return new Request("http://localhost" + VENUE_ISSUANCE_PATH, { method: "POST", headers: signIssuanceRequest(body, auth, now + 3000), body });
}
async function fixture(member = false) {
  const f = await freshFileDb();
  await f.client.execute("PRAGMA journal_mode=WAL");
  for (const id of ["a", "b"]) {
    await f.db.insert(users).values({ id, clerkId: `clerk-${id}`, initials: id, color: "fixture" });
    await f.db.insert(workspaces).values({ id: `project-${id}`, slug: id, name: id, ownerUserId: id, contextType: "wedding" });
    await f.db.insert(workspaceMembers).values({ workspaceId: `project-${id}`, userId: id, role: "owner" });
  }
  if (member) {
    // Claim while authorised, then exercise erasure after an ownership transfer.
    // Current member-only claims are correctly denied by the manager guard.
    await f.db.update(workspaces).set({ ownerUserId: "a" }).where(eq(workspaces.id, "project-b"));
    await f.db.insert(workspaceMembers).values({ workspaceId: "project-b", userId: "a", role: "owner" });
  }
  const codes = [1, 2].map(i => ({ licenseCodeId: "vlc-" + String(i).repeat(32), code: generateCompCode("VENUE") }));
  const input: Extract<IssuanceCommand, { operation: "issue" }> = { operation: "issue", codes, manifest: {
    version: 1, issuanceId: "vi-" + "e".repeat(32), sponsorId: "synthetic-sponsor", sponsorSlug: "synthetic-venue",
    sponsorName: "Synthetic venue", environment: "internal_test", issuedAt: now,
    eligibility: { kind: "standard", reference: "synthetic-payment", startsAt: now - 1000, endsAt: now + 86400000 },
    tier: "wedding", durationDays: 548, codes: codes.map(code => ({ licenseCodeId: code.licenseCodeId, codeFingerprint: venueCodeFingerprint(code.code) })),
  } };
  await executeVenueIssuance(f.db, input, "internal_test", now);
  const claimed = await claim(f.db, { code: codes[0].code, actorUserId: "a", candidateProjectId: member ? "project-b" : "project-a", now: new Date(now + 1000) });
  assert.equal(claimed.ok, true);
  if (!claimed.ok) throw new Error("Fixture claim failed");
  if (member) {
    await f.db.update(workspaces).set({ ownerUserId: "b" }).where(eq(workspaces.id, "project-b"));
    await f.db.update(workspaceMembers).set({ role: "member" }).where(and(eq(workspaceMembers.workspaceId, "project-b"), eq(workspaceMembers.userId, "a")));
  }
  const read = { operation: "read" as const, issuanceId: input.manifest.issuanceId, manifestHash: manifestHash(input.manifest) };
  const withdraw = { ...read, operation: "withdraw" as const, licenseCodeId: codes[1].licenseCodeId };
  const key = erasedConsumptionKey(input.manifest.issuanceId, codes[0].licenseCodeId);
  const service = { database: f.db, auth, environment: "internal_test" as const, enabled: true, now: () => now + 3000 };
  return { ...f, input, claimed, read, withdraw, key, service };
}

for (const member of [false, true]) test(`S2-01: actual ${member ? "member" : "owner"} account erasure preserves batch read/replay and sibling withdrawal`, async () => {
  const f = await fixture(member);
  try {
    await eraseAccountData(f.db, "clerk-a", { deleteStoredBytes: async () => { throw new Error("Unexpected storage call"); } });
    assert.equal((await f.db.select().from(users).where(eq(users.id, "a"))).length, 0);
    assert.equal((await f.db.select().from(entitlements)).length, 0);
    assert.equal((await f.db.select().from(users).where(eq(users.id, "b"))).length, 1);
    assert.equal((await f.db.select().from(workspaces).where(eq(workspaces.id, "project-b"))).length, 1);
    assert.equal(await readCanonicalVenueClaim(f.db, { entitlementId: f.claimed.entitlement.id }), null);
    const receipt = JSON.parse((await f.db.select().from(meta).where(eq(meta.key, f.key)))[0].value);
    assert.deepEqual(receipt, { version: 1, manifestHash: manifestHash(f.input.manifest), codeFingerprint: f.input.manifest.codes[0].codeFingerprint, reason: "grant_erasure" });
    for (const forbidden of ["clerk-a", "project-a", "project-b", f.claimed.entitlement.id, f.input.codes[0].code]) {
      assert.equal(JSON.stringify(receipt).includes(forbidden), false);
    }
    for (const operation of [f.read, f.input]) {
      const response = await handleVenueIssuance(request(operation), f.service);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).codes.map((code: { state: string }) => code.state), ["claimed", "available"]);
    }
    const withdrawal = await handleVenueIssuance(request(f.withdraw), f.service);
    assert.equal(withdrawal.status, 200);
    assert.deepEqual((await withdrawal.json()).codes.map((code: { state: string }) => code.state), ["claimed", "withdrawn"]);
    assert.equal((await f.db.select().from(compCodes).where(eq(compCodes.code, f.input.codes[1].code)))[0].expiresAt?.getTime(), 0);
    assert.equal((await claim(f.db, { code: f.input.codes[1].code, actorUserId: "b", candidateProjectId: "project-b", now: new Date(now + 4000) })).ok, false);
    assert.equal((await claim(f.db, { code: f.input.codes[0].code, actorUserId: "b", candidateProjectId: "project-b", now: new Date(now + 4000) })).ok, false);
    const consumed = await handleVenueIssuance(request({ ...f.withdraw, licenseCodeId: f.input.codes[0].licenseCodeId }), f.service);
    assert.equal(consumed.status, 409);
    assert.deepEqual(await consumed.json(), { error: "already_claimed" });
    await eraseAccountData(f.db, "clerk-a");
    const replay = await executeVenueIssuance(f.db, f.input, "internal_test", now + 5000);
    assert.deepEqual(replay.codes.map(code => code.state), ["claimed", "withdrawn"]);
    assert.equal((await f.db.select().from(compCodes).where(eq(compCodes.code, f.input.codes[0].code)))[0].redeemed, 1);
  } finally { f.cleanup(); }
});

test("project deletion uses the same atomic consumed history without retaining its grant", async () => {
  const f = await fixture();
  try {
    await f.db.transaction(async tx => {
      await deleteProjectRowsInTransaction(tx, "project-a");
      await tx.delete(workspaces).where(eq(workspaces.id, "project-a"));
    });
    assert.equal((await f.db.select().from(users).where(eq(users.id, "a"))).length, 1);
    assert.equal((await f.db.select().from(entitlements)).length, 0);
    assert.equal(await readCanonicalVenueClaim(f.db, { entitlementId: f.claimed.entitlement.id }), null);
    assert.equal((await handleVenueIssuance(request(f.withdraw), f.service)).status, 200);
  } finally { f.cleanup(); }
});

for (const expiresAt of [new Date(0), new Date(now - 1000)]) test(`erasure of ${expiresAt.getTime() === 0 ? "revoked" : "expired"} grant never restores access or capacity`, async () => {
  const f = await fixture();
  try {
    await f.db.update(entitlements).set({ expiresAt }).where(eq(entitlements.id, f.claimed.entitlement.id));
    await eraseAccountData(f.db, "clerk-a");
    assert.equal(await readCanonicalVenueClaim(f.db, { entitlementId: f.claimed.entitlement.id }), null);
    assert.deepEqual((await executeVenueIssuance(f.db, f.read, "internal_test", now + 3000)).codes.map(code => code.state), ["claimed", "available"]);
    assert.equal((await f.db.select().from(entitlements)).length, 0);
  } finally { f.cleanup(); }
});

test("receipt and grant deletion roll back together; actual account erasure retry completes", async () => {
  const f = await fixture();
  try {
    await f.client.execute("CREATE TRIGGER fail_grant_delete BEFORE DELETE ON entitlements BEGIN SELECT RAISE(ABORT,'synthetic delete failure'); END");
    await assert.rejects(eraseAccountData(f.db, "clerk-a"));
    assert.equal((await f.db.select().from(meta).where(eq(meta.key, f.key))).length, 0);
    assert.equal((await f.db.select().from(entitlements)).length, 1);
    assert.equal((await executeVenueIssuance(f.db, f.read, "internal_test", now + 3000)).codes[0].state, "claimed");
    await f.client.execute("DROP TRIGGER fail_grant_delete");
    await eraseAccountData(f.db, "clerk-a");
    assert.equal((await f.db.select().from(meta).where(eq(meta.key, f.key))).length, 1);
    assert.equal((await f.db.select().from(entitlements)).length, 0);
  } finally { f.cleanup(); }
});

test("failed receipt insertion retains the grant and allows an exact retry", async () => {
  const f = await fixture();
  try {
    await f.client.execute("CREATE TRIGGER fail_consumption_receipt BEFORE INSERT ON meta WHEN new.key LIKE 'venue-consumed-erased:%' BEGIN SELECT RAISE(ABORT,'synthetic receipt failure'); END");
    await assert.rejects(eraseAccountData(f.db, "clerk-a"));
    assert.equal((await f.db.select().from(entitlements)).length, 1);
    assert.equal((await f.db.select().from(meta).where(eq(meta.key, f.key))).length, 0);
    await f.client.execute("DROP TRIGGER fail_consumption_receipt");
    await eraseAccountData(f.db, "clerk-a");
    assert.equal((await handleVenueIssuance(request(f.withdraw), f.service)).status, 200);
  } finally { f.cleanup(); }
});

test("legacy comp and personal grants are erased without fabricating canonical issuance receipts", async () => {
  const f = await freshFileDb();
  try {
    await f.db.insert(users).values({ id: "legacy-user", clerkId: "legacy-clerk", initials: "FX", color: "fixture" });
    await f.db.insert(compCodes).values({ code: "LEGACY-CODE", quantity: 1, redeemed: 1, tier: "wedding", durationDays: 548, notes: JSON.stringify({ source_type: "venue_edition" }) });
    await f.db.insert(entitlements).values([
      { id: "legacy-grant", userId: "legacy-user", source: "comp", tier: "wedding", notes: "comp:LEGACY-CODE" },
      { id: "personal-grant", userId: "legacy-user", source: "purchase", tier: "workspace", notes: "synthetic-purchase" },
    ]);
    await eraseAccountData(f.db, "legacy-clerk");
    assert.equal((await f.db.select().from(entitlements)).length, 0);
    assert.equal((await f.db.select().from(meta)).some(row => row.key.startsWith("venue-consumed-erased:")), false);
    assert.equal((await f.db.select().from(compCodes))[0].redeemed, 1);
  } finally { f.cleanup(); }
});

test("missing historical grant without erasure proof remains conflict; no inferred receipt", async () => {
  const f = await fixture();
  try {
    await f.db.delete(entitlements).where(eq(entitlements.id, f.claimed.entitlement.id));
    await eraseAccountData(f.db, "clerk-a");
    assert.equal((await f.db.select().from(meta).where(eq(meta.key, f.key))).length, 0);
    assert.equal((await handleVenueIssuance(request(f.withdraw), f.service)).status, 409);
  } finally { f.cleanup(); }
});

test("terminal receipt rejects binding/counter tampering and cannot authenticate a resurrected grant", async () => {
  const f = await fixture();
  try {
    // Delete the project, retaining its account so a synthetic corrupt restore
    // can exercise the proof reader without violating unrelated foreign keys.
    await f.db.transaction(tx => deleteProjectRowsInTransaction(tx, "project-a"));
    const receiptRow = (await f.db.select().from(meta).where(eq(meta.key, f.key)))[0];
    const original = JSON.parse(receiptRow.value);
    for (const changed of [{ ...original, manifestHash: "0".repeat(64) }, { ...original, codeFingerprint: f.input.manifest.codes[1].codeFingerprint }, { ...original, extra: true }]) {
      await f.db.update(meta).set({ value: JSON.stringify(changed) }).where(eq(meta.key, f.key));
      assert.equal((await handleVenueIssuance(request(f.read), f.service)).status, 409);
    }
    await f.db.update(meta).set({ value: receiptRow.value }).where(eq(meta.key, f.key));
    await f.db.update(compCodes).set({ redeemed: 0 }).where(eq(compCodes.code, f.input.codes[0].code));
    assert.equal((await handleVenueIssuance(request(f.read), f.service)).status, 409);
    await f.db.update(compCodes).set({ redeemed: 1 }).where(eq(compCodes.code, f.input.codes[0].code));
    await f.db.insert(entitlements).values(f.claimed.entitlement);
    assert.equal((await handleVenueIssuance(request(f.read), f.service)).status, 409);
    assert.equal(await readCanonicalVenueClaim(f.db, { entitlementId: f.claimed.entitlement.id }), null);
  } finally { f.cleanup(); }
});
