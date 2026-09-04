"use server";

import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/server/stripe";
import { isDemoMode } from "@/lib/access-mode";
import { billingCustomerForUser } from "@/server/stripe-access";

const FALLBACK_BASE = "http://localhost:3001";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_BASE;
}

/** Return paths the portal may bounce back to. Allow-listed so a caller
 *  cannot turn the portal return into an open redirect. */
const RETURN_PATHS = ["/settings/plan", "/app/settings"] as const;
type ReturnPath = (typeof RETURN_PATHS)[number];

/** Open only the provider-customer identity bound by a verified payment.
 * A matching or recycled email address is never billing authority. */
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

  const customerId = await billingCustomerForUser(userId);
  if (!customerId) throw new Error("Your billing account needs to be linked from its verified payment record. Contact support with your receipt.");

  const path: ReturnPath = RETURN_PATHS.includes(returnPath)
    ? returnPath
    : "/settings/plan";
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}${path}`,
  });
  return { url: session.url };
}
