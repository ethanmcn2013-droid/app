import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { workspaces } from "./schema";
import { entitlements as sharedEntitlements } from "@/lib/entitlements-shared/schema";
import { fixture, checkout, sync, access, lifecycle, entryPoint, receipts, localRows, decision, PAID, END } from "./event-designation-test-fixture";

test("actual signed webhook keeps paid-undesignated and mirror-failed events retryable; negative local facts precede 503", async () => {
  for (const scenario of ["owner-change", "refund-mirror"] as const) {
    const f = await fixture();
    try {
      const input = await checkout(f);
      if (scenario === "refund-mirror") await sync(f, input);
      else await f.local.db.update(workspaces).set({ ownerUserId: "next-owner" }).where(eq(workspaces.id, "project-a"));
      const session = { id: "cs_one", mode: "payment", payment_status: "paid", customer: "cus_fixture",
        client_reference_id: "buyer::project-a", metadata: { userId: "buyer", workspaceId: "project-a", tier: "event", eventCheckoutIntent: input.eventDesignation!.intentId },
        payment_intent: { id: "pi_fixture", status: "succeeded", customer: "cus_fixture", latest_charge: {
          created: PAID.getTime() / 1000, status: "succeeded", paid: true, amount_refunded: scenario === "refund-mirror" ? 8900 : 0,
        } },
      };
      const { default: StripeSdk } = await import("stripe");
      const sdk = new StripeSdk("sk_test_local_fixture_only");
      const secret = "whsec_local_fixture_only";
      let mirrorFailure = true;
      const provider = { checkout: { sessions: { retrieve: async () => session } }, webhooks: sdk.webhooks } as unknown as Stripe;
      const route = entryPoint<typeof import("@/app/api/webhooks/stripe/route")>("../../app/api/webhooks/stripe/route.ts", {
        "next/server": await import("next/server"), "drizzle-orm": await import("drizzle-orm"),
        "@/server/db": { db: f.local.db }, "@/server/db/schema": await import("./schema"),
        "@/server/stripe": { stripe: provider, WEBHOOK_SECRET: secret },
        "@/lib/access-mode": { isDemoMode: () => false },
        "@/server/stripe-lifecycle": { handleStripeLifecycle: (event: Stripe.Event) => lifecycle.handleStripeLifecycle(event, provider, {
          sync: value => access.reconcileStripeAccess(value, { ...f.dependencies, mirror: async (write) => {
            if (mirrorFailure) throw new Error("synthetic shared mirror failure");
            await access.reconcileSharedStripeAccess(write, f.shared);
          } }),
        }) },
        "@/server/operational-log": { opLog: () => {} },
        "@/lib/entitlements-shared/client": { entitlementsDb: () => f.shared },
        "@/lib/entitlements-shared/schema": await import("@/lib/entitlements-shared/schema"),
      });
      await f.sharedClient.execute("CREATE TABLE processed_webhooks(id TEXT PRIMARY KEY,source TEXT,event_id TEXT,processed_at INTEGER)");
      const payload = JSON.stringify({ id: "evt_local", type: "checkout.session.completed", data: { object: { id: session.id } } });
      const request = () => new Request("https://app.invalid/api/webhooks/stripe", { method: "POST", body: payload,
        headers: { "stripe-signature": sdk.webhooks.generateTestHeaderString({ payload, secret }) } });
      const result = await route.POST(request());
      assert.equal(result.status, 503);
      assert.deepEqual(await result.json(), { ok: false, error: "reconciliation_pending" });
      assert.equal((await f.local.client.execute("SELECT * FROM processed_webhooks")).rows.length, 0);
      const stored = (await receipts(f))[0];
      assert.equal(stored.originalExpiresAt?.getTime(), END.getTime());
      if (scenario === "refund-mirror") {
        assert.equal(stored.revoked, true);
        assert.equal((await localRows(f))[0].expiresAt?.getTime(), 0);
        assert.deepEqual(await decision(f), { kind: "unavailable", reason: "refunded" });
        mirrorFailure = false;
        assert.equal((await route.POST(request())).status, 200);
        assert.equal((await f.local.client.execute("SELECT * FROM processed_webhooks")).rows.length, 1);
      } else {
        assert.equal(stored.designation, "paid_undesignated");
        assert.equal((await localRows(f)).length, 0);
        assert.equal((await f.shared.select().from(sharedEntitlements)).length, 0);
        await f.local.db.update(workspaces).set({ ownerUserId: "buyer" }).where(eq(workspaces.id, "project-a"));
        mirrorFailure = false;
        assert.equal((await route.POST(request())).status, 503);
        assert.deepEqual((await receipts(f))[0], stored);
        session.payment_intent.latest_charge.amount_refunded = 8900;
        assert.equal((await route.POST(request())).status, 200);
        assert.equal((await receipts(f))[0].designation, "paid_undesignated");
        assert.equal((await receipts(f))[0].revoked, true);
        assert.equal((await receipts(f))[0].originalExpiresAt?.getTime(), END.getTime());
        assert.equal((await localRows(f))[0].expiresAt?.getTime(), 0);
      }
    } finally { f.close(); }
  }
});
