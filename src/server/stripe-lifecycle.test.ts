import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { NextResponse } from "next/server";
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

async function fixture(userId = "buyer") {
  const local = await freshFileDb();
  await local.client.execute("PRAGMA journal_mode = WAL");
  await local.db.insert(users).values({id:userId, clerkId:userId, handle:"buyer", name:"Fixture buyer", initials:"FB", color:"fixture"});
  await local.db.insert(workspaces).values({id:"project-b",slug:"project-b",name:"Fixture project",ownerUserId:userId});
  await local.db.insert(workspaceMembers).values({workspaceId:"project-b",userId,role:"owner"});
  const sharedClient = createClient({ url: ":memory:" });
  await sharedClient.executeMultiple(`CREATE TABLE entitlements (
    id TEXT PRIMARY KEY, user_clerk_id TEXT NOT NULL, tier TEXT NOT NULL, source TEXT NOT NULL,
    source_ref TEXT, granted_at INTEGER DEFAULT 0, expires_at INTEGER, status TEXT NOT NULL,
    stripe_customer_id TEXT, stripe_subscription_id TEXT, metadata TEXT,
    created_at INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0
  )`);
  const shared = drizzle(sharedClient, { schema: sharedSchema });
  const mirror = (input: StripeAccess) => access.reconcileSharedStripeAccess(input, shared);
  const dependencies = { database: local.db, sharedDatabase: shared, mirror };
  return { local, shared, sharedClient, mirror, dependencies, close: () => { local.cleanup(); sharedClient.close(); } };
}
const purchase: StripeAccess = {
  userId: "buyer", workspaceId: "project-b", tier: "workspace", reference: "stripe-sub:sub_fixture",
  customerId: "cus_fixture", subscriptionId: "sub_fixture", expiresAt: new Date("2027-02-21T12:00:00Z"), revoked: false,
};

test("paid renewals extend both ledgers to an absolute term; stale deliveries cannot shorten it", async () => {
  const f = await fixture();
  try {
    const sync = (input: StripeAccess) => access.reconcileStripeAccess(input, f.dependencies);
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
    const sync = (input: StripeAccess) => access.reconcileStripeAccess(input, f.dependencies);
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
    const sync = (input: StripeAccess) => access.reconcileStripeAccess(input, f.dependencies);
    await sync(event); await sync({ ...event, expiresAt: new Date("2030-01-01Z") });
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), event.expiresAt?.getTime());
    await sync({ ...event, revoked: true }); await sync(event);
    assert.equal((await f.shared.select().from(sharedSchema.entitlements))[0].status, "revoked");
  } finally { f.close(); }
});

test("billing references cannot be reassigned and ambiguous customer bindings refuse the portal", async () => {
  const f = await fixture();
  try {
    await access.reconcileStripeAccess(purchase, f.dependencies);
    for (const invalid of [{ ...purchase, userId: "stranger" }, { ...purchase, workspaceId: "wrong" }, { ...purchase, tier: "studio" as const }]) {
      await assert.rejects(access.reconcileStripeAccess(invalid, f.dependencies), /scope|account|project/);
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
    await access.reconcileStripeAccess(purchase, f.dependencies);
    assert.deepEqual(await f.local.db.select().from(entitlements), []);
    assert.deepEqual(await f.shared.select().from(sharedSchema.entitlements), []);
  } finally { f.close(); }
});

test("a deleted or inaccessible project cannot receive a later paid entitlement", async () => {
  const f = await fixture();
  try {
    await f.local.db.delete(workspaceMembers);
    await assert.rejects(access.reconcileStripeAccess(purchase, f.dependencies), /project/);
    assert.deepEqual(await f.local.db.select().from(entitlements), []);
    assert.deepEqual(await f.shared.select().from(sharedSchema.entitlements), []);
  } finally { f.close(); }
});

const metadata = { userId: "buyer", workspaceId: "project-b", tier: "workspace" };


// Execute the real entry-point bodies with only their external imports replaced.
// Unexpected imports fail closed; no provider, Clerk, or production DB is loaded.
function entryPoint<T>(path: string, imports: Record<string, unknown>): T {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)((name: string) => {
    assert.ok(Object.hasOwn(imports, name), "Unexpected entry-point dependency: " + name);
    return imports[name];
  }, loaded, loaded.exports);
  return loaded.exports as T;
}



async function signedWebhook(
  f: Awaited<ReturnType<typeof fixture>>,
  provider: Stripe,
  writers: NonNullable<Parameters<typeof lifecycle.handleStripeLifecycle>[2]>,
) {
  const { default: StripeSdk } = await import("stripe");
  const sdk = new StripeSdk("sk_test_local_fixture_only");
  const secret = "whsec_local_fixture_only";
  await f.sharedClient.executeMultiple("CREATE TABLE processed_webhooks (id TEXT PRIMARY KEY, source TEXT NOT NULL, event_id TEXT NOT NULL, processed_at INTEGER DEFAULT 0)");
  const route = entryPoint<typeof import("../app/api/webhooks/stripe/route")>("../app/api/webhooks/stripe/route.ts", {
    "next/server": { NextResponse },
    "drizzle-orm": await import("drizzle-orm"),
    "@/server/db": { db: f.local.db },
    "@/server/db/schema": await import("./db/schema"),
    "@/server/stripe": { stripe: { ...provider, webhooks: sdk.webhooks }, WEBHOOK_SECRET: secret },
    "@/lib/access-mode": { isDemoMode: () => false },
    "@/server/stripe-lifecycle": { handleStripeLifecycle: (input: Stripe.Event) => lifecycle.handleStripeLifecycle(input, provider, writers) },
    "@/server/operational-log": { opLog: () => {} },
    "@/lib/entitlements-shared/client": { entitlementsDb: () => f.shared },
    "@/lib/entitlements-shared/schema": sharedSchema,
  });
  return (input: Stripe.Event) => {
    const payload = JSON.stringify(input);
    const signature = sdk.webhooks.generateTestHeaderString({ payload, secret });
    return route.POST(new Request("https://app.invalid/api/webhooks/stripe", {
      method: "POST", headers: { "stripe-signature": signature }, body: payload,
    }));
  };
}

test("recovery: shared outage prevents both first local grant and later positive extension", async () => {
  const f = await fixture();
  try {
    const unavailable = new Proxy(f.shared, {
      get(target, property, receiver) {
        if (property === "select") return () => { throw new Error("shared unavailable"); };
        return Reflect.get(target, property, receiver);
      },
    });
    const dependencies = { ...f.dependencies, sharedDatabase: unavailable };
    await assert.rejects(access.reconcileStripeAccess(purchase, dependencies), /shared unavailable/);
    assert.deepEqual(await f.local.db.select().from(entitlements), []);
    await access.reconcileStripeAccess(purchase, f.dependencies);
    await assert.rejects(access.reconcileStripeAccess({
      ...purchase, expiresAt: new Date("2030-01-01Z"),
    }, dependencies), /shared unavailable/);
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), purchase.expiresAt?.getTime());
    // Revocation is local-first even when the same shared store is unavailable.
    await assert.rejects(access.reconcileStripeAccess({ ...purchase, revoked: true }, {
      ...dependencies, mirror: async () => { throw new Error("shared unavailable"); },
    }), /shared unavailable/);
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), 0);
  } finally { f.close(); }
});

test("recovery: customerless revocation preserves bindings and refuses missing, ambiguous or foreign local scope", async () => {
  const f = await fixture();
  try {
    const legacy = { ...purchase, tier: "event" as const, reference: "stripe:cs_legacy", subscriptionId: null };
    await access.reconcileStripeAccess(legacy, f.dependencies);
    const historical = { userId: legacy.userId, workspaceId: legacy.workspaceId, tier: legacy.tier, reference: legacy.reference };
    for (const invalid of [
      { ...historical, reference: "stripe:cs_missing" },
      { ...historical, userId: "stranger" },
      { ...historical, workspaceId: "other-project" },
      { ...historical, tier: "wedding" as const },
      { ...historical, reference: "stripe-sub:sub_fixture" },
    ]) await assert.rejects(access.revokeHistoricalStripeAccess(invalid, f.dependencies), /scope|reference/);
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), legacy.expiresAt?.getTime());
    await f.local.db.insert(entitlements).values({
      id: "ambiguous", userId: legacy.userId, workspaceId: legacy.workspaceId, tier: legacy.tier,
      source: "purchase", notes: legacy.reference, expiresAt: legacy.expiresAt,
    });
    await assert.rejects(access.revokeHistoricalStripeAccess(historical, f.dependencies), /scope|reference/);
    await f.local.client.execute("DELETE FROM entitlements WHERE id='ambiguous'");
    const [binding] = await f.shared.select().from(sharedSchema.entitlements);
    await access.revokeHistoricalStripeAccess(historical, f.dependencies);
    await access.revokeHistoricalStripeAccess(historical, f.dependencies);
    const [revoked] = await f.shared.select().from(sharedSchema.entitlements);
    assert.equal(revoked.status, "revoked"); assert.equal(revoked.expiresAt, 0);
    assert.equal(revoked.stripeCustomerId, binding.stripeCustomerId);
    assert.equal(revoked.stripeSubscriptionId, binding.stripeSubscriptionId);
    assert.equal(revoked.metadata, binding.metadata);
    assert.equal(await access.billingCustomerForUser("buyer", f.shared), "cus_fixture");
    // Replayed paid evidence cannot restore the historical reference.
    await access.reconcileStripeAccess(legacy, f.dependencies);
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), 0);
  } finally { f.close(); }
});

test("recovery: customerless positive payments and mismatched refund intents have no revocation authority", async () => {
  const session = {
    id: "cs_legacy", mode: "payment", payment_status: "paid", metadata: { ...metadata, tier: "event" },
    client_reference_id: "buyer::project-b", customer: null,
    payment_intent: { id: "pi_legacy", customer: null, status: "succeeded",
      latest_charge: { created: 1800532800, status: "succeeded", paid: true, amount_refunded: 0 } },
  };
  const provider = { checkout: { sessions: {
    list: async () => ({ has_more: false, data: [session] }), retrieve: async () => session,
  } } } as unknown as Stripe;
  let writes = 0;
  const forbidden = async () => { writes++; };
  await assert.rejects(lifecycle.handleStripeLifecycle(event("checkout.session.completed", session), provider, { sync: forbidden, revokeHistorical: forbidden }), /customer mismatch/);
  session.payment_intent.latest_charge.amount_refunded = 8900;
  await assert.rejects(lifecycle.handleStripeLifecycle(event("charge.refunded", { payment_intent: "pi_wrong" }), provider, { sync: forbidden, revokeHistorical: forbidden }), /does not match/);
  session.client_reference_id = "stranger::project-b";
  await assert.rejects(lifecycle.handleStripeLifecycle(event("charge.refunded", { payment_intent: "pi_legacy" }), provider, { sync: forbidden, revokeHistorical: forbidden }), /ownership/);
  assert.equal(writes, 0);
});

test("recovery: real deletion route fences billing through orchestrated erasure and failed Clerk deletion", async () => {
  const userId = "user_buyer";
  const f = await fixture(userId);
  try {
    const { beginAccountDeletionWith, hasAccountDeletionStartedWith } = await import("./account-deletion-lifecycle");
    const { ensureUserProvisionedWith } = await import("./db/ensure-user");
    const { deleteUnifiedAccountDataWith } = await import("./account-unified-erasure");
    const payment = { ...purchase, userId };
    await access.reconcileStripeAccess(payment, f.dependencies);
    const providerCalls: unknown[] = [];
    const create = async (args: unknown) => { providerCalls.push(args); return { url: "https://billing.invalid/fixture" }; };
    const provider = { checkout: { sessions: { create } }, billingPortal: { sessions: { create } } };
    const imports = {
      "@/lib/access-mode": { isDemoMode: () => false },
      "@/server/auth": { getCurrentUser: async () => userId, getActiveWorkspaceOrNull: async () => "project-b" },
      "@/server/actions/project-authz": { authorizeProjectCandidate: async () => ({ ok: true, projectId: "project-b" }) },
      "@/server/stripe": { stripe: provider, priceIdFor: () => "price_fixture", MissingStripePriceError: Error },
      "@/server/stripe-access": {
        billingCustomerForUser: (actor: string) => access.billingCustomerForUser(actor, f.shared),
        withBillingAccount: <T>(actor: string, work: () => Promise<T>) => access.withBillingAccount(actor, work, f.local.db),
      },
      "@/server/checkout-policy": await import("./checkout-policy"),
      "@clerk/nextjs/server": { auth: async () => ({ userId }), clerkClient: async () => ({
        users: { deleteUser: async () => { throw new Error("Clerk unavailable"); } },
      }) },
      "next/server": { NextResponse },
    };
    const checkout = entryPoint<typeof import("./actions/billing")>("./actions/billing.ts", imports).createCheckoutSessionAction;
    const portal = entryPoint<typeof import("./actions/plan")>("./actions/plan.ts", imports).createBillingPortalSessionAction;
    await checkout("event"); await portal();
    assert.equal(providerCalls.length, 2);
    const sharedBefore = await f.shared.select().from(sharedSchema.entitlements);
    let orchestrated = false;
    const route = entryPoint<typeof import("../app/api/account/delete/route")>("../app/api/account/delete/route.ts", {
      ...imports,
      "@/server/account-deletion-lifecycle": { beginAccountDeletion: (actor: string) => beginAccountDeletionWith(f.local.db, actor) },
      "@/server/account": { deleteAccountForUser: (actor: string) => deleteUnifiedAccountDataWith(f.local.db, actor, {
        eraseNotes: async () => {
          orchestrated = true;
          assert.equal(await hasAccountDeletionStartedWith(f.local.db, actor), true);
          await assert.rejects(checkout("event"), /account is not available/);
          await assert.rejects(portal(), /account is not available/);
          return { ok: true, refreshTokens: [] };
        },
        eraseTimeline: async () => ({ ok: true }),
        eraseSignal: async () => ({ ok: true }),
        revokeTokens: async () => { throw new Error("No provider tokens in this fixture"); },
      }) },
    });
    assert.equal((await route.POST()).status, 500);
    assert.equal(orchestrated, true);
    assert.equal(await ensureUserProvisionedWith(f.local.db, userId), false);
    await assert.rejects(checkout("event"), /account is not available/);
    await assert.rejects(portal(), /account is not available/);
    await access.reconcileStripeAccess({ ...payment, reference: "stripe-sub:sub_delayed", subscriptionId: "sub_delayed" }, f.dependencies);
    assert.deepEqual(await f.local.db.select().from(users), []);
    assert.deepEqual(await f.local.db.select().from(entitlements), []);
    assert.deepEqual(await f.shared.select().from(sharedSchema.entitlements), sharedBefore);
    assert.equal(providerCalls.length, 2);
  } finally { f.close(); }
});



test("recovery: every historical cancellation commits despite canonical shared failure", async () => {
  const f = await fixture();
  try {
    for (const id of ["cs_old", "cs_older"]) {
      await f.local.db.insert(entitlements).values({
        id, userId: purchase.userId, workspaceId: purchase.workspaceId, tier: purchase.tier,
        source: "purchase", notes: "stripe:" + id, expiresAt: purchase.expiresAt,
      });
    }
    const provider = {
      subscriptions: { retrieve: async () => ({ ...subscription(), status: "canceled" }) },
      checkout: { sessions: { list: async () => ({ has_more: false, data: ["cs_old", "cs_older"].map(id => ({
        id, subscription: "sub_fixture", customer: "cus_fixture", metadata,
      })) }) } },
    } as unknown as Stripe;
    let offline = true;
    const attempted: string[] = [];
    const sync = (input: readonly StripeAccess[]) => access.reconcileStripeAccessBatch(input, {
      ...f.dependencies,
      mirror: async value => {
        // Even the FIRST mirror sees every local revocation already committed.
        assert.ok((await f.local.db.select().from(entitlements)).every(row => row.expiresAt?.getTime() === 0));
        attempted.push(value.reference);
        if (offline) throw new Error("shared unavailable");
        await f.mirror(value);
      },
    });
    const send = await signedWebhook(f, provider, { syncBatch: sync });
    const cancellation = event("customer.subscription.deleted", subscription());
    assert.equal((await send(cancellation)).status, 503);
    assert.equal((await f.local.client.execute("SELECT * FROM processed_webhooks")).rows.length, 0);
    assert.deepEqual(new Set(attempted), new Set(["stripe-sub:sub_fixture", "stripe:cs_old", "stripe:cs_older"]));
    assert.equal((await f.local.db.select().from(entitlements)).length, 3);
    assert.ok((await f.local.db.select().from(entitlements)).every(row => row.expiresAt?.getTime() === 0));
    offline = false;
    assert.equal((await send(cancellation)).status, 200);
    assert.equal((await send(cancellation)).status, 200);
    assert.equal((await f.local.client.execute("SELECT * FROM processed_webhooks")).rows.length, 1);
    assert.equal((await f.shared.select().from(sharedSchema.entitlements)).length, 3);
    assert.ok((await f.shared.select().from(sharedSchema.entitlements)).every(row => row.status === "revoked"));
  } finally { f.close(); }
});

test("recovery: positive customer conflicts and missing bindings fail before local extension", async () => {
  const f = await fixture();
  try {
    await access.reconcileStripeAccess(purchase, f.dependencies);
    const renewal = { ...purchase, expiresAt: new Date("2027-08-21T12:00:00Z") };
    await assert.rejects(access.reconcileStripeAccess({ ...renewal, customerId: "cus_wrong" }, f.dependencies), /scope|binding/);
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), purchase.expiresAt?.getTime());
    const [originalBinding] = await f.shared.select().from(sharedSchema.entitlements);
    for (const invalid of [
      { stripeCustomerId: null },
      { stripeSubscriptionId: "sub_wrong" },
      { stripeSubscriptionId: null },
      { metadata: JSON.stringify({ workspaceId: "other-project" }) },
    ]) {
      await f.shared.update(sharedSchema.entitlements).set(invalid);
      await assert.rejects(access.reconcileStripeAccess(renewal, f.dependencies), /scope|binding/);
      assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), purchase.expiresAt?.getTime());
      await f.shared.update(sharedSchema.entitlements).set(originalBinding);
    }
    await f.shared.delete(sharedSchema.entitlements);
    await assert.rejects(access.reconcileStripeAccess(renewal, f.dependencies), /binding/);
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), purchase.expiresAt?.getTime());
    await f.mirror(purchase); // explicit restoration of the verified durable binding
    await access.reconcileStripeAccess(renewal, f.dependencies);
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), renewal.expiresAt.getTime());
  } finally { f.close(); }
});

test("recovery: historical customerless refund only revokes its existing reference", async () => {
  const f = await fixture();
  try {
    const legacy = { ...purchase, tier: "event" as const, reference: "stripe:cs_legacy", subscriptionId: null };
    await f.local.db.insert(entitlements).values({
      id: "historical", userId: legacy.userId, workspaceId: legacy.workspaceId, tier: legacy.tier,
      source: "purchase", notes: legacy.reference, expiresAt: legacy.expiresAt,
    });
    const session = {
      id: "cs_legacy", mode: "payment", payment_status: "paid", metadata: { ...metadata, tier: "event" },
      client_reference_id: "buyer::project-b", customer: null,
      payment_intent: { id: "pi_legacy", customer: null, status: "succeeded",
        latest_charge: { id: "ch_legacy", created: 1800532800, status: "succeeded", paid: true, amount_refunded: 8900 } },
    };
    const provider = { checkout: { sessions: {
      list: async () => ({ has_more: false, data: [session] }), retrieve: async () => session,
    } } } as unknown as Stripe;
    await lifecycle.handleStripeLifecycle(event("charge.refunded", { payment_intent: "pi_legacy" }), provider, {
      sync: value => access.reconcileStripeAccess(value, f.dependencies),
      revokeHistorical: value => access.revokeHistoricalStripeAccess(value, f.dependencies),
    });
    assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), 0);
    assert.deepEqual(await f.shared.select().from(sharedSchema.entitlements), []);
    assert.equal(await access.billingCustomerForUser("buyer", f.shared), null);
    // An old unbound mirror is revoked without gaining a customer binding.
    await f.shared.insert(sharedSchema.entitlements).values({
      id: "legacy-unbound", userClerkId: "buyer", tier: "event", source: "event_pass",
      sourceRef: legacy.reference, status: "active", expiresAt: legacy.expiresAt?.getTime(),
      stripeCustomerId: null, metadata: JSON.stringify({ workspaceId: "project-b" }),
    });
    await lifecycle.handleStripeLifecycle(event("charge.refunded", { payment_intent: "pi_legacy" }), provider, {
      revokeHistorical: value => access.revokeHistoricalStripeAccess(value, f.dependencies),
    });
    const [revoked] = await f.shared.select().from(sharedSchema.entitlements);
    assert.equal(revoked.status, "revoked"); assert.equal(revoked.expiresAt, 0);
    assert.equal(revoked.stripeCustomerId, null);
    assert.equal(await access.billingCustomerForUser("buyer", f.shared), null);
  } finally { f.close(); }
});

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
  await lifecycle.handleStripeLifecycle(event("invoice.paid", invoice()), provider, { syncBatch: async inputs => { writes.push(...inputs); } });
  assert.deepEqual(writes.map(row => [row.reference, row.revoked]), [["stripe-sub:sub_fixture", true], ["stripe:cs_old", true]]);
});

test("paid invoice renewal, unpaid invoice and provider failure have distinct outcomes", async () => {
  const writes: StripeAccess[] = []; let current = invoice();
  const provider = { subscriptions: { retrieve: async () => subscription() }, invoices: { retrieve: async () => current }, checkout: { sessions: { list: async () => ({ has_more: false, data: [] }) } } } as unknown as Stripe;
  await lifecycle.handleStripeLifecycle(event("invoice.paid", current), provider, { syncBatch: async inputs => { writes.push(...inputs); } });
  assert.equal(writes.length, 1); assert.equal(writes[0].expiresAt?.getTime(), current.lines.data[0].period.end * 1000);
  current = { ...current, status: "open" };
  await lifecycle.handleStripeLifecycle(event("invoice.paid", current), provider, { syncBatch: async inputs => { writes.push(...inputs); } });
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
  await lifecycle.handleStripeLifecycle(event("checkout.session.completed", { id: session.id }), provider, { sync });
  assert.equal(writes.length, 1); assert.equal(writes[0].tier, "event");
  session.payment_intent.latest_charge.amount_refunded = 8900;
  await lifecycle.handleStripeLifecycle(event("checkout.session.async_payment_succeeded", { id: session.id }), provider, { sync });
  assert.equal(writes[1].revoked, true);
  session.payment_status = "unpaid";
  await lifecycle.handleStripeLifecycle(event("checkout.session.completed", { id: session.id }), provider, { sync });
  assert.equal(writes.length, 2);
  session.payment_status = "paid"; session.client_reference_id = "stranger::project-b";
  await assert.rejects(lifecycle.handleStripeLifecycle(event("checkout.session.completed", { id: session.id }), provider, { sync }), /ownership/);
});
