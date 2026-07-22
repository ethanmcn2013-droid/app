import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isDemoMode, getAccessMode } from "@/lib/access-mode";
import { devFallbackEligible } from "./signal-auth-policy";

/**
 * Signal module server auth helpers.
 *
 * Mirrors src/modules/timeline/server/auth.ts (notes-auth.ts pattern).
 * Demo bypass: resolves to DEMO_USER_ID (same value used in the source
 * signal.git repo — "demo-user", the identity mock-source is keyed on).
 * Keyless-dev fallback: "david" — same as host app and other modules.
 */

export const DEMO_USER_ID = "demo-user";

export class UnauthorizedError extends Error {
  override readonly name = "UnauthorizedError";
  constructor(message = "Not authenticated") {
    super(message);
  }
}

function clerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}

const DEV_FALLBACK_USER = "david";

export async function requireSignalUser(): Promise<string> {
  if (isDemoMode()) return DEMO_USER_ID;

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

export async function requireSignalUserOrRedirect(): Promise<string> {
  try {
    return await requireSignalUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in");
    throw err;
  }
}

/** For surfaces that need the Clerk user object (name/email display). */
export async function getCurrentSignalUser() {
  if (isDemoMode()) return null;
  return currentUser();
}
