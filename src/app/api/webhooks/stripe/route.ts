import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { processedWebhooks } from "@/server/db/schema";
import { stripe, WEBHOOK_SECRET } from "@/server/stripe";
import {
  expireEntitlementByNotes,
  grantEntitlement,
} from "@/server/actions/billing";
import type { EntitlementTier } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Idempotency: Stripe re-delivers webhooks on transient failure
 * (every 30s, up to 3 days). Without dedup, a re-delivered
 * `checkout.session.completed` would grant a second entitlement row.
 * We INSERT the event id; on duplicate id, the INSERT is a no-op
 * (PRIMARY KEY conflict via INSERT OR IGNORE), and we return 200
 * without re-running the handler.
 *
 * Stripe stops retrying as soon as it sees 200, so the audit trail
 * matches what we actually processed.
 */
async function recordOrSkip(
  eventId: string,
  eventType: string,
): Promise<{ alreadyProcessed: boolean }> {
  const result = await db.run(sql`
    INSERT OR IGNORE INTO processed_webhooks (event_id, event_type)
    VALUES (${eventId}, ${eventType})
  `);
  // better-sqlite3 exposes `changes` as the affected-row count.
  // 0 = INSERT was IGNORE'd because eventId already exists.
  const changes = (result as { changes?: number }).changes ?? 0;
  if (changes === 0) {
    void processedWebhooks; // satisfy eslint about unused import (referenced via raw sql)
    return { alreadyProcessed: true };
  }
  return { alreadyProcessed: false };
}

/**
 * Stripe → DB sync via signed webhook.
 *
 * Handles:
 *   - `checkout.session.completed` → grant entitlement (one-time
 *     for Wedding tier, subscription-bootstrap for Pro/Team).
 *   - `customer.subscription.updated` → renew expires_at.
 *   - `customer.subscription.deleted` → expire the entitlement.
 *
 * Identity resolution: we set `metadata.userId` and
 * `metadata.workspaceId` on the checkout session AND propagate to
 * the subscription, so every event can find the right entitlement
 * row without a separate Stripe-customer-id mapping table.
 */
export async function POST(req: Request) {
  if (!stripe || !WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "stripe not configured" },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse("missing stripe-signature", { status: 400 });
  }

  const payload = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.warn("[stripe webhook] signature verification failed", err);
    return new NextResponse("invalid signature", { status: 401 });
  }

  // Idempotency check — short-circuit if Stripe is re-delivering an
  // event we've already processed. The INSERT-OR-IGNORE happens BEFORE
  // any side-effect work, so even a flaky handler that crashes mid-way
  // gets retried (the row is only inserted if INSERT succeeded — which
  // doesn't gate on the rest of the handler). 200 stops Stripe from
  // retrying further.
  const dedup = await recordOrSkip(event.id, event.type);
  if (dedup.alreadyProcessed) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // The checkout-session metadata carries `workspaceId` as a string,
  // either a real workspace id or the literal "*" sentinel for
  // user-level scope (Studio). Decode here.
  const decodeWorkspaceId = (raw: string | undefined): string | null => {
    if (!raw) return null;
    if (raw === "*") return null;
    return raw;
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      const userId = s.metadata?.userId;
      const rawWorkspaceId = s.metadata?.workspaceId;
      const tier = s.metadata?.tier as EntitlementTier | undefined;
      if (!userId || !rawWorkspaceId || !tier) break;
      const workspaceId = decodeWorkspaceId(rawWorkspaceId);
      // Studio is the only tier where workspaceId may be null;
      // every other tier needs a real workspace.
      if (workspaceId === null && tier !== "studio") break;

      await grantEntitlement({
        userId,
        workspaceId,
        tier,
        source: "purchase",
        durationDays: tier === "wedding" ? null : 30,
        notes: `stripe:${s.id}`,
      });
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const userId = sub.metadata?.userId;
      const rawWorkspaceId = sub.metadata?.workspaceId;
      const tier = sub.metadata?.tier as EntitlementTier | undefined;
      if (!userId || !rawWorkspaceId || !tier) break;
      const workspaceId = decodeWorkspaceId(rawWorkspaceId);
      if (workspaceId === null && tier !== "studio") break;
      // Renewal: write a fresh row dated through the new period end.
      const periodEnd =
        (sub as unknown as { current_period_end?: number }).current_period_end;
      if (periodEnd) {
        await grantEntitlement({
          userId,
          workspaceId,
          tier,
          source: "purchase",
          durationDays: Math.ceil(
            (periodEnd * 1000 - Date.now()) / (24 * 60 * 60 * 1000),
          ),
          notes: `stripe-sub:${sub.id}`,
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await expireEntitlementByNotes(`stripe-sub:${sub.id}`);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
