import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildChildEnvironment, buildReceipt, resetRunOutput } from "./run.mjs";

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
  }, {
    creatorEmail: "creator+clerk_test@example.test",
    recipientEmail: "recipient+clerk_test@example.test",
    port: 4389,
    baseURL: "http://127.0.0.1:4389",
    sourceRevision: "0000000000000000000000000000000000000000",
  }, {
    PATH: "safe-path",
    GITHUB_TOKEN: "must-not-cross",
    RESEND_API_KEY: "must-not-cross",
    TURSO_AUTH_TOKEN: "must-not-cross",
  });
  assert.equal(child.PATH, "safe-path");
  assert.equal(child.CLERK_SECRET_KEY, declaredSecret);
  assert.equal(child.SIGNAL_RECIPIENT_SOURCE_REVISION, "0000000000000000000000000000000000000000");
  assert.equal(child.GITHUB_TOKEN, undefined);
  assert.equal(child.RESEND_API_KEY, undefined);
  assert.equal(child.TURSO_AUTH_TOKEN, undefined);
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
});
