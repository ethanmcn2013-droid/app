import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 renamed middleware → proxy. Same shape, same matcher
 * config; just the file name + helper-fn-name. Clerk's helper still
 * works as drop-in.
 *
 * Public routes are the marketing surface plus the open `/share`,
 * `/redeem`, `/welcome`, and Clerk + Stripe webhooks. Everything
 * under `/app` requires a real Clerk session.
 *
 * Graceful dev bypass: when Clerk env keys are unset, the inner
 * handler short-circuits before `auth.protect()` so dev runs even
 * before the workspace owner provisions secrets. `getCurrentUser()`
 * falls back to the legacy seed identity in that mode.
 *
 * Layer 2 — seamless ecosystem (DESIGN.md §14):
 * Authed users hitting a marketing (M) route are 307'd to /app so
 * they land in the workspace rather than the marketing site. The
 * exact M set is defined in LAYER0_ROUTE_ALLOWLIST.md §tasks.
 * Escape hatch: the `signal_preview_public` cookie (value "1") or
 * `?preview=public` query param suppresses the redirect so the
 * operator can demo the public marketing site while signed in.
 */

/**
 * Layer 0 M-routes for tasks. Explicit allowlist — never a heuristic.
 * Source of truth: LAYER0_ROUTE_ALLOWLIST.md §tasks.
 */
const MARKETING_PATHS = new Set(["/", "/features", "/pricing", "/changelog"]);

/** App entry for tasks. */
const APP_ENTRY = "/app";

function marketingToAppRedirect(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (!MARKETING_PATHS.has(pathname)) return null;

  const isAuthed = Boolean(request.cookies.get("__session")?.value);
  if (!isAuthed) return null;

  // Escape hatch: operator set signal_preview_public cookie or ?preview=public
  const isPreview =
    request.cookies.get("signal_preview_public")?.value === "1" ||
    request.nextUrl.searchParams.get("preview") === "public";
  if (isPreview) return null;

  // Authed + M route + no preview escape → 307 to app entry
  return NextResponse.redirect(new URL(APP_ENTRY, request.url), 307);
}

const isPublicRoute = createRouteMatcher([
  "/",
  "/about",
  "/pricing",
  "/changelog",
  "/students",
  "/welcome",
  "/principles",
  "/privacy",
  "/terms",
  "/press",
  "/security",
  "/status",
  "/templates",
  "/templates/(.*)",
  "/for/(.*)",
  "/embed/(.*)",
  "/p/(.*)",
  "/share/(.*)",
  "/redeem/(.*)",
  "/invite/(.*)",
  "/embed.js",
  "/opengraph-image",
  "/opengraph-image/(.*)",
  "/social/(.*)",
  "/manifest.webmanifest",
  "/roadmap",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
  "/api/health/(.*)",
  // Internal cross-product reads (bearer-auth via PARTNER_STATS_SECRET).
  // Not Clerk-protected because the calling service has no Clerk session.
  "/api/internal/(.*)",
  "/sitemap.xml",
  "/robots.txt",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
);

export default clerkMiddleware(async (auth, req) => {
  if (!clerkConfigured) return; // dev pass-through

  // Layer 2 — M-route redirect runs BEFORE Clerk protect so we never
  // call protect() on a marketing page an authed user should skip anyway.
  const redirect = marketingToAppRedirect(req);
  if (redirect) return redirect;

  if (!isPublicRoute(req)) {
    // Explicit unauthenticatedUrl ensures `/app/*` redirects to `/sign-in`
    // for signed-out visitors instead of falling through to a 404 / 401.
    // Survives env-var drift (the Clerk SDK otherwise uses
    // NEXT_PUBLIC_CLERK_SIGN_IN_URL, which can be unset in deploys).
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
    });
  }
});

export const config = {
  // Scope Clerk to routes that actually need auth. Unknown paths fall
  // through to Next.js so branded 404 renders instead of a sign-in redirect.
  // M routes (/, /features, /pricing, /changelog) are included so the
  // Layer 2 redirect runs for authed visitors hitting the marketing surface.
  matcher: [
    "/",
    "/features",
    "/pricing",
    "/changelog",
    "/app/:path*",
    "/api/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/welcome/:path*",
    "/redeem/:path*",
    "/invite/:path*",
    "/settings/:path*",
  ],
};
