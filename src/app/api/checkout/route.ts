import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createCheckoutSessionAction } from "@/server/actions/billing";
import {
  MissingStripePriceError,
  stripeConfigured,
  type BillingInterval,
  type PaidTier,
} from "@/server/stripe";
import { isDemoMode } from "@/lib/access-mode";
import { checkoutAvailable, EVENT_UNAVAILABLE_MESSAGE } from "@/lib/billing-availability";

/**
 * Cross-product checkout entry point (E-7, 2026-05-14).
 *
 * Studio's pricing page (signalstudio.ie/pricing) and any other
 * marketing surface deep-links here to start a Stripe checkout
 * without needing its own Stripe wiring. Tasks owns the Stripe
 * integration; this route is the public seam.
 *
 *   GET /api/checkout?tier=workspace[&interval=annual][&return=https://signalstudio.ie/post-checkout]
 *
 * `interval=annual` selects the yearly price where one exists. It fails
 * explicitly when the annual Stripe Price is absent and never substitutes
 * a monthly checkout.
 *
 * Flow:
 *   1. Validate the tier query param.
 *   2. Auth-check via Clerk. Unauthed users are redirected to
 *      /sign-in with a redirect_url back to this route, so they
 *      complete sign-up and land back inside the checkout flow.
 *   3. Hand off to createCheckoutSessionAction. Tasks's mature
 *      grant-and-webhook path takes it from there; the resulting
 *      entitlement is mirrored to the shared signal-entitlements
 *      DB on Stripe success.
 *
 * Note on workspace context: createCheckoutSessionAction reads the
 * user's active workspace via getActiveWorkspace(). A user arriving
 * fresh from the umbrella who has no workspace yet will fail there;
 * the route surfaces the error as a redirect to /welcome where the
 * first-run flow stands up a workspace. After that, /api/checkout
 * is safe to re-enter.
 */
const VALID_TIERS = new Set<PaidTier>(["workspace", "studio", "wedding", "event"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tierParam = url.searchParams.get("tier");
  if (!tierParam || !VALID_TIERS.has(tierParam as PaidTier)) {
    return NextResponse.json(
      { error: `Unknown tier '${tierParam ?? ""}'. Expected one of: workspace, studio, wedding, event.` },
      { status: 400 },
    );
  }
  const tier = tierParam as PaidTier;
  // Refuse before sign-in, review redirects or provider setup; an unavailable
  // offer must not loop through onboarding or look purchasable in a preview.
  if (!checkoutAvailable(tier)) {
    return NextResponse.json(
      { error: EVENT_UNAVAILABLE_MESSAGE, code: "plan_unavailable", tier },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const interval: BillingInterval =
    url.searchParams.get("interval") === "annual" ? "annual" : "monthly";
  const intervalQS = interval === "annual" ? "&interval=annual" : "";

  if (isDemoMode()) {
    return NextResponse.redirect(
      new URL(`/app/tasks?checkout=review&tier=${tier}`, req.url),
    );
  }

  // Give the public route a recoverable destination when billing is offline.
  // The Server Action independently refuses missing Stripe configuration.
  if (process.env.NODE_ENV === "production" && !stripeConfigured) {
    return NextResponse.redirect(
      new URL("/pricing?status=checkout-offline", req.url),
    );
  }

  const { userId } = await auth();
  if (!userId) {
    // Bounce through sign-in. Clerk will return them right back here.
    const back = encodeURIComponent(
      `/api/checkout?tier=${tier}${intervalQS}`,
    );
    return NextResponse.redirect(new URL(`/sign-in?redirect_url=${back}`, req.url));
  }

  try {
    const { url: stripeUrl } = await createCheckoutSessionAction(
      tier,
      interval,
    );
    return NextResponse.redirect(stripeUrl);
  } catch (err) {
    if (err instanceof MissingStripePriceError) {
      return NextResponse.json(
        {
          error: "The requested checkout interval is not configured.",
          tier: err.tier,
          interval: err.interval,
        },
        { status: 503 },
      );
    }
    // The most likely cause is "no active workspace", first-run
    // hasn't run yet. Hand off to /welcome which provisions a
    // workspace; user can return to /pricing afterwards.
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn("[api/checkout] handing off to /welcome:", msg);
    return NextResponse.redirect(
      new URL(
        `/welcome?next=${encodeURIComponent(`/api/checkout?tier=${tier}${intervalQS}`)}`,
        req.url,
      ),
    );
  }
}
