import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createCheckoutSessionAction } from "@/server/actions/billing";
import type { PaidTier } from "@/server/stripe";

/**
 * Cross-product checkout entry point (E-7, 2026-05-14).
 *
 * Studio's pricing page (signalstudio.ie/pricing) and any other
 * marketing surface deep-links here to start a Stripe checkout
 * without needing its own Stripe wiring. Tasks owns the Stripe
 * integration; this route is the public seam.
 *
 *   GET /api/checkout?tier=workspace[&return=https://signalstudio.ie/post-checkout]
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

  const { userId } = await auth();
  if (!userId) {
    // Bounce through sign-in. Clerk will return them right back here.
    const back = encodeURIComponent(`/api/checkout?tier=${tier}`);
    return NextResponse.redirect(new URL(`/sign-in?redirect_url=${back}`, req.url));
  }

  try {
    const { url: stripeUrl } = await createCheckoutSessionAction(tier);
    return NextResponse.redirect(stripeUrl);
  } catch (err) {
    // The most likely cause is "no active workspace" — first-run
    // hasn't run yet. Hand off to /welcome which provisions a
    // workspace; user can return to /pricing afterwards.
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn("[api/checkout] handing off to /welcome:", msg);
    return NextResponse.redirect(
      new URL(`/welcome?next=${encodeURIComponent(`/api/checkout?tier=${tier}`)}`, req.url),
    );
  }
}
