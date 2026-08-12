/**
 * `@clerk/nextjs/server` stand-in for the lab-guard tests.
 *
 * The test sets `globalThis.__labTestClerkUser` to one of:
 *   null        signed out
 *   "throws"    Clerk middleware did not run for this request, which is the
 *               R-H10 situation and must resolve to refusal, not a 500
 *   an object   a signed-in user, shaped like the fields the guard reads
 */

module.exports = {
  async currentUser() {
    const configured = globalThis.__labTestClerkUser;
    if (configured === "throws") {
      throw new Error(
        "clerkMiddleware() was not run for this request (stubbed Clerk failure)",
      );
    }
    return configured ?? null;
  },
};
