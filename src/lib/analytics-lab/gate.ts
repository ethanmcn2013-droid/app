import { notFound } from "next/navigation";
import { getAccessMode } from "@/lib/access-mode";
import { getCurrentUserOrNull } from "@/server/auth";

/**
 * Wave 5 · The Analytics lab's own front door (D-013).
 *
 * WHY THIS FILE EXISTS. `docs/wave/DECISIONS.md` D-013 and
 * `docs/wave/ANALYTICS_TRUTH.md` §"Two isolation findings" record that the
 * analytics fixture path returns a synthetic principal `signal-${mode}` and
 * **never calls `auth()`**. It is deny-by-default only by accident of a flag
 * 404ing first. The lab is forbidden from inheriting that posture.
 *
 * Two independent reasons the existing posture cannot be borrowed here:
 *
 *   1. `/lab/*` is NOT in the proxy matcher (`src/proxy.ts:280-297` lists
 *      `/`, `/app/:path*`, `/s/:path*`, `/api/:path*` and the auth routes —
 *      `lab` appears nowhere). So no Clerk gate runs for these routes at all.
 *      Every existing lab route is public, and these would have been too.
 *   2. The analytics domain's own gate lives behind a flag whose only other
 *      consumer swaps a shipped briefing engine (D-011). Reusing it would
 *      couple a review surface to an operator-visible one.
 *
 * WHAT THIS GATE PROVES, EXACTLY. Four conditions, all required, checked
 * server-side before any fixture-derived byte is rendered. Any failure is
 * `notFound()` — a 404, never a redirect, because a redirect would confirm
 * the route exists to someone who should not know that.
 *
 *   1. The lab flag is explicitly on. Absent means off.
 *   2. The deployment is not production. Fails closed when unclassified.
 *   3. The access mode is not demo or review. This is the D-013 condition:
 *      both of those postures hand out a synthetic identity without ever
 *      reaching Clerk, and that is precisely the posture being refused.
 *   4. A principal resolves. On a deployed environment that means Clerk.
 *
 * Optionally a reviewer allowlist narrows it further.
 *
 * WHAT IT DOES NOT PROVE, HONESTLY. Conditions 2 and 3 together mean the lab
 * is unreachable on every deployed environment this repo can currently
 * produce: production is refused outright, and a Vercel preview classifies as
 * `review` (`src/lib/access-mode.ts:60-68`) which is also refused. The lab is
 * therefore a local-review surface. Serving it from a protected preview would
 * need a review posture that authenticates for real, which does not exist
 * today — that is an open item, not something this file quietly works around.
 *
 * To review locally:
 *   SIGNAL_ANALYTICS_LAB=1 pnpm --config.verify-deps-before-run=false dev
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function labFlagOn(): boolean {
  const raw = (process.env.SIGNAL_ANALYTICS_LAB ?? "").toLowerCase().trim();
  return TRUTHY.has(raw);
}

/**
 * Mirrors `isProductionDeployment()` in `src/lib/access-mode.ts`, which is not
 * exported. Kept deliberately strict: an unclassified production build counts
 * as production, so the lab fails closed rather than open.
 */
function isProductionDeployment(): boolean {
  const deploymentEnv = process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV;
  return (
    deploymentEnv === "production" ||
    (process.env.NODE_ENV === "production" && !deploymentEnv)
  );
}

function reviewerAllowlist(): string[] {
  return (process.env.SIGNAL_ANALYTICS_LAB_REVIEWERS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Call at the top of every Analytics lab route, before rendering anything.
 * Returns the principal the reading is being shown to, so a composition can
 * state who is reading rather than implying a universal view.
 */
export async function requireAnalyticsLabReviewer(): Promise<string> {
  if (!labFlagOn()) notFound();
  if (isProductionDeployment()) notFound();

  // D-013: refuse the exact posture the audit found — an identity handed out
  // without authentication. Demo and review both do that.
  const mode = getAccessMode();
  if (mode === "demo" || mode === "review") notFound();

  const principal = await getCurrentUserOrNull();
  if (!principal) notFound();

  const allowlist = reviewerAllowlist();
  if (allowlist.length > 0 && !allowlist.includes(principal)) notFound();

  return principal;
}

/** Every lab page carries this. Review surfaces are never indexed. */
export const ANALYTICS_LAB_ROBOTS = {
  index: false,
  follow: false,
  nocache: true,
} as const;
