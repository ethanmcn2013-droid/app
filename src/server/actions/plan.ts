"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { stripe } from "@/server/stripe";
import { isDemoMode } from "@/lib/access-mode";

const FALLBACK_BASE = "http://localhost:3001";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_BASE;
}

/** Return paths the portal may bounce back to. Allow-listed so a caller
 *  cannot turn the portal return into an open redirect. */
const RETURN_PATHS = ["/settings/plan", "/app/settings"] as const;
type ReturnPath = (typeof RETURN_PATHS)[number];

/**
 * Create a Stripe Customer Portal session for the current user.
 * Returns the redirect URL.
 *
 * The Stripe customer is looked up by the user's primary email because we
 * don't currently store stripe_customer_id locally (stored-id lookup is the
 * recorded follow-up). Two guards make the email path safe (Opus Phase 4
 * review, binding):
 *   1. The primary email must be VERIFIED in Clerk. Clerk allows setting an
 *      unverified primary address, so without this check a user could point
 *      their primary email at someone else's billing address and be handed
 *      that customer's portal (payment methods, invoices, cancel).
 *   2. If more than one Stripe customer carries the email, refuse rather
 *      than silently picking one - shared emails are possible in Stripe and
 *      guessing is a mis-billing risk.
 */
export async function createBillingPortalSessionAction(
  returnPath: ReturnPath = "/settings/plan",
): Promise<{
  url: string;
}> {
  if (isDemoMode()) throw new Error("Billing is unavailable in this preview.");
  if (!stripe) {
    throw new Error("Billing isn't connected yet. Try again later.");
  }
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  );
  const email = primary?.emailAddress;
  if (!email) throw new Error("No email on file");
  if (primary.verification?.status !== "verified") {
    throw new Error(
      "Verify your email address first, then try billing again.",
    );
  }

  const customers = await stripe.customers.list({ email, limit: 2 });
  if (customers.data.length > 1) {
    throw new Error(
      "More than one billing account matches your email. Reply to your last receipt and we'll fix it manually.",
    );
  }
  const customer = customers.data[0];
  if (!customer) {
    throw new Error(
      "We can't find a Stripe customer for your account. Reply to your last receipt and we'll fix it manually.",
    );
  }

  const path: ReturnPath = RETURN_PATHS.includes(returnPath)
    ? returnPath
    : "/settings/plan";
  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${siteUrl()}${path}`,
  });
  return { url: session.url };
}
