import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { isDemoMode, isProductionMode } from "@/lib/access-mode";
import { isBareArtifactPath } from "@/lib/bare-artifact-path";
import {
  APP_ORIGIN,
  PRODUCT_MARKETING_URLS,
} from "@/lib/product-urls";

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
 * Layer 2, unified ecosystem (DESIGN.md §14):
 * Authed users hitting a marketing (M) route are 307'd to /app so
 * they land in the workspace rather than the marketing site. The
 * exact M set is defined in LAYER0_ROUTE_ALLOWLIST.md §tasks.
 * Escape hatch: the `signal_preview_public` cookie (value "1") or
 * `?preview=public` query param suppresses the redirect so the
 * operator can demo the public marketing site while signed in.
 */

/**
 * Layer 0 M-routes for tasks. Explicit allowlist, never a heuristic.
 * Source of truth: LAYER0_ROUTE_ALLOWLIST.md §tasks.
 */
const MARKETING_PATHS = new Set(["/", "/features", "/pricing", "/changelog"]);

/** App entry for tasks. */
const APP_ENTRY = "/app";

const BARE_ARTIFACT_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "private, no-store",
  "Vercel-CDN-Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

/**
 * @param isAuthed real Clerk session state (userId present), NOT raw cookie
 * presence. Using the `__session` cookie alone wrongly treats a stale/expired
 * cookie as authed, 307'ing the visitor to /app where protect() then walls
 * them at /sign-in, the "forced sign-in unless incognito" bug. A genuine
 * session redirects to the app; everyone else keeps the public marketing view.
 */
function marketingToAppRedirect(
  request: NextRequest,
  isAuthed: boolean,
): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (!MARKETING_PATHS.has(pathname)) return null;
  if (!isAuthed) return null;

  // Escape hatch: operator set signal_preview_public cookie or ?preview=public
  const isPreview =
    request.cookies.get("signal_preview_public")?.value === "1" ||
    request.nextUrl.searchParams.get("preview") === "public";
  if (isPreview) return null;

  // Authed + M route + no preview escape → 307 to app entry
  return NextResponse.redirect(new URL(APP_ENTRY, request.url), 307);
}

/**
 * Production has one marketing origin and one app origin. The legacy Tasks
 * hostname remains available for embeds, published workspaces, invites, and
 * service traffic, but its root is no longer a separate marketing home.
 */
function productRootRedirect(
  request: NextRequest,
  isAuthed: boolean,
): NextResponse | null {
  if (request.nextUrl.pathname !== "/") return null;

  const host = request.headers
    .get("host")
    ?.split(":", 1)[0]
    ?.toLowerCase();
  if (host !== "app.signalstudio.ie" && host !== "tasks.signalstudio.ie") {
    return null;
  }

  const destination = isAuthed
    ? `${APP_ORIGIN}/app`
    : PRODUCT_MARKETING_URLS.tasks;
  return NextResponse.redirect(destination, isAuthed ? 307 : 308);
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
  "/s/(.*)",
  "/the-wedding",
  "/redeem/(.*)",
  "/invite/(.*)",
  "/embed.js",
  "/opengraph-image",
  "/opengraph-image/(.*)",
  "/social/(.*)",
  "/manifest.webmanifest",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
  "/api/health/(.*)",
  // Public so the browser can POST CSP violation reports without a session.
  "/api/csp-report",
  // Internal cross-product reads (bearer-auth via PARTNER_STATS_SECRET).
  // Not Clerk-protected because the calling service has no Clerk session.
  "/api/internal/(.*)",
  // Cross-repo Notes→Tasks extract (bearer-auth via NOTES_TO_TASKS_SECRET).
  // The Notes server action has no Clerk session, bearer guards the route.
  "/api/notes-extract",
  "/api/notes-extract/v2",
  "/sitemap.xml",
  "/robots.txt",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
);

const productionProxy = clerkMiddleware(async (auth, req) => {
  // Demo/Review: /app/* is publicly reachable. Auth resolves to the synthetic
  // demo user bound to in-memory seed data (lib/access-mode.ts,
  // server/demo/tasks-demo.ts). Flip SIGNAL_ACCESS_MODE back to production to
  // restore this exact gate.
  if (isDemoMode()) return;

  if (!clerkConfigured) {
    // Fail CLOSED in production. A prod deploy missing Clerk keys must
    // not silently serve /app unauthenticated (the proxy is the edge
    // backstop; getCurrentUser() already throws server-side). Locally we
    // still pass through so dev runs before keys are provisioned.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Authentication is not configured.", {
        status: 503,
      });
    }
    return; // dev pass-through
  }

  // Layer 2, M-route redirect uses the REAL session (userId), so a stale
  // __session cookie no longer bounces a signed-out visitor into the /app
  // sign-in wall. Genuine sessions still land in the workspace.
  const { userId } = await auth();
  const productRoot = productRootRedirect(req, Boolean(userId));
  if (productRoot) return productRoot;

  const redirect = marketingToAppRedirect(req, Boolean(userId));
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
}, {
  // Clerk's dashboard allowlist mirrors these two production origins.
  // app.signalstudio.ie is canonical; tasks.signalstudio.ie remains a
  // temporary compatibility/service host while its app URLs redirect.
  authorizedParties: [
    "https://app.signalstudio.ie",
    "https://tasks.signalstudio.ie",
  ],
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isBareArtifactPath(req.nextUrl.pathname)) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-signal-bare-artifact", "1");
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    for (const [key, value] of Object.entries(BARE_ARTIFACT_RESPONSE_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }
  if (isDemoMode()) return NextResponse.next();
  if (!clerkConfigured) {
    // Do not invoke Clerk without credentials. A genuine production
    // deployment fails closed; classified previews and local development may
    // continue only through their non-production, seed-data access posture.
    if (isProductionMode()) {
      return new NextResponse("Authentication is not configured.", {
        status: 503,
      });
    }
    return NextResponse.next();
  }
  return productionProxy(req, event);
}

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
    "/s/:path*",
    "/the-wedding",
    "/api/:path*",
    "/sign-in/:path*",
    "/sign-up/:path*",
    "/welcome/:path*",
    "/redeem/:path*",
    "/invite/:path*",
    "/settings/:path*",
  ],
};
