import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
 */
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
  matcher: [
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
