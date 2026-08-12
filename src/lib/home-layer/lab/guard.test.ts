/**
 * The guard, executed.
 *
 * `policy.test.ts` proves the rule. This file proves the guard applies it and
 * that its refusal is a 404 and never anything else. The real `guard.ts` runs
 * here; only three module specifiers are swapped — `server-only`,
 * `next/navigation` and `@clerk/nextjs/server` — because none of them can
 * resolve outside a Next request. `@/lib/access-mode` and `./policy` are the
 * genuine modules.
 *
 * The `next/navigation` stand-in throws loudly from `redirect()` and
 * `forbidden()`, so a guard that ever chose either instead of `notFound()`
 * fails these tests with that exact message.
 *
 * Run:
 *   node --import tsx \
 *        --import ./src/lib/home-layer/lab/testing/register-lab-stubs.mjs \
 *        --test src/lib/home-layer/lab/guard.test.ts
 */

import { strict as assert } from "node:assert";
import test, { afterEach, beforeEach } from "node:test";
import { LAB_FLAG_ENV, LAB_REVIEWERS_ENV } from "./policy";
import { labAccessDecisionForRequest, requireLabReviewer } from "./guard";

const NOT_FOUND_MARKER = "LAB_GUARD_NOT_FOUND";
const REVIEWER = "reviewer@example.com";
const STRANGER = "someone-else@example.com";

type StubEmail = {
  id: string;
  emailAddress: string;
  verification: { status: string } | null;
};

type StubUser = {
  primaryEmailAddressId: string | null;
  emailAddresses: StubEmail[];
};

const testGlobal = globalThis as unknown as Record<string, unknown>;

/** Drive the stubbed `currentUser()`. */
function signIn(user: StubUser | null | "throws") {
  testGlobal.__labTestClerkUser = user;
}

/** A signed-in user with one verified primary address. */
function verifiedUser(emailAddress: string): StubUser {
  return {
    primaryEmailAddressId: "idn_primary",
    emailAddresses: [
      { id: "idn_primary", emailAddress, verification: { status: "verified" } },
    ],
  };
}

const ENV_KEYS = [
  LAB_FLAG_ENV,
  LAB_REVIEWERS_ENV,
  "NODE_ENV",
  "SIGNAL_ACCESS_MODE",
  "NEXT_PUBLIC_SIGNAL_ACCESS_MODE",
  "NEXT_PUBLIC_DEMO_MODE",
  "DEMO_MODE",
  "NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV",
] as const;

/**
 * `@types/node` declares NODE_ENV readonly, and these tests must be able to
 * move it: the whole point is that this flag does not care what environment it
 * is in. One narrow cast, in one place.
 */
const env = process.env as unknown as Record<string, string | undefined>;

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, env[key]]));
  for (const key of ENV_KEYS) delete env[key];
  // A real, non-seed access posture unless a test says otherwise.
  env.SIGNAL_ACCESS_MODE = "production";
  env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV = "production";
  signIn(null);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
  delete testGlobal.__labTestClerkUser;
});

/** Assert the guard refused, and refused with a 404 specifically. */
async function assertNotFound(message: string) {
  await assert.rejects(
    requireLabReviewer(),
    (error: Error) => {
      assert.equal(
        error.message,
        NOT_FOUND_MARKER,
        `${message} — expected notFound(), got: ${error.message}`,
      );
      return true;
    },
    message,
  );
}

// ── Objective 1: flag off means absent ──────────────────────────────────────

test("flag unset: the route is absent, even for a listed reviewer", async () => {
  process.env[LAB_REVIEWERS_ENV] = REVIEWER;
  signIn(verifiedUser(REVIEWER));
  assert.equal(await labAccessDecisionForRequest(), "flag-off");
  await assertNotFound("an unset flag must render the route absent");
});

test("flag explicitly false: still absent", async () => {
  process.env[LAB_FLAG_ENV] = "false";
  process.env[LAB_REVIEWERS_ENV] = REVIEWER;
  signIn(verifiedUser(REVIEWER));
  await assertNotFound("an explicit false must render the route absent");
});

test("flag off resolves no identity at all", async () => {
  // Cheap, but it is also the safety property: with the lab closed the guard
  // must not be reachable through the auth layer, so a Clerk failure cannot
  // turn a closed lab into a 500.
  process.env[LAB_FLAG_ENV] = "0";
  signIn("throws");
  assert.equal(await labAccessDecisionForRequest(), "flag-off");
});

// ── Objective 2: only a reviewer, and everyone else gets 404 ────────────────

test("flag on, signed out: 404, never a redirect to sign-in", async () => {
  process.env[LAB_FLAG_ENV] = "true";
  process.env[LAB_REVIEWERS_ENV] = REVIEWER;
  signIn(null);
  assert.equal(await labAccessDecisionForRequest(), "not-authenticated");
  await assertNotFound("a signed-out visitor must get 404, not /sign-in");
});

test("THE NEGATIVE CASE: authenticated non-reviewer gets 404, not 403", async () => {
  process.env[LAB_FLAG_ENV] = "true";
  process.env[LAB_REVIEWERS_ENV] = REVIEWER;
  signIn(verifiedUser(STRANGER));
  assert.equal(await labAccessDecisionForRequest(), "not-a-reviewer");
  await assertNotFound("an authenticated non-reviewer must get 404, not 403");
});

test("an unverified primary email is not an identity", async () => {
  process.env[LAB_FLAG_ENV] = "true";
  process.env[LAB_REVIEWERS_ENV] = REVIEWER;
  signIn({
    primaryEmailAddressId: "idn_primary",
    emailAddresses: [
      { id: "idn_primary", emailAddress: REVIEWER, verification: { status: "unverified" } },
    ],
  });
  await assertNotFound("an unverified address must not pass the allowlist");
});

test("a secondary address on the list does not admit its owner", async () => {
  // Only the primary address is consulted. Otherwise anyone able to add an
  // address to their own Clerk account could self-admit.
  process.env[LAB_FLAG_ENV] = "true";
  process.env[LAB_REVIEWERS_ENV] = REVIEWER;
  signIn({
    primaryEmailAddressId: "idn_primary",
    emailAddresses: [
      { id: "idn_primary", emailAddress: STRANGER, verification: { status: "verified" } },
      { id: "idn_second", emailAddress: REVIEWER, verification: { status: "verified" } },
    ],
  });
  await assertNotFound("a secondary address must not admit its owner");
});

test("a Clerk failure refuses rather than throwing a 500", async () => {
  // This is the R-H10 shape: middleware did not run, so currentUser() throws.
  // The route must still answer 404 rather than surfacing an error page that
  // reveals a route is there.
  process.env[LAB_FLAG_ENV] = "true";
  process.env[LAB_REVIEWERS_ENV] = REVIEWER;
  signIn("throws");
  assert.equal(await labAccessDecisionForRequest(), "not-authenticated");
  await assertNotFound("a Clerk failure must resolve to 404");
});

// ── The seed-data posture ───────────────────────────────────────────────────

test("demo access mode refuses even a listed reviewer", async () => {
  process.env[LAB_FLAG_ENV] = "true";
  process.env[LAB_REVIEWERS_ENV] = REVIEWER;
  env.SIGNAL_ACCESS_MODE = "demo";
  delete env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV;
  env.NODE_ENV = "development";
  signIn(verifiedUser(REVIEWER));
  assert.equal(await labAccessDecisionForRequest(), "seed-data-posture");
  await assertNotFound("demo mode must not admit anyone to the lab");
});

test("review access mode refuses even a listed reviewer", async () => {
  process.env[LAB_FLAG_ENV] = "true";
  process.env[LAB_REVIEWERS_ENV] = REVIEWER;
  env.SIGNAL_ACCESS_MODE = "review";
  delete env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV;
  env.NODE_ENV = "development";
  signIn(verifiedUser(REVIEWER));
  assert.equal(await labAccessDecisionForRequest(), "seed-data-posture");
  await assertNotFound("review mode must not admit anyone to the lab");
});

// ── The one path that opens ─────────────────────────────────────────────────

test("a listed, verified, authenticated reviewer is admitted", async () => {
  process.env[LAB_FLAG_ENV] = "true";
  process.env[LAB_REVIEWERS_ENV] = `other@example.com, ${REVIEWER}`;
  signIn(verifiedUser(REVIEWER.toUpperCase()));
  assert.equal(await labAccessDecisionForRequest(), "granted");
  await assert.doesNotReject(requireLabReviewer());
});
