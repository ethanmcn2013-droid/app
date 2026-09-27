import assert from "node:assert/strict";
import test from "node:test";
import { previewReliabilityAttestation } from "./preview-reliability-attestation";

const now = Date.UTC(2026, 8, 27);
const token = "a".repeat(43);
const environment = { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview", NODE_ENV: "production",
  SIGNAL_RELIABILITY_ATTEST: "isolated-reliability-v1", SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(now + 3600000),
  SIGNAL_RELIABILITY_ATTEST_TOKEN: token, SIGNAL_RELIABILITY_ORIGIN: "https://isolated.example.test",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic", CLERK_SECRET_KEY: "sk_test_synthetic",
  VERCEL_DEPLOYMENT_ID: "dpl_synthetic", VERCEL_PROJECT_ID: "prj_synthetic", VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
  TASKS_DATABASE_URL: "libsql://synthetic-tasks", NOTES_DATABASE_URL: "libsql://synthetic-notes",
  TIMELINE_DATABASE_URL: "libsql://synthetic-timeline", SIGNAL_DATABASE_URL: "libsql://synthetic-signal",
  ENTITLEMENTS_DATABASE_URL: "libsql://synthetic-entitlements" };
const request = (origin = environment.SIGNAL_RELIABILITY_ORIGIN, authorization = `Bearer ${token}`) => new Request(origin + "/api/internal/reliability-target", { headers: { authorization } });
test("preview proof is content-free and hashes actual runtime bindings", async () => {
  const response = previewReliabilityAttestation(request(), environment, now);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(Object.keys(body.stores).length, 5);
  assert.equal(body.externalDeliveryDisabled, true);
  assert.doesNotMatch(JSON.stringify(body), /libsql:|sk_test_|pk_test_/);
  assert.match(response.headers.get("Cache-Control")!, /no-store/);
});
test("production, expired, incomplete, provider-enabled or mismatched previews stay hidden", () => {
  for (const patch of [{VERCEL_ENV:"production"},{VERCEL_TARGET_ENV:"production"},{SIGNAL_RELIABILITY_ATTEST:""},
    {SIGNAL_RELIABILITY_ATTEST_UNTIL_MS:String(now)},{SIGNAL_RELIABILITY_ATTEST_UNTIL_MS:String(now+7*3600000)},
    {CLERK_SECRET_KEY:"sk_live_synthetic"},{TASKS_DATABASE_URL:""},{RESEND_API_KEY:"synthetic"},
    {BLOB_READ_WRITE_TOKEN:"synthetic"},{GOOGLE_OAUTH_CLIENT_SECRET:"synthetic"},{VERCEL_GIT_COMMIT_SHA:"unknown"},
    {NOTES_TO_TASKS_SECRET:"synthetic"},{NOTES_TO_TIMELINE_SECRET:"synthetic"},{STUDIO_CRON_PING_SECRET:"synthetic"}]) {
    assert.equal(previewReliabilityAttestation(request(), {...environment,...patch}, now).status, 404);
  }
  for (const invalid of [request("https://other.example.test"),request(undefined,""),request(undefined,"Bearer " + "b".repeat(43)),request(undefined,token)])
    assert.equal(previewReliabilityAttestation(invalid, environment, now).status, 404);
});
