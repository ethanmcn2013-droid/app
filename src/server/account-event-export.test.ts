import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { exportAccountData } from "./account-export";
import { entitlements, tasks, users, workspaceMembers, workspaces } from "./db/schema";
import { fixture, checkout, sync, designation, receipts, PAID, END } from "./db/event-designation-test-fixture";

const purchaseKeys = ["id", "workspaceId", "checkoutAuthorizedAt", "providerReference", "settledAt", "originalExpiresAt", "designation", "reason", "settlementAuthorizedAt", "revoked"].sort();
const effectKeys = ["workspaceId", "settledAt", "originalExpiresAt", "designation", "revoked"].sort();

async function transfer(f: Awaited<ReturnType<typeof fixture>>) {
  await f.local.db.update(workspaces).set({ ownerUserId: "next-owner", name: "PRIVATE-SURVIVING-PROJECT" })
    .where(eq(workspaces.id, "project-a"));
  await f.local.db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, "project-a"), eq(workspaceMembers.userId, "buyer")));
  await f.local.db.insert(tasks).values({ id: "private-new-task", workspaceId: "project-a", title: "PRIVATE-SURVIVING-CONTENT", lane: "todo", priority: "p2" });
}

test("purchaser export includes unbound and bound pending checkout facts, without inventing owner effects", async () => {
  const f = await fixture();
  try {
    const unbound = await designation.prepareEventCheckoutWith(f.local.db, { actorUserId: "buyer", workspaceId: "project-a" });
    const bound = await checkout(f);
    const result = await exportAccountData(f.local.db, "buyer");
    assert.equal(result.eventPurchases?.length, 2);
    for (const row of result.eventPurchases!) {
      assert.deepEqual(Object.keys(row).sort(), purchaseKeys);
      assert.equal(row.designation, "pending");
      assert.equal(row.originalExpiresAt, null);
      assert.equal(row.settledAt, null);
    }
    assert.equal(result.eventPurchases!.find(row => row.id === unbound)?.providerReference, null);
    assert.equal(result.eventPurchases!.find(row => row.id === bound.eventDesignation!.intentId)?.providerReference, bound.reference);
    assert.deepEqual(result.ownedWorkspaces?.eventProjectEffects, []);
  } finally { f.close(); }
});

test("purchaser keeps their exact payment facts after transfer/removal without the surviving project's content or name", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await sync(f, input); await transfer(f);
    const result = await exportAccountData(f.local.db, "buyer");
    assert.equal(result.eventPurchases?.length, 1);
    assert.deepEqual(Object.keys(result.eventPurchases![0]).sort(), purchaseKeys);
    assert.equal(result.eventPurchases![0].id, input.eventDesignation!.intentId);
    assert.equal(result.eventPurchases![0].providerReference, input.reference);
    assert.equal(result.eventPurchases![0].workspaceId, "project-a");
    assert.equal(result.eventPurchases![0].originalExpiresAt?.getTime(), END.getTime());
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE-SURVIVING|private-new-task/);
    assert.deepEqual(result.ownedWorkspaces?.eventProjectEffects, []);
  } finally { f.close(); }
});

test("new primary owner receives only project effects, including redaction of the existing Event entitlement projection", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await sync(f, input); await transfer(f);
    const result = await exportAccountData(f.local.db, "next-owner");
    assert.deepEqual(result.eventPurchases, []);
    assert.equal(result.ownedWorkspaces?.eventProjectEffects.length, 1);
    const effect = result.ownedWorkspaces!.eventProjectEffects[0];
    assert.deepEqual(Object.keys(effect).sort(), effectKeys);
    assert.deepEqual(effect, { workspaceId: "project-a", settledAt: PAID, originalExpiresAt: END, designation: "designated", revoked: false });
    assert.deepEqual(Object.keys(result.ownedWorkspaces!.entitlements[0]).sort(), ["expiresAt", "source", "startedAt", "tier", "workspaceId"]);
    assert.doesNotMatch(JSON.stringify(result), /buyer|eci_|stripe:cs_|cus_/);
    assert.match(JSON.stringify(result), /PRIVATE-SURVIVING-CONTENT/);
  } finally { f.close(); }
});

test("paid-undesignated outcome stays purchaser-owned and cannot be exported as the new owner's governing effect", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await transfer(f);
    await assert.rejects(sync(f, input), /reconciliation/i);
    const payer = await exportAccountData(f.local.db, "buyer");
    assert.equal(payer.eventPurchases?.[0].designation, "paid_undesignated");
    assert.equal(payer.eventPurchases?.[0].reason, "owner_changed");
    assert.equal(payer.eventPurchases?.[0].providerReference, input.reference);
    assert.doesNotMatch(JSON.stringify(payer), /PRIVATE-SURVIVING/);
    const owner = await exportAccountData(f.local.db, "next-owner");
    assert.deepEqual(owner.ownedWorkspaces?.eventProjectEffects, []);
    assert.deepEqual(owner.eventPurchases, []);
  } finally { f.close(); }
});

test("refund and failed shared mirror preserve exportable local negative facts and the original positive term", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await sync(f, input);
    f.dependencies.sharedDatabase = new Proxy(f.shared, { get() { throw new Error("synthetic shared export outage"); } });
    await assert.rejects(sync(f, { ...input, revoked: true }));
    const result = await exportAccountData(f.local.db, "buyer");
    assert.equal(result.eventPurchases?.[0].revoked, true);
    assert.equal(result.eventPurchases?.[0].originalExpiresAt?.getTime(), END.getTime());
    assert.equal(result.ownedWorkspaces?.eventProjectEffects[0].revoked, true);
    assert.equal(result.ownedWorkspaces?.entitlements[0].expiresAt?.getTime(), 0);
    assert.doesNotMatch(JSON.stringify(result), /synthetic shared export outage/);
  } finally { f.close(); }
});

test("refund-first export retains the recorded original term without claiming a completed active purchase", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await sync(f, { ...input, revoked: true });
    const result = await exportAccountData(f.local.db, "buyer");
    assert.equal(result.eventPurchases?.[0].revoked, true);
    assert.equal(result.eventPurchases?.[0].originalExpiresAt?.getTime(), END.getTime());
    assert.equal(result.ownedWorkspaces?.eventProjectEffects[0].revoked, true);
  } finally { f.close(); }
});

for (const foreignKeys of [false, true]) for (const refunded of [false, true]) {
  test(`actual purchaser erasure leaves anonymous owner effects and no reassigned account facts (FK=${foreignKeys}, refund=${refunded})`, async () => {
    const f = await fixture();
    try {
      await f.local.client.execute(`PRAGMA foreign_keys=${foreignKeys ? "ON" : "OFF"}`);
      const input = await checkout(f); await sync(f, input);
      if (refunded) await sync(f, { ...input, revoked: true });
      await transfer(f);
      const { eraseAccountData } = await import("./account-erasure");
      await eraseAccountData(f.local.db, "buyer");
      const retained = (await receipts(f))[0];
      assert.equal(retained.purchaserUserId, null);
      const result = await exportAccountData(f.local.db, "next-owner");
      assert.deepEqual(result.eventPurchases, []);
      assert.deepEqual(result.ownedWorkspaces?.eventProjectEffects, [{ workspaceId: "project-a", settledAt: PAID, originalExpiresAt: END, designation: "designated", revoked: refunded }]);
      assert.doesNotMatch(JSON.stringify(result), /buyer|eci_|ered_|stripe:cs_|cus_/);
      assert.equal((await exportAccountData(f.local.db, "buyer")).user, null);
      await f.local.db.delete(workspaces).where(eq(workspaces.id, "project-a"));
      assert.deepEqual((await exportAccountData(f.local.db, "next-owner")).ownedWorkspaces?.eventProjectEffects, []);
    } finally { f.close(); }
  });
}

test("co-owner/member/outsider cannot export another purchaser's facts or primary-owner effects", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await sync(f, input);
    for (const actor of ["co-owner", "member", "outsider"]) {
      const result = await exportAccountData(f.local.db, actor);
      assert.deepEqual(result.eventPurchases, []);
      assert.deepEqual(result.ownedWorkspaces?.eventProjectEffects, []);
      assert.equal(JSON.stringify(result).includes(input.reference), false);
    }
    // The export resolves the authenticated Clerk subject to the stored local id.
    await f.local.db.update(users).set({ clerkId: "buyer-login" }).where(eq(users.id, "buyer"));
    assert.equal((await exportAccountData(f.local.db, "buyer-login")).eventPurchases?.[0].providerReference, input.reference);
    assert.equal((await exportAccountData(f.local.db, "buyer")).user, null);
  } finally { f.close(); }
});

test("legacy Event terms remain portable without historical designation inference; other entitlement shapes are preserved", async () => {
  const f = await fixture();
  try {
    await f.local.db.insert(entitlements).values([
      { id: "old-event", workspaceId: "project-a", userId: "outsider", tier: "event", source: "purchase", notes: "stripe:cs_PRIVATE_OLD_REFERENCE", startedAt: PAID, expiresAt: END },
      { id: "existing-pro", workspaceId: "project-a", userId: "buyer", tier: "workspace", source: "comp", startedAt: PAID },
    ]);
    const result = await exportAccountData(f.local.db, "buyer");
    assert.deepEqual(result.eventPurchases, []);
    assert.deepEqual(result.ownedWorkspaces?.eventProjectEffects, []);
    const event = result.ownedWorkspaces!.entitlements.find(row => row.tier === "event");
    assert.deepEqual(event, { workspaceId: "project-a", tier: "event", source: "purchase", startedAt: PAID, expiresAt: END });
    assert.equal(JSON.stringify(result).includes("PRIVATE_OLD_REFERENCE"), false);
    assert.equal(result.ownedWorkspaces!.entitlements.some(row => "id" in row && row.id === "existing-pro"), true);
  } finally { f.close(); }
});
