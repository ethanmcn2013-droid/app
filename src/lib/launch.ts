/**
 * launch.ts, the single source of truth for whether Signal Studio has opened
 * to the public. One central layer; never scatter ad-hoc date comparisons or
 * `Sign in` labels across the codebase.
 *
 * Copied byte-identical into studio/src/lib/launch.ts. Keep them in sync.
 *
 * ── The rule ──────────────────────────────────────────────────────────
 *
 * Before launch, Signal Studio is invite-only. Every public call to action
 * points at the waitlist, never at /sign-in or /sign-up: a marketing button
 * that offers sign-in is a false door, because requireAppAccess() bounces
 * anyone off the allowlist straight back to /waitlist. That rule is already
 * executable in scripts/check-marketing-waitlist-contract.mjs; this module is
 * where the *date* and the *labels* live so the flip is one decision.
 *
 * The auth routes themselves stay live and working the whole time. They are
 * simply unlinked and noindexed until launch, so the allowlist (the founder,
 * pilot accounts) can sign in while the public sees the waitlist. "Not
 * viewable" means not promoted and not indexed, not switched off; taking the
 * routes down would lock the operator out of the product.
 *
 * ── Resolution ────────────────────────────────────────────────────────
 *
 *   1. NEXT_PUBLIC_SIGNAL_LAUNCH_STATE=open|pre, explicit, wins.
 *   2. Otherwise remain in pre-launch. The readiness review date is a planning
 *      milestone, never an automatic public-access switch.
 *
 * ── Known limitation, read before relying on the date ──────────────────
 *
 * Statically rendered pages bake this decision at BUILD time. Opening the
 * suite therefore requires an explicit environment change and deploy after a
 * founder go/no-go decision; no date comparison can open it by accident.
 */

/** 2026-09-01, 00:00 UTC. Readiness-review milestone; not an opening trigger. */
export const LAUNCH_AT = Date.parse("2026-09-01T00:00:00Z");

export type LaunchState = "pre" | "open";

function override(): LaunchState | null {
  const raw = (
    process.env.NEXT_PUBLIC_SIGNAL_LAUNCH_STATE ??
    process.env.SIGNAL_LAUNCH_STATE ??
    ""
  )
    .toLowerCase()
    .trim();
  return raw === "open" || raw === "pre" ? raw : null;
}

export function launchState(now: number = Date.now()): LaunchState {
  void now;
  return override() ?? "pre";
}

/** True while the suite is invite-only and every public CTA is the waitlist. */
export function isPreLaunch(now?: number): boolean {
  return launchState(now) === "pre";
}

/* ── Canonical destinations ─────────────────────────────────────────── */

/**
 * The public waitlist lives on the marketing origin. This app's own
 * /waitlist is the holding page a bounced account lands on, not the
 * public sign-up surface, so a marketing CTA must use the absolute URL.
 */
export const PUBLIC_WAITLIST_URL = "https://signalstudio.ie/waitlist";

/** The in-app holding page requireAppAccess() redirects to. */
export const WAITLIST_PATH = "/waitlist";

/* ── Canonical labels ───────────────────────────────────────────────── */

/**
 * The label is enforced elsewhere as the exact string "Join the waitlist"
 * (check-marketing-waitlist-contract.mjs asserts it on every product header),
 * so it is defined once here and referenced, never retyped.
 */
export const WAITLIST_CTA_LABEL = "Join the waitlist";

export interface AuthCta {
  label: string;
  href: string;
  /** True when the destination is off this origin. */
  external: boolean;
}

/**
 * The primary public call to action. Waitlist before launch, sign in after.
 * Use this for any button a signed-out visitor can see on a marketing
 * surface. Do not hand-roll the decision at the call site.
 */
export function primaryAuthCta(now?: number): AuthCta {
  return isPreLaunch(now)
    ? { label: WAITLIST_CTA_LABEL, href: PUBLIC_WAITLIST_URL, external: true }
    : { label: "Sign in", href: "/sign-in", external: false };
}

/**
 * The secondary "no account yet" call to action, shown on the auth pages
 * themselves. Pre-launch there is nothing to create, so it points at the
 * waitlist too.
 */
export function createAccountCta(now?: number): AuthCta {
  return isPreLaunch(now)
    ? { label: WAITLIST_CTA_LABEL, href: PUBLIC_WAITLIST_URL, external: true }
    : { label: "Create an account", href: "/sign-up", external: false };
}

/**
 * Search-engine posture for the auth routes. They are real, working pages
 * that simply must not be discoverable before the suite opens.
 */
export function authRouteRobots(now?: number) {
  return isPreLaunch(now)
    ? { index: false, follow: false }
    : { index: true, follow: true };
}
