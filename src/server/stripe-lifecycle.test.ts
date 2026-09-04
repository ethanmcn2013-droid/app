import { before, test } from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { freshFileDb } from "./db/memory-test-db";
import { entitlements, users, workspaces, workspaceMembers } from "./db/schema";
import * as sharedSchema from "../lib/entitlements-shared/schema";
import type { StripeAccess } from "./stripe-access";

let access: typeof import("./stripe-access");
let lifecycle: typeof import("./stripe-lifecycle");
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  access = await import("./stripe-access");
  lifecycle = await import("./stripe-lifecycle");
});

async function fixture() {
  const local = await freshFileDb();
  await local.client.execute("PRAGMA journal_mode = WAL");
  await local.db.insert(users).values({id:"buyer", clerkId:"buyer", handle:"buyer", name:"Fixture buyer", initials:"FB", color:"fixture"});
  await local.db.insert(workspaces).values({id:"project-b",slug:"project-b",name:"Fixture project",ownerUserId:"buyer"});
  await local.db.insert(workspaceMembers).values({workspaceId:"project-b",userId:"buyer",role:"owner"});
  const sharedClient = createClient({ url: ":memory:" });
  await sharedClient.executeMultiple(`CREATE TABLE entitlements (
    id TEXT PRIMARY KEY, user_clerk_id TEXT NOT NULL, tier TEXT NOT NULL, source TEXT NOT NULL,
    source_ref TEXT, granted_at INTEGER DEFAULT 0, expires_at INTEGER, status TEXT NOT NULL,
    stripe_customer_id TEXT, stripe_subscription_id TEXT, metadata TEXT,
    created_at INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0
  )`);
  const shared = drizzle(sharedClient, { schema: sharedSchema });
  const mirror = (input: StripeAccess) => access.reconcileSharedStripeAccess(input, shared);
  return { local, shared, mirror, close: () => { local.cleanup(); sharedClient.close(); } };
}
const purchase: StripeAccess = {
  userId: "buyer", workspaceId: "project-b", tier: "workspace", reference: "stripe-sub:sub_fixture",
  customerId: "cus_fixture", subscriptionId: "sub_fixture", expiresAt: new Date("2027-02-21T12:00:00Z"), revoked: false,
};

test("paid renewals extend both ledgers to an absolute term; stale deliveries cannot shorten it", async () => {
  const f = await fixture();
  try {
    const sync = (input: StripeAccess) => access.reconcileStripeAccess(input, { database: f.local.db, mirror: f.mirror });
    await sync(purchase);
    const renewal = { ...purchase, expiresAt: new Date("2027-03-21T12:00:00Z") };
    await Promise.all([sync(purchase), sync(renewal), sync(purchase), sync(renewal)]);
    const rows = await f.local.db.select().from(entitlements);
    const shared = await f.shared.select().from(sharedSchema.entitlements);
    assert.equal(rows.length, 1); assert.equal(shared.length, 1);
    assert.equal(rows[0].expiresAt?.getTime(), renewal.expiresAt.getTime());
    assert.equal(shared[0].expiresAt, renewal.expiresAt.getTime());
    assert.equal(await access.billingCustomerForUser("buyer", f.shared), "cus_fixture");
    assert.equal(await access.billingCustomerForUser("stranger", f.shared), null);
  } finally { f.close(); }
});

test("cancellation survives a late initial grant, concurrent renewal and a failed shared mirror", async () => {
  const f = await fixture();
  try {
    const revoked = { ...purchase, revoked: true, expiresAt: null };
    await assert.rejects(access.reconcileStripeAccess(revoked, { database: f.local.db, mirror: async () => { throw new Error("offline"); } }), /offline/);
    const sync = (input: StripeAccess) => access.reconcileStripeAccess(input, { database: f.local.db, mirror: f.mirror });
    await Promise.all([sync(purchase), sync(revoked), sync({ ...purchase, expiresAt: new Date("2030-01-01Z") })]);
    // Also simulate a renewal that read local truth before the cancellation.
    await f.mirror(purchase);
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), 0);
    const [shared] = await f.shared.select().from(sharedSchema.entitlements);
    assert.equal(shared.status, "revoked"); assert.equal(shared.expiresAt, 0);
  } finally { f.close(); }
});

test("one-time retries preserve the original term and a refund remains revoked", async () => {
  const f = await fixture();
  try {
    const event = { ...purchase, tier: "event" as const, reference: "stripe:cs_fixture", subscriptionId: null };
    const sync = (input: StripeAccess) => access.reconcileStripeAccess(input, { database: f.local.db, mirror: f.mirror });
    await sync(event); await sync({ ...event, expiresAt: new Date("2030-01-01Z") });
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), event.expiresAt?.getTime());
    await sync({ ...event, revoked: true }); await sync(event);
    assert.equal((await f.shared.select().from(sharedSchema.entitlements))[0].status, "revoked");
  } finally { f.close(); }
});

test("billing references cannot be reassigned and ambiguous customer bindings refuse the portal", async () => {
  const f = await fixture();
  try {
    await access.reconcileStripeAccess(purchase, { database: f.local.db, mirror: f.mirror });
    for (const invalid of [{ ...purchase, userId: "stranger" }, { ...purchase, workspaceId: "wrong" }, { ...purchase, tier: "studio" as const }]) {
      await assert.rejects(access.reconcileStripeAccess(invalid, { database: f.local.db, mirror: f.mirror }), /scope|account|project/);
    }
    await assert.rejects(f.mirror({ ...purchase, customerId: "cus_wrong" }), /scope/);
    await f.mirror({ ...purchase, reference: "stripe-sub:sub_other", subscriptionId: "sub_other", customerId: "cus_other" });
    await assert.rejects(access.billingCustomerForUser("buyer", f.shared), /review/);
  } finally { f.close(); }
});

test("an erasure fence suppresses delayed payment writes in both ledgers", async () => {
  const f = await fixture();
  try {
    const { beginAccountDeletionWith } = await import("./account-deletion-lifecycle");
    await beginAccountDeletionWith(f.local.db, "buyer");
    await f.local.db.delete(users);
    await access.reconcileStripeAccess(purchase, { database: f.local.db, mirror: f.mirror });
    assert.deepEqual(await f.local.db.select().from(entitlements), []);
    assert.deepEqual(await f.shared.select().from(sharedSchema.entitlements), []);
  } finally { f.close(); }
});

test("a deleted or inaccessible project cannot receive a later paid entitlement", async () => {
  const f = await fixture();
  try {
    await f.local.db.delete(workspaceMembers);
    await assert.rejects(access.reconcileStripeAccess(purchase, { database: f.local.db, mirror: f.mirror }), /project/);
    assert.deepEqual(await f.local.db.select().from(entitlements), []);
    assert.deepEqual(await f.shared.select().from(sharedSchema.entitlements), []);
  } finally { f.close(); }
});

const metadata = { userId: "buyer", workspaceId: "project-b", tier: "workspace" };
function invoice(): Stripe.Invoice {
  return { id: "in_fixture", status: "paid", customer: "cus_fixture", parent: { subscription_details: { subscription: "sub_fixture" } },
    lines: { has_more: false, data: [{ amount: 1200, period: { start: 1800532800, end: 1803211200 }, parent: { subscription_item_details: { subscription: "sub_fixture", subscription_item: "si_fixture", proration: false } } }] },
  } as unknown as Stripe.Invoice;
}
function subscription(): Stripe.Subscription {
  return { id: "sub_fixture", status: "active", metadata, customer: "cus_fixture", items: { has_more: false, data: [{ id: "si_fixture" }] }, latest_invoice: invoice() } as unknown as Stripe.Subscription;
}
function event(type: string, object: unknown): Stripe.Event { return { id: "evt_fixture", type, data: { object } } as Stripe.Event; }

test("only a paid invoice for the exact customer, subscription and item proves renewal", () => {
  const sub = subscription(); const paid = invoice();
  assert.equal(lifecycle.paidSubscriptionTerm(sub, paid)?.getTime(), paid.lines.data[0].period.end * 1000);
  assert.equal(lifecycle.paidSubscriptionTerm(sub, { ...paid, status: "open" }), null);
  assert.equal(lifecycle.paidSubscriptionTerm(sub, { ...paid, customer: "cus_wrong" }), null);
  const wrong = invoice(); wrong.lines.data[0].parent!.subscription_item_details!.subscription = "sub_wrong";
  assert.equal(lifecycle.paidSubscriptionTerm(sub, wrong), null);
  const paged = invoice(); paged.lines.has_more = true;
  assert.throws(() => lifecycle.paidSubscriptionTerm(sub, paged), /full invoice/);
});

test("the handler uses current cancellation truth even for a delayed invoice and retires the old bootstrap", async () => {
  const cancelled = { ...subscription(), status: "canceled" };
  const writes: StripeAccess[] = [];
  const provider = { subscriptions: { retrieve: async () => cancelled }, checkout: { sessions: { list: async () => ({ has_more: false, data: [{ id: "cs_old", subscription: "sub_fixture", customer: "cus_fixture", metadata }] }) } } } as unknown as Stripe;
  await lifecycle.handleStripeLifecycle(event("invoice.paid", invoice()), provider, async input => { writes.push(input); });
  assert.deepEqual(writes.map(row => [row.reference, row.revoked]), [["stripe-sub:sub_fixture", true], ["stripe:cs_old", true]]);
});

test("paid invoice renewal, unpaid invoice and provider failure have distinct outcomes", async () => {
  const writes: StripeAccess[] = []; let current = invoice();
  const provider = { subscriptions: { retrieve: async () => subscription() }, invoices: { retrieve: async () => current }, checkout: { sessions: { list: async () => ({ has_more: false, data: [] }) } } } as unknown as Stripe;
  await lifecycle.handleStripeLifecycle(event("invoice.paid", current), provider, async input => { writes.push(input); });
  assert.equal(writes.length, 1); assert.equal(writes[0].expiresAt?.getTime(), current.lines.data[0].period.end * 1000);
  current = { ...current, status: "open" };
  await lifecycle.handleStripeLifecycle(event("invoice.paid", current), provider, async input => { writes.push(input); });
  assert.equal(writes.length, 1);
  provider.subscriptions.retrieve = async () => { throw new Error("provider unavailable"); };
  await assert.rejects(lifecycle.handleStripeLifecycle(event("invoice.paid", current), provider), /provider unavailable/);
});

test("checkout re-reads settlement and refunds before granting the exact Event term", async () => {
  const session = { id: "cs_event", mode: "payment", payment_status: "paid", metadata: { ...metadata, tier: "event" },
    client_reference_id: "buyer::project-b", customer: "cus_fixture", payment_intent: { status: "succeeded", customer: "cus_fixture", latest_charge: { created: 1800532800, status: "succeeded", paid: true, amount_refunded: 0 } },
  };
  const writes: StripeAccess[] = [];
  const provider = { checkout: { sessions: { retrieve: async () => session } } } as unknown as Stripe;
  const sync = async (input: StripeAccess) => { writes.push(input); };
  await lifecycle.handleStripeLifecycle(event("checkout.session.completed", { id: session.id }), provider, sync);
  assert.equal(writes.length, 1); assert.equal(writes[0].tier, "event");
  session.payment_intent.latest_charge.amount_refunded = 8900;
  await lifecycle.handleStripeLifecycle(event("checkout.session.async_payment_succeeded", { id: session.id }), provider, sync);
  assert.equal(writes[1].revoked, true);
  session.payment_status = "unpaid";
  await lifecycle.handleStripeLifecycle(event("checkout.session.completed", { id: session.id }), provider, sync);
  assert.equal(writes.length, 2);
  session.payment_status = "paid"; session.client_reference_id = "stranger::project-b";
  await assert.rejects(lifecycle.handleStripeLifecycle(event("checkout.session.completed", { id: session.id }), provider, sync), /ownership/);
});
