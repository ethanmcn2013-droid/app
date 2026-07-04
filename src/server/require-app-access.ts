import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isEmailAllowed } from "@/lib/access-allowlist";
import { isProductionMode } from "@/lib/access-mode";

/**
 * Closed-beta gate for /app. Only allowlisted accounts reach the real product;
 * everyone else is sent to /waitlist (they keep their session, they just can't
 * see the product yet).
 *
 * Enforced in production mode only — demo/review/development keep their exact
 * existing posture (demo is public seed data, dev is the keyless bypass). The
 * founder is hardcoded-allowed in the allowlist, so this can never lock the
 * operator out.
 *
 * Copied byte-identical across the four product repos. Call it at the top of
 * the authed data boundary (e.g. inside the async AppShell under Suspense) so
 * no protected content renders before the redirect.
 */
export async function requireAppAccess(): Promise<void> {
  if (!isProductionMode()) return;

  const user = await currentUser();
  const email = user
    ? (user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null)
    : null;

  if (!isEmailAllowed(email)) {
    redirect("/waitlist");
  }
}
