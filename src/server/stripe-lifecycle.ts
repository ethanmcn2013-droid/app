import "server-only";
import type Stripe from "stripe";
import { eventAccessExpiresAt, isPaidTier } from "./checkout-policy";
import { reconcileStripeAccess, type StripeAccess } from "./stripe-access";

const objectId = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id ?? null;
function identity(metadata: Stripe.Metadata | null | undefined) {
  const { userId, workspaceId, tier } = metadata ?? {};
  if (!userId || !workspaceId || !isPaidTier(tier) || (workspaceId === "*" && tier !== "studio")) {
    throw new Error("Payment identity is incomplete.");
  }
  return { userId, workspaceId: workspaceId === "*" ? null : workspaceId, tier };
}

/** Paid invoice lines, not a guessed duration or a subscription update, prove term. */
export function paidSubscriptionTerm(sub: Stripe.Subscription, invoice: Stripe.Invoice): Date | null {
  if (invoice.status !== "paid" || objectId(invoice.customer) !== objectId(sub.customer) ||
    objectId(invoice.parent?.subscription_details?.subscription) !== sub.id) return null;
  if (invoice.lines.has_more) throw new Error("The full invoice is required to verify its paid term.");
  const items = new Set(sub.items.data.map(item => item.id));
  const periods = invoice.lines.data.filter(line => {
    const parent = line.parent?.subscription_item_details;
    return parent?.subscription === sub.id && items.has(parent.subscription_item) &&
      !parent.proration && line.amount >= 0 && Number.isSafeInteger(line.period.end) && line.period.end > 0;
  }).map(line => line.period.end);
  if (!periods.length) return null;
  // The current product has one plan per subscription. Mixed-plan subscriptions
  // need an explicit contract instead of silently taking the longest item.
  if (sub.items.has_more || sub.items.data.length !== 1) throw new Error("This subscription needs billing review.");
  return new Date(Math.max(...periods) * 1000);
}

export async function handleStripeLifecycle(event: Stripe.Event, provider: Stripe, sync: (input: StripeAccess) => Promise<void> = reconcileStripeAccess): Promise<void> {
  const subscription = async (id: string, invoiceId?: string) => {
    const sub = await provider.subscriptions.retrieve(id, { expand: ["latest_invoice"] });
    const owner = identity(sub.metadata);
    if (owner.tier !== "workspace" && owner.tier !== "studio") throw new Error("Subscription tier is invalid.");
    const customerId = objectId(sub.customer);
    if (!customerId) throw new Error("Billing customer is missing.");
    const revoked = sub.status === "canceled" || sub.status === "incomplete_expired";
    let expiresAt: Date | null = null;
    if (!revoked) {
      const invoice = invoiceId ? await provider.invoices.retrieve(invoiceId) :
        typeof sub.latest_invoice === "object" ? sub.latest_invoice : sub.latest_invoice ? await provider.invoices.retrieve(sub.latest_invoice) : null;
      if (!invoice) return;
      expiresAt = paidSubscriptionTerm(sub, invoice);
      if (!expiresAt) return; // A failed/unpaid period never extends access.
    }
    await sync({ ...owner, customerId, subscriptionId: sub.id, reference: `stripe-sub:${sub.id}`, expiresAt, revoked });

    // Retire the historical 30-day checkout grant for this exact subscription.
    // Its separate reference must not survive cancellation or outlive a paid term.
    const sessions = await provider.checkout.sessions.list({ subscription: sub.id, limit: 100 });
    if (sessions.has_more) throw new Error("Historical checkout reconciliation is incomplete.");
    for (const session of sessions.data) {
      if (objectId(session.subscription) !== sub.id) throw new Error("Checkout subscription mismatch.");
      const sessionOwner = identity(session.metadata);
      if (JSON.stringify(sessionOwner) !== JSON.stringify(owner) || objectId(session.customer) !== customerId) throw new Error("Checkout ownership mismatch.");
      await sync({ ...owner, customerId, subscriptionId: sub.id, reference: `stripe:${session.id}`, expiresAt: null, revoked: true });
    }
  };

  const checkout = async (sessionId: string) => {
    const session = await provider.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
    if (session.payment_status !== "paid") return;
    const owner = identity(session.metadata);
    if (session.client_reference_id !== `${owner.userId}::${owner.workspaceId ?? "*"}`) throw new Error("Checkout ownership is not verified.");
    if (session.mode === "subscription") {
      const id = objectId(session.subscription);
      if (!id) throw new Error("Subscription is missing.");
      await subscription(id);
      return;
    }
    if (session.mode !== "payment" || (owner.tier !== "event" && owner.tier !== "wedding")) throw new Error("Checkout tier does not match its payment mode.");
    const intent = session.payment_intent;
    if (!intent || typeof intent === "string") throw new Error("Settled payment evidence is missing.");
    const charge = intent.latest_charge;
    if (intent.status !== "succeeded" || !charge || typeof charge === "string" || charge.status !== "succeeded" || !charge.paid) return;
    const customerId = objectId(session.customer);
    if (!customerId || objectId(intent.customer) !== customerId) throw new Error("Payment customer mismatch.");
    await sync({ ...owner, customerId, subscriptionId: null, reference: `stripe:${session.id}`,
      expiresAt: owner.tier === "event" ? eventAccessExpiresAt(new Date(charge.created * 1000)) : null,
      revoked: charge.amount_refunded > 0,
    });
  };

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await checkout(event.data.object.id);
      break;
    case "invoice.paid": {
      const invoice = event.data.object;
      const id = objectId(invoice.parent?.subscription_details?.subscription);
      if (id) await subscription(id, invoice.id);
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await subscription(event.data.object.id);
      break;
    case "charge.refunded": {
      const charge = event.data.object;
      const intent = objectId(charge.payment_intent);
      if (!intent) break;
      const sessions = await provider.checkout.sessions.list({ payment_intent: intent, limit: 100 });
      if (sessions.has_more) throw new Error("Refund reconciliation is incomplete.");
      for (const session of sessions.data) if (session.mode === "payment") await checkout(session.id);
      break;
    }
  }
}
