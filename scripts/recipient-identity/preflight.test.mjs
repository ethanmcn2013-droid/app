import assert from "node:assert/strict";
import test from "node:test";
import { buildPublishableKey } from "@clerk/shared/keys";
import {
  configurationReport,
  mergeDedicatedEnv,
  validateDeploymentConfig,
  validateRecipientIdentityEnv,
} from "./preflight.mjs";

const instance = "steady-otter-42.clerk.accounts.dev";
const developmentSecret = "sk_test_short-sentinel";
const productionSecret = "sk_live_not-a-key";

function valid(overrides = {}) {
  return {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: buildPublishableKey(instance),
    CLERK_SECRET_KEY: developmentSecret,
    SIGNAL_RECIPIENT_CLERK_INSTANCE: instance,
    SIGNAL_RECIPIENT_CLERK_SECRET_INSTANCE: instance,
    SIGNAL_RECIPIENT_CREATOR_EMAIL: "creator+clerk_test@example.test",
    SIGNAL_RECIPIENT_RECIPIENT_EMAIL: "recipient+clerk_test@example.test",
    SIGNAL_RECIPIENT_ACCOUNTS_VERIFIED: "confirmed",
    SIGNAL_RECIPIENT_GIT_DEPLOYMENTS_DISABLED: "confirmed",
    ...overrides,
  };
}

const noFiles = () => false;

test("accepts one declared development instance and two controlled local-only accounts", () => {
  const result = validateRecipientIdentityEnv(valid(), { cwd: "/proof", exists: noFiles });
  assert.equal(result.clerkInstance, instance);
  assert.equal(result.baseURL, "http://localhost:4389");
  assert.deepEqual(configurationReport(result), {
    ok: true,
    scope: "configuration only; provider not contacted",
    target: "declared local Clerk development-instance target",
    accountLabels: "two declared labels; accounts and sessions unverified",
    secretKeyInstance: "operator assertion only; usable pairing is observed later through ticket consumption and verified-user readback",
    port: 4389,
    nonClerkProviders: "excluded from the later child process",
    databases: "not created or inspected; the runner creates fresh local files after this preflight",
  });
});

test("refuses live, mixed-instance and unconfirmed account settings", () => {
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ CLERK_SECRET_KEY: productionSecret }), { exists: noFiles }),
    /development instance/,
  );
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ SIGNAL_RECIPIENT_CLERK_SECRET_INSTANCE: "other.clerk.accounts.dev" }), { exists: noFiles }),
    /instance label/,
  );
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ SIGNAL_RECIPIENT_ACCOUNTS_VERIFIED: "pending" }), { exists: noFiles }),
    /recorded as verified/,
  );
});

test("refuses remote databases, provider credentials and production targets", () => {
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ TASKS_DATABASE_URL: "libsql://production.example" }), { exists: noFiles }),
    /remote database/,
  );
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ RESEND_API_KEY: "configured" }), { exists: noFiles }),
    /must be unset/,
  );
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ VERCEL_ENV: "production" }), { exists: noFiles }),
    /Production Vercel/,
  );
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ VERCEL: "1" }), { exists: noFiles }),
    /Vercel runtime/,
  );
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ NODE_ENV: "production" }), { exists: noFiles }),
    /normal local shell/,
  );
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ NEXT_PUBLIC_SITE_URL: "https://example.test" }), { exists: noFiles }),
    /loopback HTTP/,
  );
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ TASKS_AUTH_TOKEN: "configured" }), { exists: noFiles }),
    /must be unset/,
  );
});

test("refuses account reuse, non-test mailboxes and undeclared deployment state", () => {
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ SIGNAL_RECIPIENT_RECIPIENT_EMAIL: "creator+clerk_test@example.test" }), { exists: noFiles }),
    /different controlled accounts/,
  );
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ SIGNAL_RECIPIENT_RECIPIENT_EMAIL: "recipient@example.test" }), { exists: noFiles }),
    /\+clerk_test/,
  );
  assert.throws(
    () => validateRecipientIdentityEnv(valid({ SIGNAL_RECIPIENT_GIT_DEPLOYMENTS_DISABLED: "pending" }), { exists: noFiles }),
    /confirmed disabled/,
  );
});

test("refuses a conflicting dedicated environment value", () => {
  assert.throws(
    () => mergeDedicatedEnv({ CLERK_SECRET_KEY: "one" }, { CLERK_SECRET_KEY: "two" }),
    /Mixed environment values/,
  );
});

test("requires the repository deployment kill switch", () => {
  assert.doesNotThrow(() => validateDeploymentConfig({
    cwd: "/proof",
    readFile: () => JSON.stringify({ git: { deploymentEnabled: false } }),
  }));
  assert.throws(() => validateDeploymentConfig({
    cwd: "/proof",
    readFile: () => JSON.stringify({ git: { deploymentEnabled: true } }),
  }), /deploymentEnabled/);
  assert.throws(() => validateDeploymentConfig({
    cwd: "/proof",
    readFile: () => "not-json",
  }), /present and valid/);
});

test("refuses mixed root environment files", () => {
  assert.throws(() => validateRecipientIdentityEnv(valid(), {
    cwd: "/proof",
    exists: (file) => file.endsWith(".env.local"),
  }), /mixed Next environment files/);
});
