import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import {
  isHomeReviewLabEnabled,
  labAccessDecision,
  type LabAccessDecision,
} from "./policy";

/**
 * The isolation guard for the Home operating-layer design lab.
 *
 * ── Why a layout guard alone could not have worked ─────────────────────────
 *
 * R-H10: `/lab` was absent from the Clerk proxy matcher, so Clerk middleware
 * never ran for it, so `auth()` / `currentUser()` inside a `/lab` route had no
 * session to read. A Server-Component guard placed there would have had no
 * identity to check and would have refused everyone, forever — including the
 * reviewer. The fix is therefore two-part and neither half is optional:
 *
 *   1. `src/proxy.ts` adds `/lab/:path*` to `config.matcher`, so Clerk runs
 *      and populates the session for these requests.
 *   2. The same file adds `/lab` and `/lab/(.*)` to `isPublicRoute`, so the
 *      proxy does NOT call `auth.protect()` there. That matters twice over:
 *      it keeps the six pre-existing lab mockups anonymously reachable exactly
 *      as they were, and it stops a signed-out visitor to this route family
 *      being 307'd to /sign-in — a redirect is a confirmation that the route
 *      exists, and this route family must not confirm that.
 *   3. This guard is the whole of the access decision. The proxy opens the
 *      door to the session; the guard decides, and its only refusal is 404.
 *
 * ── One refusal, always the same one ───────────────────────────────────────
 *
 * Flag off, seed-data posture, signed out, signed in but not a reviewer: all
 * four render the identical `notFound()`. Never a redirect, never a 403,
 * never an explanatory page. A 403 tells an authenticated non-reviewer that
 * there is something here to be refused; a 404 tells them nothing. The lab
 * renders permission-limited, partial and guest-limited fixture states, and
 * the existence of that surface is itself part of what is being withheld.
 *
 * ── The seed-data refusal ──────────────────────────────────────────────────
 *
 * demo and review access modes bypass Clerk in the proxy and run on a
 * synthetic identity (`lib/access-mode.ts`). There is no real reviewer to
 * check in those modes, so the guard refuses outright rather than trusting a
 * synthetic user. Consequence, recorded rather than hidden: a preview that
 * defaults to review mode cannot show this lab. The protected preview has to
 * run the production access posture with real Clerk keys. That is the price
 * of the guard being real.
 */

/**
 * The signed-in reviewer's verified primary email, or null.
 *
 * Every failure path returns null. `currentUser()` throws when Clerk
 * middleware did not run for the request (which is precisely the situation
 * R-H10 describes), and a thrown auth call must resolve to refusal, not to a
 * 500 that leaks a stack trace about a route that is supposed to be absent.
 */
async function reviewerEmail(): Promise<string | null> {
  try {
    const user = await currentUser();
    if (!user) return null;
    const primary = user.emailAddresses.find(
      (address) => address.id === user.primaryEmailAddressId,
    );
    if (!primary) return null;
    // Verified only. An unverified address is an unproven claim about who is
    // asking, and this list is small enough that the stricter rule costs
    // nothing.
    if (primary.verification?.status !== "verified") return null;
    return primary.emailAddress ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the access decision without acting on it. Exported for the contract
 * document and for tests; route code should call `requireLabReviewer()`.
 */
export async function labAccessDecisionForRequest(): Promise<LabAccessDecision> {
  // Flag first: when the lab is closed, no identity is resolved at all.
  if (!isHomeReviewLabEnabled()) return "flag-off";
  if (isDemoMode()) return "seed-data-posture";
  return labAccessDecision({
    flagEnabled: true,
    seedDataPosture: false,
    email: await reviewerEmail(),
  });
}

/**
 * Await this at the top of every protected-lab layout. Returns only for a
 * reviewer; every other caller gets a genuine 404 and learns nothing else.
 */
export async function requireLabReviewer(): Promise<void> {
  if ((await labAccessDecisionForRequest()) !== "granted") {
    notFound();
  }
}
