import { before, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { entitlementFixture } from "./entitlements-test-db";
import { entitlements } from "./schema";
import { entitlements as sharedEntitlements } from "../../lib/entitlements-shared/schema";
import { listEntitlements, resolveEntitlement, resolveEntitlementOrThrow } from "../../lib/entitlements-shared/reads";
import { writeSharedEntitlement } from "../../lib/entitlements-shared/writes";
import { getQuota } from "../../lib/storage-config";
import type { StripeAccess } from "../stripe-access";
import { exportAccountData } from "../account-export";

let reads: typeof import("./entitlements");
let access: typeof import("../stripe-access");
before(async () => {
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "review";
  process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "preview";
  reads = await import("./entitlements");
  access = await import("../stripe-access");
});

const purchase: StripeAccess = {
  userId: "buyer", workspaceId: "project-a", tier: "event", reference: "stripe:cs_fixture",
  customerId: "cus_fixture", subscriptionId: null,
  expiresAt: new Date(Date.now() + 365 * 86400_000), revoked: false,
};
function sync(f: Awaited<ReturnType<typeof entitlementFixture>>, input: StripeAccess) {
  return access.reconcileStripeAccess(input, {
    database: f.local.db, mirror: value => access.reconcileSharedStripeAccess(value, f.shared),
  });
}

for (const tier of ["event", "workspace"] as const) {
  test(`${tier} bought in A does not supply B's storage or an account/other-user tier`, async () => {
    const f = await entitlementFixture();
    try {
      await sync(f, { ...purchase, tier });
      assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), tier);
      assert.equal(await reads.getEffectiveTier("buyer", "project-b", f.dependencies), "free");
      assert.equal(getQuota(await reads.getEffectiveTier("buyer", "project-b", f.dependencies)).totalBytes, 100 * 1024 ** 2);
      assert.equal(getQuota(await reads.getEffectiveTier("buyer", "project-a", f.dependencies)).totalBytes, 10 * 1024 ** 3);
      assert.equal(await reads.getEffectiveTier("buyer", null, f.dependencies), "free");
      assert.equal(await reads.getEffectiveTier("stranger", "project-a", f.dependencies), "free");
      assert.equal((await resolveEntitlement("buyer", "project-a", f.shared)).tier, tier);
      assert.equal((await resolveEntitlement("buyer", "project-b", f.shared)).tier, "free");
      assert.equal((await resolveEntitlement("buyer", null, f.shared)).tier, "free");
      // A Pro grant still supplies the existing personal feature/count allowance.
      assert.equal(await reads.getPersonalFeatureTier("buyer", f.dependencies), tier);
    } finally { f.close(); }
  });
}

for (const tier of ["event", "workspace", "studio"] as const) {
  test(`${tier} local epoch revocation beats a stale active mirror until and after retry`, async () => {
    const f = await entitlementFixture();
    try {
      const input = { ...purchase, tier, workspaceId: tier === "studio" ? null : "project-a" };
      await sync(f, input);
      await assert.rejects(access.reconcileStripeAccess({ ...input, revoked: true }, {
        database: f.local.db, mirror: async () => { throw new Error("mirror offline"); },
      }), /mirror offline/);
      assert.equal((await f.local.db.select().from(entitlements))[0].expiresAt?.getTime(), 0);
      assert.equal((await f.shared.select().from(sharedEntitlements))[0].status, "active");
      for (const scope of ["project-a", "project-b", null]) {
        assert.equal(await reads.getEffectiveTier("buyer", scope, f.dependencies), "free");
      }
      assert.equal(await reads.getPersonalFeatureTier("buyer", f.dependencies), "free");
      await sync(f, { ...input, revoked: true });
      assert.equal((await f.shared.select().from(sharedEntitlements))[0].status, "revoked");
      assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), "free");
    } finally { f.close(); }
  });
}

test("filter before ranking; a revoked purchase does not suppress an independent account grant", async () => {
  const f = await entitlementFixture();
  try {
    await sync(f, { ...purchase, tier: "workspace" });
    await writeSharedEntitlement({ userClerkId: "buyer", tier: "wedding", source: "venue_edition", sourceRef: "redeem:venue" }, f.shared);
    assert.equal((await resolveEntitlement("buyer", "project-b", f.shared)).tier, "wedding");
    await f.local.db.update(entitlements).set({ expiresAt: new Date(0) });
    assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), "wedding");
    assert.equal(await reads.getEffectiveTier("buyer", "project-b", f.dependencies), "wedding");
  } finally { f.close(); }
});

test("explicitly scoped Studio grants stay scoped; historical account grant shapes remain valid", async () => {
  const f = await entitlementFixture();
  try {
    const cases = [
      { tier: "studio" as const, source: "workspace_subscription" as const },
      { tier: "wedding" as const, source: "venue_edition" as const },
      { tier: "workspace" as const, source: "compliments" as const },
      { tier: "workspace" as const, source: "review_access" as const },
      { tier: "workspace" as const, source: "student_edu" as const },
      { tier: "event" as const, source: "event_pass" as const, metadata: { origin: "studio-ops" } },
      { tier: "event" as const, source: "event_pass" as const, sourceRef: "redeem:legacy" },
      { tier: "workspace" as const, source: "workspace_subscription" as const, metadata: { workspaceId: null, origin: "tasks-grantEntitlement" } },
    ];
    for (const input of cases) {
      await f.shared.delete(sharedEntitlements);
      await writeSharedEntitlement({ userClerkId: "buyer", ...input }, f.shared);
      for (const target of ["project-a", "project-b", null]) {
        assert.equal(await reads.getEffectiveTier("buyer", target, f.dependencies), input.tier);
      }
    }
    await f.shared.delete(sharedEntitlements);
    await writeSharedEntitlement({ userClerkId: "buyer", tier: "studio", source: "compliments", metadata: { workspaceId: "project-a" } }, f.shared);
    assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), "studio");
    assert.equal(await reads.getEffectiveTier("buyer", "project-b", f.dependencies), "free");
  } finally { f.close(); }
});

test("legacy local account purchases survive missing shared scope; ambiguous shared-only purchases do not expand", async () => {
  const f = await entitlementFixture();
  try {
    await writeSharedEntitlement({ userClerkId: "buyer", tier: "workspace", source: "workspace_subscription", sourceRef: "legacy-ref" }, f.shared);
    assert.equal(await reads.getEffectiveTier("buyer", "project-b", f.dependencies), "free");
    await f.local.db.insert(entitlements).values({ id: "legacy", userId: "buyer", workspaceId: null, tier: "workspace", source: "purchase", notes: "legacy-ref" });
    assert.equal(await reads.getEffectiveTier("buyer", "project-b", f.dependencies), "workspace");
    assert.equal(await reads.getEffectiveTier("buyer", null, f.dependencies), "workspace");
    await f.local.db.update(entitlements).set({ expiresAt: new Date(0) });
    assert.equal(await reads.getEffectiveTier("buyer", "project-b", f.dependencies), "free");
  } finally { f.close(); }
});

test("malformed, missing App scope and unknown source/tier rows cannot imply account authority", async () => {
  const f = await entitlementFixture();
  try {
    for (const metadata of ["{", "null", "[]", '{"workspaceId":""}', '{"workspaceId":42}', '{"workspaceId":" project-a"}', '{"origin":"tasks-reconcile-sweep"}']) {
      await f.shared.delete(sharedEntitlements);
      await f.shared.insert(sharedEntitlements).values({ id: "bad", userClerkId: "buyer", tier: "studio", source: "compliments", metadata });
      assert.equal(await reads.getPersonalFeatureTier("buyer", f.dependencies), "free", metadata);
      assert.equal((await resolveEntitlement("buyer", "project-a", f.shared)).tier, "free", metadata);
    }
    for (const fields of [{ source: "unknown", tier: "studio" }, { source: "compliments", tier: "unknown" }]) {
      await f.shared.delete(sharedEntitlements);
      await f.shared.insert(sharedEntitlements).values({ id: "bad", userClerkId: "buyer", ...fields });
      assert.equal(await reads.getPersonalFeatureTier("buyer", f.dependencies), "free");
      assert.equal((await resolveEntitlement("buyer", "project-a", f.shared)).tier, "free");
    }
  } finally { f.close(); }
});

test("natural expiry, duplicate tombstones and mismatched mirror scope/tier cannot resurrect a purchase", async () => {
  const f = await entitlementFixture();
  try {
    await sync(f, purchase);
    await f.local.db.update(entitlements).set({ expiresAt: new Date(Date.now() - 10_000) });
    assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), "free");
    await f.local.db.insert(entitlements).values({ id: "duplicate", userId: "buyer", workspaceId: "project-a", tier: "event", source: "purchase", notes: purchase.reference });
    assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), "free");
    await f.local.db.delete(entitlements).where(eq(entitlements.id, "duplicate"));
    await f.local.db.update(entitlements).set({ expiresAt: purchase.expiresAt });
    await f.shared.update(sharedEntitlements).set({ metadata: JSON.stringify({ workspaceId: "project-b" }) });
    assert.equal(await reads.getEffectiveTier("buyer", "project-b", f.dependencies), "free");
    assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), "event");
    await f.shared.update(sharedEntitlements).set({ metadata: JSON.stringify({ workspaceId: "project-a" }), tier: "studio" });
    assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), "event");
  } finally { f.close(); }
});

test("store outages retain scoped local or independent venue access, never unverifiable purchase mirrors", async () => {
  const f = await entitlementFixture();
  try {
    await sync(f, purchase);
    f.local.client.close();
    assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), "free");
    await writeSharedEntitlement({ userClerkId: "buyer", tier: "wedding", source: "venue_edition", sourceRef: "redeem:offline" }, f.shared);
    assert.equal(await reads.getEffectiveTier("buyer", "project-b", f.dependencies), "wedding");
    f.sharedClient.close();
    assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), "free");
  } finally { f.close(); }
  const g = await entitlementFixture();
  try {
    await sync(g, purchase);
    g.sharedClient.close();
    assert.equal(await reads.getEffectiveTier("buyer", "project-a", g.dependencies), "event");
    assert.equal(await reads.getEffectiveTier("buyer", "project-b", g.dependencies), "free");
    assert.equal((await resolveEntitlement("buyer", "project-a", g.shared)).tier, "free");
    await assert.rejects(resolveEntitlementOrThrow("buyer", "project-a", g.shared));
  } finally { g.close(); }
});

test("active shared inventory retains both scopes and metadata without widening authorisation", async () => {
  const f = await entitlementFixture();
  try {
    await sync(f, purchase);
    await sync(f, { ...purchase, workspaceId: "project-b", reference: "stripe:cs_b" });
    await writeSharedEntitlement({ userClerkId: "stranger", tier: "studio", source: "compliments" }, f.shared);
    const inventory = await listEntitlements("buyer", f.shared);
    assert.equal(inventory.length, 2);
    assert.deepEqual(inventory.map(row => JSON.parse(row.metadata!).workspaceId).sort(), ["project-a", "project-b"]);
    assert.equal((await resolveEntitlement("buyer", null, f.shared)).tier, "free");
    assert.equal(await reads.getEffectiveTier("buyer", "project-c", f.dependencies), "free");
    await f.local.db.update(entitlements).set({ expiresAt: new Date(0) }).where(eq(entitlements.notes, purchase.reference));
    const exported = await exportAccountData(f.local.db, "buyer");
    assert.equal(exported.footprintElsewhere?.entitlements.length, 2);
    assert.ok(exported.footprintElsewhere?.entitlements.some(row => row.expiresAt?.getTime() === 0));
    assert.equal(await reads.getEffectiveTier("buyer", "project-a", f.dependencies), "free");
    assert.equal(await reads.getEffectiveTier("buyer", "project-b", f.dependencies), "event");
  } finally { f.close(); }
});
