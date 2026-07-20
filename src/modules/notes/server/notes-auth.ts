import "server-only";

import { auth } from "@clerk/nextjs/server";
import { isDemoMode } from "@/lib/access-mode";
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
 * Server-side helper: returns the Clerk userId or throws
 * UnauthorizedError if no session.
 *
 * Server actions in /server/actions/notes.ts call this before any
 * read or write so we never accidentally leak across users.
 */
export async function requireUser(): Promise<string> {
  // Demo/Review mode: resolve to the synthetic demo identity. Callers in
  // /server/actions/notes.ts pair this with a data-layer short-circuit to
  // the in-memory seed, so the real DB is never queried for the demo user.
  if (isDemoMode()) return DEMO_USER_ID;

  const { userId } = await auth();
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}
