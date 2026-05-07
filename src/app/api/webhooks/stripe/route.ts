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
 * (every 30s, up to 3 days). The dedup table prevents redundant work,
 * but the canonical idempotency key is the `notes` field on the
 * entitlement row (set to `stripe:<event-id>` or `stripe-sub:<sub-id>`).
 * `grantEntitlement` skips inserts when a row with the same notes
 * exists, so even a Stripe retry that lands while the dedup record
 * is missing — i.e. a partial-handler crash before the dedup write —
 * is safe: the second retry's grant is a no-op because the entitlement
 * already lives in the table.
 *
 * Order: do the grant FIRST, then record the dedup row. If the grant
 * crashes, no dedup row exists, and Stripe's retry will re-run the
 * handler. The customer always ends up entitled. The cost: a brief
 * window where two concurrent retries could both run the grant —
 * harmless because grantEntitlement is idempotent on notes.
 */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  const [row] = await db.run(
    sql`SELECT 1 AS hit FROM processed_webhooks WHERE event_id = ${eventId} LIMIT 1`,
  ) as unknown as Array<{ hit: number }>;
  return Boolean(row?.hit);
}

async function recordProcessed(
  eventId: string,
  eventType: string,
): Promise<void> {
  await db.run(sql`
    INSERT OR IGNORE INTO processed_webhooks (event_id, event_type)
    VALUES (${eventId}, ${eventType})
  `);
  void processedWebhooks; // referenced via raw sql; keeps the import live
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

  // Cheap pre-check: skip the work if we've already finished this
  // event. The real idempotency guarantee lives on the entitlement
  // row's `notes` field — see grantEntitlement. The dedup row is
  // recorded only AFTER the handler succeeds, so a partial-handler
  // crash leaves the event re-runnable and the customer always ends
  // up entitled.
  if (await alreadyProcessed(event.id)) {
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

  // Record the event AFTER the handler completes. A crash above this
  // line leaves no dedup row; Stripe's retry will land safely because
  // grantEntitlement is idempotent on the `notes` field.
  await recordProcessed(event.id, event.type);

  return NextResponse.json({ ok: true });
}
