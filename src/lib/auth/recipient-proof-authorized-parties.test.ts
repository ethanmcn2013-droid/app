import assert from "node:assert/strict";
import test from "node:test";
import {
  clerkAuthorizedParties,
  RECIPIENT_IDENTITY_PROOF_MARKER,
} from "./recipient-proof-authorized-parties";

const production = [
  "https://app.signalstudio.ie",
  "https://tasks.signalstudio.ie",
];

function valid(overrides: Record<string, string | undefined> = {}) {
  return {
    SIGNAL_RECIPIENT_IDENTITY_PROOF: RECIPIENT_IDENTITY_PROOF_MARKER,
    SIGNAL_RECIPIENT_PROOF_ORIGIN: "http://localhost:4389",
    SIGNAL_RECIPIENT_PORT: "4389",
    NEXT_PUBLIC_SITE_URL: "http://localhost:4389",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_",
    VERCEL_ENV: "development",
    ...overrides,
  };
}

test("unmarked and Vercel runtimes retain the exact production parties", () => {
  assert.deepEqual(clerkAuthorizedParties({}), production);
  assert.deepEqual(
    clerkAuthorizedParties(valid({ VERCEL: "1" })),
    production,
  );
});

test("the marked local proof appends only its canonical localhost origin", () => {
  assert.deepEqual(clerkAuthorizedParties(valid()), [
    ...production,
    "http://localhost:4389",
  ]);
});

test("marked proof mode rejects an invalid deployment class or Clerk key", () => {
  assert.throws(
    () => clerkAuthorizedParties(valid({ VERCEL_ENV: "preview" })),
    /development deployment class/,
  );
  assert.throws(
    () =>
      clerkAuthorizedParties({
        ...valid(),
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_not-a-key",
      }),
    /development publishable key/,
  );
});

test("marked proof mode rejects malformed or mismatched origins", () => {
  for (const origin of [
    "http://127.0.0.1:4389",
    "https://localhost:4389",
    "http://user@localhost:4389",
    "http://localhost:4389/path",
    "http://localhost:4389?query=1",
    "http://localhost:4389#fragment",
    "http://localhost:4390",
  ]) {
    assert.throws(
      () =>
        clerkAuthorizedParties(
          valid({ SIGNAL_RECIPIENT_PROOF_ORIGIN: origin }),
        ),
      /canonical localhost root/,
    );
  }
  assert.throws(
    () =>
      clerkAuthorizedParties(
        valid({ NEXT_PUBLIC_SITE_URL: "http://localhost:4390" }),
      ),
    /site URL must match/,
  );
});

test("marked proof mode rejects an invalid or non-canonical port", () => {
  for (const port of ["", "04389", "80", "65536", "not-a-port"]) {
    assert.throws(
      () => clerkAuthorizedParties(valid({ SIGNAL_RECIPIENT_PORT: port })),
      /port is invalid/,
    );
  }
});
