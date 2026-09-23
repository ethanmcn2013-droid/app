import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { processedWebhooks } from "@/server/db/schema";
import { stripe, WEBHOOK_SECRET } from "@/server/stripe";
import { isDemoMode } from "@/lib/access-mode";
import { handleStripeLifecycle } from "@/server/stripe-lifecycle";
import { opLog } from "@/server/operational-log";
import { entitlementsDb } from "@/lib/entitlements-shared/client";
import { processedWebhooks as sharedProcessedWebhooks } from "@/lib/entitlements-shared/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dedup is recorded only after both entitlement ledgers reconcile.
 * Per-reference atomic writes make concurrent and out-of-order delivery safe. */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  // db.run() returns a ResultSet, not a row array, the previous
  // `as unknown as Array<{hit:number}>` cast meant `row` was always
  // undefined and the dedup guard never fired. Use the typed select
  // path so a real `1`-or-empty result drives the boolean.
  const [row] = await db
    .select({ id: processedWebhooks.eventId })
    .from(processedWebhooks)
    .where(eq(processedWebhooks.eventId, eventId))
    .limit(1);
  return Boolean(row);
}

async function recordProcessed(
  eventId: string,
  eventType: string,
): Promise<void> {
  await db.run(sql`
    INSERT OR IGNORE INTO processed_webhooks (event_id, event_type)
    VALUES (${eventId}, ${eventType})
  `);
}

/** Verify the provider signature before retrieving current payment truth. */
export async function POST(req: Request) {
  if (isDemoMode()) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });
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
  } catch {
    console.warn("[stripe webhook] signature verification failed");
    return new NextResponse("invalid signature", { status: 401 });
  }

  try {
    if (await alreadyProcessed(event.id)) return NextResponse.json({ ok: true, deduped: true });
    await handleStripeLifecycle(event, stripe);
    // Never acknowledge an event before both entitlement ledgers reconcile.
    await recordProcessed(event.id, event.type);
  } catch {
    opLog("warn", "billing", "Provider event reconciliation pending", { retryRequired: true });
    return NextResponse.json({ ok: false, error: "reconciliation_pending" }, { status: 503 });
  }

  // Mirror the dedup row to the shared signal-entitlements DB so any
  // future cross-product writer (Studio admin grants, third-party
  // billing providers) can short-circuit on the same event id.
  // Fire-and-forget, the canonical dedup is already in the local
  // table above.
  try {
    const eb = entitlementsDb();
    const id = `pw-${event.id}`;
    await eb.insert(sharedProcessedWebhooks)
      .values({ id, source: "stripe", eventId: event.id })
      .onConflictDoNothing();
  } catch {
    console.warn("[stripe webhook] shared dedup mirror pending");
  }

  return NextResponse.json({ ok: true });
}
