import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  clerkAuthorizedParties,
  RECIPIENT_IDENTITY_PROOF_MARKER,
  SPRINT_PREVIEW_AUTH_MARKER,
  sprintPreviewAuthorizedPartiesForTargets,
} from "./recipient-proof-authorized-parties";

const production = [
  "https://app.signalstudio.ie",
  "https://tasks.signalstudio.ie",
];
const previewOrigin = "https://signal-studio-sprint-ethanmcn2013-1730s-projects.vercel.app";
const stores = ["TASKS", "NOTES", "TIMELINE", "SIGNAL", "ENTITLEMENTS"] as const;

function syntheticPreview(overrides: Record<string, string | undefined> = {}) {
  const targets = Object.fromEntries(stores.map((store) => {
    const url = `libsql://synthetic-${store.toLowerCase()}.invalid`;
    return [store, { url, hash: createHash("sha256").update(url).digest("hex") }];
  })) as Record<(typeof stores)[number], { url: string; hash: string }>;
  const hashes = Object.fromEntries(stores.map((store) => [store, targets[store].hash])) as Record<(typeof stores)[number], string>;
  const env: Record<string, string | undefined> = {
    SIGNAL_SPRINT_PREVIEW_AUTH: SPRINT_PREVIEW_AUTH_MARKER,
    VERCEL: "1", VERCEL_ENV: "preview", NODE_ENV: "production",
    NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: "preview", NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production",
    SIGNAL_ACCESS_MODE: "production",
    NEXT_PUBLIC_SITE_URL: previewOrigin, NEXT_PUBLIC_APP_URL: previewOrigin,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic", CLERK_SECRET_KEY: "sk_test_synthetic",
    SIGNAL_CONVERSATION_DATABASE_MODE: "remote", SIGNAL_CONVERSATION_REMOTE_ENABLED: "true",
    SIGNAL_CONVERSATION_REMOTE_TARGET: "tasks-preview",
    SIGNAL_CONVERSATION_REMOTE_URL_SHA256: hashes.TASKS,
  };
  for (const store of stores) {
    env[`${store}_DATABASE_URL`] = targets[store].url;
    env[`${store}_AUTH_TOKEN`] = "synthetic-token";
  }
  return { env: { ...env, ...overrides }, hashes };
}

test("marked sprint preview admits only the nominated origin with five pinned synthetic stores", () => {
  const { env, hashes } = syntheticPreview();
  assert.deepEqual(sprintPreviewAuthorizedPartiesForTargets(env, hashes), [...production, previewOrigin]);
  assert.deepEqual(clerkAuthorizedParties({ ...env, SIGNAL_SPRINT_PREVIEW_AUTH: undefined }), production);
  // The production helper cannot be satisfied with synthetic database URLs.
  assert.throws(() => clerkAuthorizedParties(env), /verified isolated Tasks mode/);
});

test("sprint preview marker rejects wrong deployment, origin, keys, mode and outbound mail", () => {
  const denied = [
    { SIGNAL_SPRINT_PREVIEW_AUTH: "true" },
    { SIGNAL_RECIPIENT_IDENTITY_PROOF: RECIPIENT_IDENTITY_PROOF_MARKER },
    { VERCEL: undefined }, { VERCEL_ENV: "production" }, { NODE_ENV: "development" },
    { NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: "production" },
    { NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "review" },
    { SIGNAL_ACCESS_MODE: undefined }, { SIGNAL_ACCESS_MODE: "review" },
    { SIGNAL_ACCESS_MODE: "demo" },
    { NEXT_PUBLIC_SITE_URL: "https://other.vercel.app" },
    { NEXT_PUBLIC_APP_URL: "https://tasks.signalstudio.ie" },
    { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_synthetic" },
    { CLERK_SECRET_KEY: "sk_live_synthetic" },
    { RESEND_API_KEY: "synthetic-key" },
    { SIGNAL_CONVERSATION_DATABASE_MODE: "local" },
    { SIGNAL_CONVERSATION_REMOTE_ENABLED: undefined },
    { SIGNAL_CONVERSATION_REMOTE_TARGET: "production" },
    { SIGNAL_CONVERSATION_REMOTE_URL_SHA256: "0".repeat(64) },
  ];
  for (const override of denied) {
    const { env, hashes } = syntheticPreview(override);
    assert.throws(() => sprintPreviewAuthorizedPartiesForTargets(env, hashes), { name: "Error" }, JSON.stringify(override));
  }
});

test("sprint preview rejects a mixed, missing or unauthenticated store for each of five bindings", () => {
  for (const store of stores) {
    for (const override of [
      { [`${store}_DATABASE_URL`]: "libsql://wrong.invalid" },
      { [`${store}_DATABASE_URL`]: undefined },
      { [`${store}_AUTH_TOKEN`]: undefined },
      { [`${store}_AUTH_TOKEN`]: " " },
    ]) {
      const { env, hashes } = syntheticPreview(override);
      assert.throws(() => sprintPreviewAuthorizedPartiesForTargets(env, hashes),
        new RegExp(`verified isolated ${store} store`));
    }
  }
});

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
