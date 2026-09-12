import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildChildEnvironment,
  buildReceipt,
  LOCAL_DATABASE_AUTH_SENTINEL,
  RECIPIENT_IDENTITY_PROOF_MARKER,
  resetRunOutput,
} from "./run.mjs";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const { getRelativeURL } = require("next/dist/shared/lib/router/utils/relativize-url");

test("run reset invalidates stale receipt and browser output", () => {
  const allowedRoot = path.resolve("experience", "output", "recipient-identity");
  mkdirSync(allowedRoot, { recursive: true });
  const target = mkdtempSync(path.join(allowedRoot, "reset-test-"));
  writeFileSync(path.join(target, "receipt.json"), "stale");
  mkdirSync(path.join(target, "playwright"));
  writeFileSync(path.join(target, "playwright", "state"), "stale");
  resetRunOutput(target);
  assert.equal(existsSync(path.join(target, "receipt.json")), false);
  assert.equal(existsSync(path.join(target, "playwright")), false);
});

test("run reset refuses paths outside the ignored recipient root", () => {
  const outside = mkdtempSync(path.join(tmpdir(), "recipient-proof-outside-"));
  assert.throws(() => resetRunOutput(outside), /escaped/);
});

test("child process receives no arbitrary repository or provider credentials", () => {
  const declaredSecret = "sk_test_short-sentinel";
  const child = buildChildEnvironment({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_declared",
    CLERK_SECRET_KEY: declaredSecret,
    SIGNAL_RECIPIENT_CLERK_INSTANCE: "declared.clerk.accounts.dev",
    SIGNAL_RECIPIENT_CLERK_SECRET_INSTANCE: "declared.clerk.accounts.dev",
    SIGNAL_RECIPIENT_IDENTITY_PROOF: "dedicated-marker-must-not-cross",
    SIGNAL_RECIPIENT_PROOF_ORIGIN: "https://dedicated.example.test/path",
  }, {
    creatorEmail: "creator+clerk_test@example.test",
    recipientEmail: "recipient+clerk_test@example.test",
    port: 4389,
    baseURL: "http://localhost:4389",
    sourceRevision: "0000000000000000000000000000000000000000",
  }, {
    PATH: "safe-path",
    GITHUB_TOKEN: "must-not-cross",
    RESEND_API_KEY: "must-not-cross",
    TURSO_AUTH_TOKEN: "must-not-cross",
    TASKS_AUTH_TOKEN: "caller-database-secret-must-not-cross",
    NOTES_AUTH_TOKEN: "must-not-cross",
    TIMELINE_AUTH_TOKEN: "must-not-cross",
    SIGNAL_AUTH_TOKEN: "must-not-cross",
    SIGNAL_RECIPIENT_IDENTITY_PROOF: "caller-marker-must-not-cross",
    SIGNAL_RECIPIENT_PROOF_ORIGIN: "https://caller.example.test/path",
    SIGNAL_RECIPIENT_PORT: "9999",
    NEXT_PUBLIC_SITE_URL: "https://caller.example.test",
  });
  assert.equal(child.PATH, "safe-path");
  assert.equal(child.CLERK_SECRET_KEY, declaredSecret);
  assert.equal(child.SIGNAL_RECIPIENT_SOURCE_REVISION, "0000000000000000000000000000000000000000");
  assert.equal(child.GITHUB_TOKEN, undefined);
  assert.equal(child.RESEND_API_KEY, undefined);
  assert.equal(child.TURSO_AUTH_TOKEN, undefined);
  assert.equal(child.TASKS_AUTH_TOKEN, LOCAL_DATABASE_AUTH_SENTINEL);
  assert.notEqual(child.TASKS_AUTH_TOKEN, "caller-database-secret-must-not-cross");
  assert.equal(child.NOTES_AUTH_TOKEN, undefined);
  assert.equal(child.TIMELINE_AUTH_TOKEN, undefined);
  assert.equal(child.SIGNAL_AUTH_TOKEN, undefined);
  assert.equal(child.SIGNAL_RECIPIENT_IDENTITY_PROOF, RECIPIENT_IDENTITY_PROOF_MARKER);
  assert.equal(child.SIGNAL_RECIPIENT_PROOF_ORIGIN, "http://localhost:4389");
  assert.equal(child.SIGNAL_RECIPIENT_PORT, "4389");
  assert.equal(child.NEXT_PUBLIC_SITE_URL, "http://localhost:4389");
});

test("localhost keeps Clerk's absolute continuation rewrite internal to Next", () => {
  const normalized = new NextRequest("http://127.0.0.1:4389/sign-in").url;
  assert.equal(normalized, "http://localhost:4389/sign-in");
  assert.match(
    getRelativeURL(normalized, "http://127.0.0.1:4389/sign-in"),
    /^http:/,
  );
  assert.equal(
    getRelativeURL(normalized, "http://localhost:4389/sign-in"),
    "/sign-in",
  );
});

test("failed preflight receipt cannot claim an unvalidated deployment guard", () => {
  const receipt = buildReceipt({
    status: "failed",
    errorCode: "preflight_failed",
    sourceRevision: null,
    sourceTree: null,
    vercelBlob: null,
    deploymentGuardValidated: false,
    startedAt: "2026-09-12T00:00:00.000Z",
    evidence: {},
  });
  assert.deepEqual(receipt.deploymentGuard, {
    path: "vercel.json",
    validated: false,
    blob: null,
    deploymentEnabled: null,
  });
  assert.match(receipt.intendedIdentityBoundary, /setup sessions and creator restoration use Clerk's ticket helper/);
  assert.match(receipt.signInUi, /visible email-code form/);
  assert.match(receipt.signInUi, /fixed test OTP/);
  assert.match(receipt.signInUi, /real email delivery and MFA are not exercised/);
  assert.equal(receipt.providers.mail, "Clerk test mailbox only; no real email delivery");
  assert.doesNotMatch(receipt.signInUi, /credential-entry UI is not exercised/);
});

test("wrong-account diagnostics retain only boolean, enum and bounded count fields", () => {
  const receipt = buildReceipt({
    status: "failed",
    errorCode: "journey_failed",
    sourceRevision: "a".repeat(40),
    sourceTree: "b".repeat(40),
    vercelBlob: "c".repeat(40),
    deploymentGuardValidated: true,
    startedAt: "2026-09-12T00:00:00.000Z",
    evidence: {
      stages: {},
      wrongAccountDiagnostic: {
        routeClass: "invite",
        rendered: {
          serverState: "wrongVerified",
          genericError: false,
          wrongCopyVisible: true,
          switchVisible: true,
          rawText: "private page text",
        },
        browserIdentity: { signedIn: true, email: "private@example.test" },
        errors: { consoleCount: 1001, pageCount: 1, pageClass: "private error", message: "private error" },
        url: "https://private.example/invite/private-token",
        token: "private-token",
      },
    },
  });
  assert.deepEqual(receipt.wrongAccountDiagnostic, {
    routeClass: "invite",
    rendered: {
      serverState: "wrongVerified",
      genericError: false,
      clerkUi: false,
      wrongCopyVisible: true,
      unverifiedCopyVisible: false,
      switchVisible: true,
    },
    browserIdentity: {
      clerkLoaded: false,
      signedIn: true,
      primaryVerified: false,
      expectedCreator: false,
    },
    errors: { consoleCount: 999, pageCount: 1, pageClass: "other" },
  });
  const serialized = JSON.stringify(receipt);
  for (const forbidden of ["private page text", "private@example.test", "private error", "private-token", "private.example"]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});
