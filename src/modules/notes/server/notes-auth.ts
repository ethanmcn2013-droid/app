import "server-only";

import { auth } from "@clerk/nextjs/server";
import { isDemoMode, getAccessMode } from "@/lib/access-mode";
import { DEMO_USER_ID } from "@/modules/notes/server/demo/notes-demo";

/**
 * Tagged error thrown when no Clerk session is attached. Client
 * surfaces match on `name` (not message) to render a sign-in nudge
 * instead of the raw "Not authenticated" string.
 */
export class UnauthorizedError extends Error {
  override readonly name = "UnauthorizedError";
  constructor(message = "Not authenticated") {
    super(message);
  }
}

/**
 * True when both Clerk env vars are present. Replicated locally from
 * src/server/auth.ts so this module does not import across the host
 * server boundary while keeping the same keyless-dev logic in lock-step.
 */
function clerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

/**
 * The dev fallback user id — must match the host app (src/server/auth.ts
 * DEV_FALLBACK_USER) so cross-module dev flows resolve to the same identity.
 */
const DEV_FALLBACK_USER = "david";

export { devFallbackEligible } from "./notes-auth-policy";
import { devFallbackEligible } from "./notes-auth-policy";

/**
 * Server-side helper: returns the Clerk userId or throws
 * UnauthorizedError if no session.
 *
 * Server actions in /server/actions/notes.ts call this before any
 * read or write so we never accidentally leak across users.
 *
 * Keyless-dev fallback: when NODE_ENV is not production AND Clerk is not
 * configured AND the access mode is development, returns DEV_FALLBACK_USER
 * ("david") — the same identity the host app uses — so Notes dev flows work
 * without Clerk keys. Fail-closed on its own via the NODE_ENV term; see
 * devFallbackEligible.
 */
export async function requireUser(): Promise<string> {
  // Demo/Review mode: resolve to the synthetic demo identity. Callers in
  // /server/actions/notes.ts pair this with a data-layer short-circuit to
  // the in-memory seed, so the real DB is never queried for the demo user.
  if (isDemoMode()) return DEMO_USER_ID;

  // Keyless development fallback — fail-closed independent of the proxy.
  if (
    devFallbackEligible({
      nodeEnv: process.env.NODE_ENV,
      clerkConfigured: clerkConfigured(),
      accessMode: getAccessMode(),
    })
  ) {
    return DEV_FALLBACK_USER;
  }

  const { userId } = await auth();
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}
