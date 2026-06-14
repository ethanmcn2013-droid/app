/**
 * access-mode.ts — the single source of truth for *how* Signal Studio is
 * being accessed right now. One central layer; never scatter ad-hoc
 * `process.env.X === "true"` auth-bypass checks across the codebase.
 *
 * Four modes (suite-wide canonical — identical shape in every product repo):
 *
 *   production   — real Clerk auth required, real user data, normal security.
 *   development  — local developer access; existing keyless dev bypass applies.
 *   demo         — public, no login wall; a synthetic demo user bound to
 *                  in-memory seed data. The real database is NEVER queried.
 *   review       — same access posture as demo, but signals an internal
 *                  design/Claude-Code/Fable review context (used for the
 *                  /review hub + slightly louder dev messaging).
 *
 * Resolution (server can read both vars; the browser only sees NEXT_PUBLIC_*):
 *   1. SIGNAL_ACCESS_MODE / NEXT_PUBLIC_SIGNAL_ACCESS_MODE — explicit, wins.
 *   2. NEXT_PUBLIC_DEMO_MODE=true (legacy/ergonomic alias) → "demo".
 *   3. Fallback: "production" when NODE_ENV==="production", else "development".
 *
 * SAFETY INVARIANT (load-bearing): demo/review never unlock the real DB. The
 * auth layer swaps in DEMO_USER_ID and the data layer short-circuits to seed
 * data, so even if the flag is mis-deployed to a production build there is no
 * real tenant data reachable to leak. Turning the flag off restores the exact
 * production auth path with zero code changes.
 */

export type AccessMode = "production" | "development" | "demo" | "review";

const VALID = new Set<AccessMode>([
  "production",
  "development",
  "demo",
  "review",
]);

function readRawMode(): AccessMode | null {
  const raw = (
    process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE ??
    process.env.SIGNAL_ACCESS_MODE ??
    ""
  )
    .toLowerCase()
    .trim();
  return VALID.has(raw as AccessMode) ? (raw as AccessMode) : null;
}

export function getAccessMode(): AccessMode {
  const explicit = readRawMode();
  if (explicit) return explicit;

  const legacyDemo =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "true";
  if (legacyDemo) return "demo";

  return process.env.NODE_ENV === "production" ? "production" : "development";
}

/** demo OR review — i.e. the public, seed-data, no-login-wall posture. */
export function isDemoMode(): boolean {
  const m = getAccessMode();
  return m === "demo" || m === "review";
}

export function isReviewMode(): boolean {
  return getAccessMode() === "review";
}

export function isProductionMode(): boolean {
  return getAccessMode() === "production";
}

/**
 * True when the production Clerk gate must be enforced unconditionally.
 * Demo/review skip the gate; development keeps the historical keyless
 * behaviour (the proxy's own `clerkConfigured` check still applies there).
 */
export function authGateEnforced(): boolean {
  return getAccessMode() === "production";
}

/** Whether the non-production "In development" banner should render. */
export function showDevBanner(): boolean {
  return getAccessMode() !== "production";
}

/**
 * A syntactically valid but inert Clerk publishable key. Used only in
 * demo/review when no real key is configured, so ClerkProvider can mount and
 * the app renders keylessly on a preview deploy. No real Clerk backend is
 * contacted on the demo path (the proxy and server auth layer short-circuit
 * before any Clerk call), so this never reaches a network round-trip server-side.
 */
export const DEMO_CLERK_PUBLISHABLE_KEY =
  "pk_test_ZGVtby1zaWduYWwuY2xlcmsuYWNjb3VudHMuZGV2JA==";

/**
 * The publishable key to hand ClerkProvider:
 *   - the real key when configured (production + normal demo deploys);
 *   - the inert placeholder in demo/review when none is set (keyless preview);
 *   - undefined in production when unset — ClerkProvider then fails closed,
 *     which is the correct, loud behaviour.
 */
export function clerkPublishableKey(): string | undefined {
  const real = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (real) return real;
  if (isDemoMode()) return DEMO_CLERK_PUBLISHABLE_KEY;
  return undefined;
}

/** Human-readable label for the current mode (banner / debug surfaces). */
export function accessModeLabel(): string {
  switch (getAccessMode()) {
    case "production":
      return "Production";
    case "development":
      return "Development";
    case "demo":
      return "Demo";
    case "review":
      return "Review";
  }
}
