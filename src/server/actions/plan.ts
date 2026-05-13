"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { stripe } from "@/server/stripe";

const FALLBACK_BASE = "http://localhost:3001";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_BASE;
}

/**
 * Create a Stripe Customer Portal session for the current user.
 * Returns the redirect URL. Looks up the Stripe customer by the
 * user's primary email — we don't currently store stripe_customer_id
 * on the users table, and the portal needs it. Email lookup is
 * adequate for v1; a stored id is a Plan 9.2 follow-up if we ever
 * have multiple Stripe customers per email.
 */
export async function createBillingPortalSessionAction(): Promise<{
  url: string;
}> {
  if (!stripe) {
    throw new Error("Billing isn't connected yet. Try again later.");
  }
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress;
  if (!email) throw new Error("No email on file");

  const customers = await stripe.customers.list({ email, limit: 1 });
  const customer = customers.data[0];
  if (!customer) {
    throw new Error(
      "We can't find a Stripe customer for your account. Reply to your last receipt and we'll fix it manually.",
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${siteUrl()}/settings/plan`,
  });
  return { url: session.url };
}
