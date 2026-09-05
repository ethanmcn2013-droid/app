import { test } from "node:test";
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { entitlements, users, workspaceMembers, workspaces } from "./schema";
import { entitlements as sharedEntitlements } from "@/lib/entitlements-shared/schema";
import type { StripeAccess } from "@/server/stripe-access";
import type Stripe from "stripe";
import { assertProjectId } from "@/lib/projects/project-ref";
import { designation, access, lifecycle, evaluator, deletion, authz, fixture, checkout, sync, decision, receipts, localRows, entryPoint, PAID, END, ACTIVE, AFTER } from "./event-designation-test-fixture";

for (const foreignKeys of [false, true]) for (const refunded of [false, true]) {
  test(`actual account erasure after transfer preserves only project effect (FK=${foreignKeys}, refunded=${refunded})`, async () => {
    const f = await fixture();
    try {
      await f.local.client.execute(`PRAGMA foreign_keys=${foreignKeys ? "ON" : "OFF"}`);
      const input = await checkout(f); await sync(f, input);
      if (refunded) await sync(f, { ...input, revoked: true });
      const before = (await receipts(f))[0];
      // This is an ordinary primary-owner transfer, not a seeded designation.
      await f.local.db.update(workspaces).set({ ownerUserId: "next-owner" }).where(eq(workspaces.id, "project-a"));
      const { eraseAccountData } = await import("@/server/account-erasure");
      await eraseAccountData(f.local.db, "buyer");
      assert.equal((await f.local.db.select().from(users).where(eq(users.id, "buyer"))).length, 0);
      const [remaining] = await receipts(f);
      assert.equal(remaining.workspaceId, "project-a");
      assert.equal(remaining.purchaserUserId, null);
      assert.equal(remaining.providerReference, null);
      assert.equal(remaining.checkoutAuthorizedAt, null);
      assert.equal(remaining.settlementAuthorizedAt, null);
      assert.match(remaining.id, /^ered_[0-9a-f]{32}$/);
      assert.notEqual(remaining.id, before.id);
      assert.equal(remaining.designation, "designated");
      assert.equal(remaining.originalExpiresAt?.getTime(), END.getTime());
      assert.equal(remaining.settledAt?.getTime(), PAID.getTime());
      assert.equal(remaining.revoked, refunded);
      assert.deepEqual(await localRows(f), []);
      // Even an independently failing shared eraser cannot make its orphaned
      // mirror positive authority after the local purchaser/grant is gone.
      assert.notEqual((await decision(f, ACTIVE, "next-owner")).kind, "editable");
      await f.shared.delete(sharedEntitlements).where(eq(sharedEntitlements.userClerkId, "buyer"));
      assert.deepEqual(await decision(f, AFTER, "next-owner"), refunded
        ? { kind: "unavailable", reason: "refunded" } : { kind: "verification_unavailable" });
      await assert.rejects(sync(f, input));
      assert.deepEqual((await receipts(f))[0], remaining);
      for (const statement of [
        "UPDATE event_purchase_designations SET purchaser_user_id='next-owner'",
        "UPDATE event_purchase_designations SET provider_reference='stripe:cs_new'",
        "UPDATE event_purchase_designations SET id='eci_rebound'",
        "UPDATE event_purchase_designations SET original_expires_at=original_expires_at+1",
      ]) await assert.rejects(f.local.client.execute(statement));
      await f.local.client.execute("UPDATE event_purchase_designations SET revoked=1");
      await assert.rejects(f.local.client.execute("UPDATE event_purchase_designations SET revoked=0"), /immutable/);
      await f.local.db.insert(entitlements).values({ id: "independent-cover", userId: "next-owner", workspaceId: null,
        tier: "studio", source: "comp", startedAt: ACTIVE, expiresAt: null });
      assert.equal((await decision(f, AFTER, "next-owner")).kind, "editable");
      await eraseAccountData(f.local.db, "buyer"); // no-op, including retained effect
      assert.equal((await receipts(f)).length, 1);
      await eraseAccountData(f.local.db, "next-owner"); // actual owner erases project
      assert.deepEqual(await receipts(f), []);
    } finally { f.close(); }
  });
}

test("checkout proves primary ownership: co-owner/member/outsider/malformed and removed owner cause zero writes/provider calls", async () => {
  const f = await fixture();
  try {
    let calls = 0;
    const create = async () => { calls++; return { id: "cs_bad", url: "https://checkout.invalid" }; };
    for (const actorUserId of ["co-owner", "member", "outsider", "unknown", " buyer "]) {
      await assert.rejects(designation.createEventCheckoutWith(f.local.db, { actorUserId, workspaceId: "project-a" }, create));
    }
    for (const workspaceId of [" project-a", "", "unknown", "https://project.invalid"]) {
      await assert.rejects(designation.createEventCheckoutWith(f.local.db, { actorUserId: "buyer", workspaceId }, create));
    }
    await f.local.db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, "project-a"), eq(workspaceMembers.userId, "buyer")));
    await assert.rejects(designation.createEventCheckoutWith(f.local.db, { actorUserId: "buyer", workspaceId: "project-a" }, create));
    assert.equal(calls, 0);
    assert.deepEqual(await receipts(f), []);
    assert.deepEqual(await localRows(f), []);
  } finally { f.close(); }
});

test("real settlement commits designation and local entitlement together; exact duplicates/concurrent retries preserve one reference and original term", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f);
    await Promise.all([sync(f, input), sync(f, input), sync(f, input)]);
    const [stored] = await receipts(f);
    assert.equal(stored.designation, "designated");
    assert.equal(stored.purchaserUserId, "buyer");
    assert.equal(stored.workspaceId, "project-a");
    assert.equal(stored.providerReference, input.reference);
    assert.equal(stored.settledAt?.getTime(), PAID.getTime());
    assert.equal(stored.originalExpiresAt?.getTime(), END.getTime());
    assert.ok(stored.settlementAuthorizedAt!.getTime() >= stored.checkoutAuthorizedAt!.getTime());
    assert.equal((await localRows(f)).length, 1);
    assert.equal((await f.shared.select().from(sharedEntitlements)).length, 1);
    assert.equal((await decision(f, ACTIVE)).kind, "editable");
    assert.deepEqual(await decision(f), { kind: "read_only", basis: "completed_designated_event" });
    assert.deepEqual(await decision(f, AFTER, "buyer", "project-b"), { kind: "unknown", reason: "no_designation" });
  } finally { f.close(); }
});

test("ownership change at settlement commits paid-undesignated evidence without positive local/shared authority; later owner restoration cannot infer past designation", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f);
    await f.local.db.update(workspaces).set({ ownerUserId: "next-owner" }).where(eq(workspaces.id, "project-a"));
    await assert.rejects(sync(f, input), designation.EventDesignationPendingError);
    const [receipt] = await receipts(f);
    assert.equal(receipt.designation, "paid_undesignated");
    assert.equal(receipt.reason, "owner_changed");
    assert.equal(receipt.originalExpiresAt?.getTime(), END.getTime());
    assert.equal(receipt.settlementAuthorizedAt, null);
    assert.deepEqual(await localRows(f), []);
    assert.deepEqual(await f.shared.select().from(sharedEntitlements), []);
    await f.local.db.update(workspaces).set({ ownerUserId: "buyer" }).where(eq(workspaces.id, "project-a"));
    await assert.rejects(sync(f, input), designation.EventDesignationPendingError);
    assert.equal((await receipts(f))[0].designation, "paid_undesignated");
    assert.deepEqual(await decision(f), { kind: "unknown", reason: "paid_undesignated" });
  } finally { f.close(); }
});

for (const state of ["membership_removed", "project_archived"] as const) {
  test("fresh settlement records " + state + " as undesignated, with no positive writer", async () => {
    const f = await fixture();
    try {
      const input = await checkout(f);
      if (state === "membership_removed") await f.local.db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, "project-a"), eq(workspaceMembers.userId, "buyer")));
      else await f.local.db.update(workspaces).set({ archivedAt: new Date() }).where(eq(workspaces.id, "project-a"));
      await assert.rejects(sync(f, input), designation.EventDesignationPendingError);
      assert.equal((await receipts(f))[0].reason, state);
      assert.deepEqual(await localRows(f), []);
      assert.deepEqual(await f.shared.select().from(sharedEntitlements), []);
    } finally { f.close(); }
  });
}

test("a later primary-owner transfer does not rewrite a completed designation, even after the purchaser loses membership", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await sync(f, input);
    const before = (await receipts(f))[0];
    await f.local.db.update(workspaces).set({ ownerUserId: "next-owner" }).where(eq(workspaces.id, "project-a"));
    await f.local.db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, "project-a"), eq(workspaceMembers.userId, "buyer")));
    await sync(f, input);
    assert.deepEqual((await receipts(f))[0], before);
    assert.deepEqual(await decision(f, AFTER, "next-owner"), { kind: "read_only", basis: "completed_designated_event" });
    assert.deepEqual(await decision(f), { kind: "unavailable", reason: "not_authorized" });
  } finally { f.close(); }
});

test("refund-first and late-positive deliveries preserve epoch-zero and original positive history without archive rights", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f);
    await sync(f, { ...input, revoked: true });
    await sync(f, input);
    const [fact] = await receipts(f);
    assert.equal(fact.revoked, true);
    assert.equal(fact.originalExpiresAt?.getTime(), END.getTime());
    assert.equal((await localRows(f))[0].expiresAt?.getTime(), 0);
    assert.equal((await f.shared.select().from(sharedEntitlements))[0].status, "revoked");
    assert.deepEqual(await decision(f), { kind: "unavailable", reason: "refunded" });
  } finally { f.close(); }
});

test("local negative facts and all validated references commit despite failed shared mirrors; stale positive mirrors cannot retain access", async () => {
  const f = await fixture();
  try {
    const one = await checkout(f, "one"), two = await checkout(f, "two");
    await sync(f, one); await sync(f, two);
    await assert.rejects(access.reconcileStripeAccessBatch([{ ...one, revoked: true }, { ...two, revoked: true }], {
      ...f.dependencies, mirror: async () => { throw new Error("synthetic shared mirror failure"); },
    }));
    assert.equal((await receipts(f)).filter(row => row.revoked).length, 2);
    assert.ok((await localRows(f)).every(row => row.expiresAt?.getTime() === 0));
    assert.ok((await f.shared.select().from(sharedEntitlements)).every(row => row.status === "active"));
    assert.deepEqual(await decision(f), { kind: "unavailable", reason: "refunded" });
    await sync(f, one); await sync(f, two);
    assert.ok((await f.shared.select().from(sharedEntitlements)).every(row => row.status === "revoked"));
  } finally { f.close(); }
});

test("shared-first success/local failure rolls back designation and local grant; retry repairs the original intent and reference", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f);
    await f.local.client.execute("CREATE TRIGGER fail_event_local BEFORE INSERT ON entitlements BEGIN SELECT RAISE(ABORT, 'synthetic local commit failure'); END");
    await assert.rejects(sync(f, input), (error: unknown) => String((error as Error).cause).includes("synthetic local commit failure"));
    assert.equal((await receipts(f))[0].designation, "pending");
    assert.deepEqual(await localRows(f), []);
    assert.equal((await f.shared.select().from(sharedEntitlements)).length, 1);
    assert.deepEqual(await decision(f), { kind: "unknown", reason: "checkout_pending" });
    await f.local.client.execute("DROP TRIGGER fail_event_local");
    await sync(f, input);
    assert.equal((await receipts(f))[0].designation, "designated");
    assert.equal((await localRows(f)).length, 1);
  } finally { f.close(); }
});

test("a first shared outage preserves pending proof and returns retryably; valid local coverage survives a later shared outage", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f);
    const unavailableShared = { select() { throw new Error("synthetic shared outage"); } } as unknown as typeof f.shared;
    await assert.rejects(access.reconcileStripeAccess(input, { ...f.dependencies, sharedDatabase: unavailableShared }));
    assert.equal((await receipts(f))[0].designation, "pending");
    assert.deepEqual(await localRows(f), []);
    await sync(f, input);
    assert.deepEqual(await evaluator.readEventProjectAccessWith(f.local.db, unavailableShared, {
      actorUserId: "buyer", workspaceId: "project-a", now: ACTIVE,
    }), { kind: "editable", basis: "current_cover" });
    assert.deepEqual(await evaluator.readEventProjectAccessWith(f.local.db, unavailableShared, {
      actorUserId: "buyer", workspaceId: "project-a", now: AFTER,
    }), { kind: "verification_unavailable" });
  } finally { f.close(); }
});

test("a durable intent survives a lost checkout response/local binding failure and is recovered from exact signed-session metadata", async () => {
  const f = await fixture();
  try {
    let intentId = "";
    await f.local.client.execute("CREATE TRIGGER fail_event_bind BEFORE UPDATE ON event_purchase_designations BEGIN SELECT RAISE(ABORT, 'synthetic binding failure'); END");
    await assert.rejects(designation.createEventCheckoutWith(f.local.db, { actorUserId: "buyer", workspaceId: "project-a" }, async id => {
      intentId = id; return { id: "cs_response_lost", url: "https://checkout.invalid/local" };
    }), (error: unknown) => String((error as Error).cause).includes("synthetic binding failure"));
    const [pending] = await receipts(f);
    assert.equal(pending.id, intentId); assert.equal(pending.providerReference, null);
    await f.local.client.execute("DROP TRIGGER fail_event_bind");
    await sync(f, { userId: "buyer", workspaceId: "project-a", tier: "event", reference: "stripe:cs_response_lost",
      customerId: "cus_fixture", subscriptionId: null, expiresAt: END, revoked: false,
      eventDesignation: { intentId, settledAt: PAID } });
    assert.equal((await receipts(f))[0].designation, "designated");
  } finally { f.close(); }
});

test("conflicting purchaser/project/reference and term cannot rebind an intent; SQL constraints also prevent incomplete facts, changed terms and revocation reversal", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await sync(f, input);
    for (const changed of [
      { ...input, userId: "member" }, { ...input, workspaceId: "project-b" },
      { ...input, reference: "stripe:cs_foreign" },
      { ...input, eventDesignation: { ...input.eventDesignation!, settledAt: ACTIVE } },
    ]) await assert.rejects(sync(f, changed));
    const before = (await receipts(f))[0];
    for (const statement of [
      "UPDATE event_purchase_designations SET workspace_id='project-b'",
      "UPDATE event_purchase_designations SET purchaser_user_id='member'",
      "UPDATE event_purchase_designations SET original_expires_at=original_expires_at+1",
      "UPDATE event_purchase_designations SET provider_reference='stripe:cs_rebound'",
      "UPDATE event_purchase_designations SET designation='pending',settled_at=NULL,original_expires_at=NULL,settlement_authorized_at=NULL",
      "UPDATE event_purchase_designations SET checkout_authorized_at=checkout_authorized_at+1",
    ]) await assert.rejects(f.local.client.execute(statement), /immutable/);
    assert.deepEqual((await receipts(f))[0], before);
    await sync(f, { ...input, revoked: true });
    await assert.rejects(f.local.client.execute("UPDATE event_purchase_designations SET revoked=0"), /immutable/);
    await assert.rejects(f.local.client.execute("INSERT INTO event_purchase_designations(id,purchaser_user_id,workspace_id,checkout_authorized_at,provider_reference,designation) VALUES ('invalid','buyer','project-a',1,'stripe:cs_incomplete','designated')"), /CHECK/);
  } finally { f.close(); }
});

test("legacy Event fulfilment is not backfilled or used to infer ownership at checkout", async () => {
  const f = await fixture();
  try {
    const legacy: StripeAccess = { userId: "member", workspaceId: "project-a", tier: "event",
      reference: "stripe:cs_legacy", customerId: "cus_fixture", subscriptionId: null, expiresAt: END, revoked: false };
    await sync(f, legacy);
    assert.deepEqual(await receipts(f), []);
    assert.deepEqual(await decision(f), { kind: "unknown", reason: "no_designation" });
    await sync(f, { ...legacy, revoked: true });
    assert.equal((await localRows(f))[0].expiresAt?.getTime(), 0);
    assert.deepEqual(await receipts(f), []);
  } finally { f.close(); }
});

test("customerless historical refund only marks an existing exact fact revoked and preserves positive dates", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await sync(f, input);
    await access.revokeHistoricalStripeAccess(input, f.dependencies);
    assert.equal((await receipts(f))[0].revoked, true);
    assert.equal((await receipts(f))[0].originalExpiresAt?.getTime(), END.getTime());
    await assert.rejects(access.revokeHistoricalStripeAccess({ ...input, workspaceId: "project-b" }, f.dependencies));
  } finally { f.close(); }
});

test("account fence and actual user/workspace deletion refuse delayed settlement and never recreate designation facts", async () => {
  for (const state of ["fence", "user-delete", "project-delete"] as const) {
    const f = await fixture();
    try {
      const input = await checkout(f);
      if (state === "fence") {
        await deletion.beginAccountDeletionWith(f.local.db, "buyer");
        await sync(f, input);
        assert.equal((await receipts(f))[0].designation, "pending");
      } else if (state === "user-delete") {
        await f.local.db.update(workspaces).set({ ownerUserId: "next-owner" });
        await f.local.db.delete(users).where(eq(users.id, "buyer"));
        await assert.rejects(sync(f, input), /account/);
        assert.deepEqual(await receipts(f), []);
      } else {
        await f.local.db.delete(workspaces).where(eq(workspaces.id, "project-a"));
        await assert.rejects(sync(f, input));
        assert.deepEqual(await receipts(f), []);
      }
      assert.deepEqual(await localRows(f), []);
      assert.deepEqual(await f.shared.select().from(sharedEntitlements), []);
    } finally { f.close(); }
  }
});

for (const grant of [
  { name: "current owner's local account Pro", userId: "buyer", scope: null, shared: false, expected: "editable" },
  { name: "member's personal local Pro", userId: "member", scope: null, shared: false, expected: "read_only" },
  { name: "co-owner's personal shared Studio", userId: "co-owner", scope: null, shared: true, expected: "read_only" },
  { name: "current owner's other-project Pro", userId: "buyer", scope: "project-b", shared: false, expected: "read_only" },
  { name: "explicit project-covering shared venue grant", userId: "member", scope: "project-a", shared: true, expected: "editable" },
  { name: "current owner's legacy shared Studio account grant", userId: "buyer", scope: undefined, shared: true, expected: "editable" },
] as const) {
  test("coverage precedence: " + grant.name, async () => {
    const f = await fixture();
    try {
      await sync(f, await checkout(f));
      if (grant.shared) {
        await f.shared.insert(sharedEntitlements).values({ id: "independent", userClerkId: grant.userId,
          tier: "studio", source: grant.scope ? "venue_edition" : "compliments", sourceRef: "independent",
          grantedAt: PAID.getTime(), expiresAt: null, status: "active",
          metadata: grant.scope === undefined ? null : JSON.stringify({ workspaceId: grant.scope }) });
      } else {
        await f.local.db.insert(entitlements).values({ id: "independent", userId: grant.userId, workspaceId: grant.scope,
          tier: "workspace", source: "comp", notes: "independent", startedAt: PAID, expiresAt: null });
      }
      assert.equal((await decision(f)).kind, grant.expected);
      assert.equal((await decision(f, AFTER, "member")).kind, grant.expected);
    } finally { f.close(); }
  });
}

test("two independently completed terms survive one refund; independent current cover also survives that refund", async () => {
  const f = await fixture();
  try {
    const one = await checkout(f, "one"), two = await checkout(f, "two");
    await sync(f, one); await sync(f, two); await sync(f, { ...one, revoked: true });
    assert.deepEqual(await decision(f), { kind: "read_only", basis: "completed_designated_event" });
    await sync(f, { ...two, revoked: true });
    assert.deepEqual(await decision(f), { kind: "unavailable", reason: "refunded" });
    await f.local.db.insert(entitlements).values({ id: "cover", userId: "buyer", workspaceId: null,
      tier: "workspace", source: "comp", startedAt: PAID });
    assert.deepEqual(await decision(f), { kind: "editable", basis: "current_cover" });
  } finally { f.close(); }
});

test("account coverage follows the current primary owner; transfer cannot rewrite the historic purchaser", async () => {
  const f = await fixture();
  try {
    await sync(f, await checkout(f));
    await f.local.db.insert(entitlements).values({ id: "old-account", userId: "buyer", workspaceId: null, tier: "studio", source: "comp", startedAt: PAID });
    await f.local.db.update(workspaces).set({ ownerUserId: "next-owner" }).where(eq(workspaces.id, "project-a"));
    assert.equal((await decision(f)).kind, "read_only");
    await f.shared.insert(sharedEntitlements).values({ id: "new-account", userClerkId: "next-owner", tier: "workspace",
      source: "compliments", grantedAt: PAID.getTime(), metadata: JSON.stringify({ workspaceId: null }) });
    assert.equal((await decision(f)).kind, "editable");
    assert.equal((await receipts(f))[0].purchaserUserId, "buyer");
  } finally { f.close(); }
});

test("expired/revoked/future independent grants do not override an archive; missing local purchase behind a positive mirror is verification-unavailable", async () => {
  const f = await fixture();
  try {
    await sync(f, await checkout(f));
    for (const [id, status, expiresAt, grantedAt] of [
      ["expired", "active", PAID.getTime(), PAID.getTime()],
      ["revoked", "revoked", null, PAID.getTime()],
      ["future", "active", null, AFTER.getTime() + 86_400_000],
    ] as const) {
      await f.shared.insert(sharedEntitlements).values({ id, userClerkId: "buyer", tier: "studio",
        source: "compliments", status, expiresAt, grantedAt, metadata: JSON.stringify({ workspaceId: null }) });
    }
    assert.equal((await decision(f)).kind, "read_only");
    await f.shared.insert(sharedEntitlements).values({ id: "orphan", userClerkId: "buyer", tier: "workspace",
      source: "workspace_subscription", sourceRef: "stripe-sub:orphan", status: "active", grantedAt: PAID.getTime(),
      stripeCustomerId: "cus_orphan", stripeSubscriptionId: "sub_orphan", metadata: JSON.stringify({ workspaceId: null }) });
    assert.deepEqual(await decision(f), { kind: "verification_unavailable" });
  } finally { f.close(); }
});

test("boundary equality is read-only; malformed/foreign/removed identities return neutral unavailable; local read failure is explicit", async () => {
  const f = await fixture();
  try {
    await sync(f, await checkout(f));
    assert.equal((await decision(f, END)).kind, "read_only");
    for (const [actor, project] of [["outsider", "project-a"], ["buyer", "bad"], ["buyer", " project-a"]]) {
      assert.deepEqual(await decision(f, AFTER, actor, project), { kind: "unavailable", reason: "not_authorized" });
    }
    await f.local.db.delete(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, "project-a"), eq(workspaceMembers.userId, "member")));
    assert.deepEqual(await decision(f, AFTER, "member"), { kind: "unavailable", reason: "not_authorized" });
    const unavailable = { transaction() { throw new Error("synthetic local outage"); } } as unknown as typeof f.local.db;
    assert.deepEqual(await evaluator.readEventProjectAccessWith(unavailable, f.shared, {
      actorUserId: "buyer", workspaceId: "project-a", now: AFTER,
    }), { kind: "verification_unavailable" });
  } finally { f.close(); }
});

test("the internal evaluator does not wire a project-wide denial or change manual archive/role capability semantics", async () => {
  const f = await fixture();
  try {
    await sync(f, await checkout(f));
    assert.equal((await decision(f)).kind, "read_only");
    const actual = await authz.proveProjectCapability("member", assertProjectId("project-a"), "createOrEditTasks", "enforce", f.local.db);
    assert.equal(actual.ok, true); // Explicitly incomplete closure: adapters are a later milestone.
    await f.local.db.update(workspaces).set({ archivedAt: new Date() }).where(eq(workspaces.id, "project-a"));
    const archived = await authz.proveProjectCapability("member", assertProjectId("project-a"), "createOrEditTasks", "enforce", f.local.db);
    assert.equal(archived.ok, false);
  } finally { f.close(); }
});

test("actual held checkout action + future-branch harness carry exact project/intent/idempotency into the actual verified settlement writer", async () => {
  const f = await fixture();
  try {
    let calls = 0, cookieReads = 0, actor = "buyer", hold = true;
    let session: Record<string, unknown> = {};
    const policy = await import("@/server/checkout-policy");
    const availability = await import("@/lib/billing-availability");
    assert.equal(availability.EVENT_SELF_SERVE_AVAILABLE, false);
    const provider = { checkout: { sessions: {
      create: async (params: Stripe.Checkout.SessionCreateParams, options: Stripe.RequestOptions) => {
        calls++;
        assert.equal(params.metadata?.eventCheckoutIntent, options.idempotencyKey);
        session = { ...params, id: "cs_action", payment_status: "paid", customer: "cus_fixture",
          payment_intent: { id: "pi_fixture", status: "succeeded", customer: "cus_fixture",
            latest_charge: { created: PAID.getTime() / 1000, status: "succeeded", paid: true, amount_refunded: 0 } },
          url: "https://checkout.invalid/action" };
        return session;
      },
      retrieve: async () => session,
    } } } as unknown as Stripe;
    const action = entryPoint<typeof import("@/server/actions/billing")>("../actions/billing.ts", {
      "@/server/auth": { getCurrentUser: async () => actor, getActiveWorkspaceOrNull: async () => { cookieReads++; return "project-b"; } },
      "@/server/actions/project-authz": { authorizeProjectCandidate: async (input: { candidateProjectId: string; capability: "createOrEditTasks"; actorUserId: string }) =>
        authz.proveProjectCapability(input.actorUserId, assertProjectId(input.candidateProjectId), input.capability, "enforce", f.local.db) },
      "@/server/stripe": { stripe: provider, priceIdFor: () => "price_fixture", MissingStripePriceError: Error },
      "@/lib/access-mode": { isDemoMode: () => false },
      "@/server/checkout-policy": policy,
      "@/lib/billing-availability": { ...availability, checkoutAvailable: (tier: string) => hold ? availability.checkoutAvailable(tier as "event") : true },
      "@/server/stripe-access": { billingCustomerForUser: (id: string) => access.billingCustomerForUser(id, f.shared),
        withBillingAccount: () => { throw new Error("Event must use its actual fenced writer"); } },
      "@/server/db/event-designation": { createEventCheckout: (input: Parameters<typeof designation.createEventCheckout>[0], create: Parameters<typeof designation.createEventCheckout>[1]) =>
        designation.createEventCheckoutWith(f.local.db, input, create) },
    });
    await assert.rejects(action.createCheckoutSessionAction("event", "monthly", "project-a"), /unavailable/);
    assert.equal(calls, 0); assert.deepEqual(await receipts(f), []);
    // Only this compiled test import overrides availability, to exercise held
    // future wiring. The runtime constant/file is never changed or exposed.
    hold = false;
    actor = "member";
    await assert.rejects(action.createCheckoutSessionAction("event", "monthly", "project-a"), /primary owner/);
    assert.equal(calls, 0);
    actor = "buyer";
    await action.createCheckoutSessionAction("event", "monthly", "project-a");
    assert.equal(cookieReads, 0);
    assert.equal((session.metadata as Record<string, string>).workspaceId, "project-a");
    const event = { id: "evt_local", type: "checkout.session.completed", data: { object: { id: "cs_action" } } } as Stripe.Event;
    await lifecycle.handleStripeLifecycle(event, provider, { sync: input => sync(f, input) });
    assert.equal((await receipts(f))[0].designation, "designated");
    assert.equal((await localRows(f))[0].workspaceId, "project-a");
  } finally { f.close(); }
});

test("real project deletion fence prevents checkout and commits an undesignated paid outcome at settlement", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f);
    await f.local.client.execute("INSERT INTO project_drive_operations(id,workspace_id,operation_kind,status,dedupe_key) VALUES ('delete-project','project-a','project_delete','pending','" + "a".repeat(64) + "')");
    let providerCalls = 0;
    await assert.rejects(designation.createEventCheckoutWith(f.local.db, { actorUserId: "buyer", workspaceId: "project-a" }, async () => {
      providerCalls++; return { id: "cs_no", url: "https://checkout.invalid" };
    }));
    assert.equal(providerCalls, 0);
    await assert.rejects(sync(f, input), designation.EventDesignationPendingError);
    assert.equal((await receipts(f))[0].reason, "project_deleting");
    assert.deepEqual(await localRows(f), []);
    assert.deepEqual(await f.shared.select().from(sharedEntitlements), []);
    assert.deepEqual(await decision(f), { kind: "unavailable", reason: "not_authorized" });
  } finally { f.close(); }
});

test("ownership is re-proved between durable preparation and the provider callback", async () => {
  const f = await fixture();
  try {
    let transactions = 0, providerCalls = 0;
    const watched = new Proxy(f.local.db, { get(target, key, receiver) {
      if (key === "transaction") return async (...args: Parameters<typeof target.transaction>) => {
        const result = await target.transaction(...args);
        if (++transactions === 1) await f.local.db.update(workspaces).set({ ownerUserId: "next-owner" }).where(eq(workspaces.id, "project-a"));
        return result;
      };
      return Reflect.get(target, key, receiver);
    } });
    await assert.rejects(designation.createEventCheckoutWith(watched, { actorUserId: "buyer", workspaceId: "project-a" }, async () => {
      providerCalls++; return { id: "cs_race", url: "https://checkout.invalid" };
    }), /authority changed/);
    assert.equal(providerCalls, 0);
    const [stored] = await receipts(f);
    assert.equal(stored.designation, "pending");
    assert.equal(stored.providerReference, null);
    assert.deepEqual(await localRows(f), []);
  } finally { f.close(); }
});

test("historical payment date and conflicting durable customer binding cannot commit a new designation", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f);
    const old = new Date("2000-01-01T12:00:00Z");
    await assert.rejects(sync(f, { ...input, expiresAt: new Date("2001-01-01T12:00:00Z"),
      eventDesignation: { ...input.eventDesignation!, settledAt: old } }), /predates/);
    assert.equal((await receipts(f))[0].designation, "pending");
    await access.reconcileSharedStripeAccess({ ...input, customerId: "cus_conflicting" }, f.shared);
    await assert.rejects(sync(f, input), /binding/);
    assert.equal((await receipts(f))[0].designation, "pending");
    assert.deepEqual(await localRows(f), []);
  } finally { f.close(); }
});

test("missing recorded local evidence is verification-unavailable, never undesignated history; independent cover still wins", async () => {
  const f = await fixture();
  try {
    const input = await checkout(f); await sync(f, input);
    assert.equal((await decision(f, new Date(PAID.getTime() - 1))).kind, "verification_unavailable");
    await f.local.db.delete(entitlements).where(eq(entitlements.notes, input.reference));
    assert.deepEqual(await decision(f, ACTIVE), { kind: "verification_unavailable" });
    assert.deepEqual(await decision(f, AFTER), { kind: "verification_unavailable" });
    await assert.rejects(sync(f, input), /fulfilment is missing/);
    await f.local.db.insert(entitlements).values({ id: "independent-owner", userId: "buyer", workspaceId: null,
      tier: "studio", source: "comp", startedAt: PAID, expiresAt: null });
    assert.deepEqual(await decision(f, AFTER), { kind: "editable", basis: "current_cover" });
  } finally { f.close(); }
});
