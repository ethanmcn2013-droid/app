import { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { entitlementFixture } from "./entitlements-test-db";
import { entitlements, eventPurchaseDesignations, users, workspaceMembers } from "./schema";
import type { StripeAccess } from "@/server/stripe-access";

let designation: typeof import("./event-designation");
let access: typeof import("@/server/stripe-access");
let lifecycle: typeof import("@/server/stripe-lifecycle");
let evaluator: typeof import("@/server/projects/event-project-access");
let deletion: typeof import("@/server/account-deletion-lifecycle");
let authz: typeof import("@/server/actions/project-authz");
const originalFetch = globalThis.fetch;
before(async () => {
  // Process-local test mode prevents unused default clients reaching real stores.
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  globalThis.fetch = async () => { throw new Error("Network is forbidden in Event fixtures"); };
  designation = await import("./event-designation");
  access = await import("@/server/stripe-access");
  lifecycle = await import("@/server/stripe-lifecycle");
  evaluator = await import("@/server/projects/event-project-access");
  deletion = await import("@/server/account-deletion-lifecycle");
  authz = await import("@/server/actions/project-authz");
});
after(() => { globalThis.fetch = originalFetch; });

type Fixture = Awaited<ReturnType<typeof fixture>>;
// Keep the synthetic term after the actual checkout/SQL insertion clock, even
// when this mandatory fixture runs in a later year. No production clock override.
const year = new Date().getUTCFullYear() + 1;
const PAID = new Date(`${year}-01-21T12:00:00Z`);
const END = new Date(`${year + 1}-01-21T12:00:00Z`);
const ACTIVE = new Date(`${year}-02-21T12:00:00Z`);
const AFTER = new Date(`${year + 1}-02-21T12:00:00Z`);

async function fixture() {
  const f = await entitlementFixture();
  await f.local.client.execute("PRAGMA journal_mode=WAL");
  await f.local.client.execute("PRAGMA foreign_keys=ON");
  for (const id of ["co-owner", "member", "outsider", "next-owner"]) {
    await f.local.db.insert(users).values({ id, clerkId: id, handle: id, name: "Synthetic " + id, initials: "FX", color: "fixture" });
  }
  await f.local.db.insert(workspaceMembers).values([
    { workspaceId: "project-a", userId: "co-owner", role: "owner" },
    { workspaceId: "project-a", userId: "member", role: "member" },
    { workspaceId: "project-a", userId: "next-owner", role: "member" },
  ]);
  return f;
}

async function checkout(f: Fixture, suffix = "one"): Promise<StripeAccess> {
  let intentId = "";
  const result = await designation.createEventCheckoutWith(f.local.db,
    { actorUserId: "buyer", workspaceId: "project-a" },
    async id => {
      intentId = id;
      return { id: "cs_" + suffix, url: "https://checkout.invalid/" + suffix };
    });
  assert.equal(result.url, "https://checkout.invalid/" + suffix);
  return {
    userId: "buyer", workspaceId: "project-a", tier: "event",
    reference: "stripe:cs_" + suffix, customerId: "cus_fixture", subscriptionId: null,
    expiresAt: END, revoked: false, eventDesignation: { intentId, settledAt: PAID },
  };
}
const sync = (f: Fixture, input: StripeAccess) => access.reconcileStripeAccess(input, f.dependencies);
const decision = (f: Fixture, now = AFTER, actorUserId = "buyer", workspaceId = "project-a") =>
  evaluator.readEventProjectAccessWith(f.local.db, f.shared, { actorUserId, workspaceId, now });
// isolation-ok: synthetic disposable fixture only; inspect ALL rows to detect
// accidental cross-project writes. Only the two Node test files import this helper.
const receipts = (f: Fixture) => f.local.db.select().from(eventPurchaseDesignations);
// isolation-ok: the isolated fixture must also prove zero unrelated grants.
const localRows = (f: Fixture) => f.local.db.select().from(entitlements);

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


export { designation, access, lifecycle, evaluator, deletion, authz, fixture, checkout, sync, decision, receipts, localRows, entryPoint, PAID, END, ACTIVE, AFTER };
export type { Fixture };
