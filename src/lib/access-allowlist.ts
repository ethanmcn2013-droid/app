/**
 * Closed-beta access allowlist.
 *
 * Signal Studio is invite-only right now: the general public must not be able
 * to create an account or reach the real product screens. Access is granted two
 * ways, belt-and-braces (operator decision 2026-07-04):
 *   1. Clerk sign-up mode is Restricted (no public sign-ups) — dashboard config.
 *   2. This code allowlist gates /app: only approved emails get in.
 *
 * Source of truth for the allowlist is the SIGNAL_ALLOWLIST env var, a
 * comma/space/newline-separated list of email addresses, shared across the four
 * product Vercel projects. The founder is hardcoded-allowed so a missing or
 * empty allowlist can NEVER lock the operator out.
 *
 * This file is copied byte-identical across the four product repos.
 */

// Always allowed, regardless of env. The operator can never be locked out.
const ALWAYS_ALLOW: readonly string[] = ["ethanmcn2013@gmail.com"];

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** The current allowlist: the founder plus everything in SIGNAL_ALLOWLIST. */
export function allowlist(): Set<string> {
  const set = new Set<string>(ALWAYS_ALLOW.map(normalize));
  const raw = process.env.SIGNAL_ALLOWLIST ?? "";
  for (const part of raw.split(/[,\s]+/)) {
    const e = normalize(part);
    if (e) set.add(e);
  }
  return set;
}

/**
 * Whether an email may reach /app. Fail closed: no email, or an email not on
 * the list, is denied. The founder always passes.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowlist().has(normalize(email));
}
