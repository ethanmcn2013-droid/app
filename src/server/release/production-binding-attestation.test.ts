import { createHash, randomBytes } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attestProductionRuntimeBindings,
  hiddenAttestationResponse,
  PRODUCTION_BINDING_ATTESTATION_MARKER,
} from "./production-binding-attestation";
import { DELETE, GET, HEAD, OPTIONS, PATCH, PUT } from "@/app/api/internal/production-binding-attestation/route";

const now = 1_790_000_000_000;
const token = randomBytes(32).toString("base64url");
const urls = {
  TASKS_DATABASE_URL: "libsql://tasks.example.invalid",
  NOTES_DATABASE_URL: "libsql://notes.example.invalid",
  TIMELINE_DATABASE_URL: "libsql://timeline.example.invalid",
  SIGNAL_DATABASE_URL: "libsql://signal.example.invalid",
  ENTITLEMENTS_DATABASE_URL: "libsql://entitlements.example.invalid",
};
const expected = Object.fromEntries(Object.entries(urls).map(([key, url]) => [
  key, createHash("sha256").update(url).digest("hex"),
]));

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    ...urls,
    SIGNAL_PRODUCTION_BINDING_ATTESTATION: PRODUCTION_BINDING_ATTESTATION_MARKER,
    SIGNAL_PRODUCTION_BINDING_ATTESTATION_TOKEN: token,
    SIGNAL_PRODUCTION_BINDING_ATTESTATION_UNTIL_MS: String(now + 60_000),
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_TARGET_ENV: "production",
    NODE_ENV: "production",
    VERCEL_DEPLOYMENT_ID: "dpl_candidate123",
    VERCEL_PROJECT_ID: "prj_app123",
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    ...overrides,
  };
}

function request(body: unknown = expected, bearer = token): Request {
  return new Request("https://candidate.vercel.app/api/internal/production-binding-attestation", {
    method: "POST",
    headers: {
      authorization: `Bearer ${bearer}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("default-off, expired, and non-production deployments are invisible", async () => {
  for (const overrides of [
    { SIGNAL_PRODUCTION_BINDING_ATTESTATION: undefined },
    { SIGNAL_PRODUCTION_BINDING_ATTESTATION: "wrong" },
    { SIGNAL_PRODUCTION_BINDING_ATTESTATION_UNTIL_MS: String(now - 1) },
    { SIGNAL_PRODUCTION_BINDING_ATTESTATION_UNTIL_MS: String(now + 3 * 60 * 60 * 1000) },
    { VERCEL_ENV: "preview" },
    { VERCEL_TARGET_ENV: "preview" },
    { VERCEL_DEPLOYMENT_ID: undefined },
  ]) {
    const result = await attestProductionRuntimeBindings(request(), environment(overrides), now);
    assert.equal(result.status, 404);
    assert.equal(await result.text(), "");
    assert.match(result.headers.get("cache-control") ?? "", /no-store/);
  }
});

test("a missing, malformed, or wrong bearer cannot reach the comparison", async () => {
  for (const bearer of ["", "wrong", randomBytes(32).toString("base64url")]) {
    const result = await attestProductionRuntimeBindings(request(expected, bearer), environment(), now);
    assert.equal(result.status, 404);
  }
  for (const secret of [undefined, "too-short", "!".repeat(43)]) {
    const result = await attestProductionRuntimeBindings(request(), environment({
      SIGNAL_PRODUCTION_BINDING_ATTESTATION_TOKEN: secret,
    }), now);
    assert.equal(result.status, 404);
  }
});

test("only an exact five-name lowercase SHA-256 request is accepted", async () => {
  const invalid = [
    {},
    { ...expected, EXTRA_DATABASE_URL: "a".repeat(64) },
    { ...expected, TASKS_DATABASE_URL: "A".repeat(64) },
    { ...expected, TASKS_DATABASE_URL: "a".repeat(63) },
  ];
  for (const body of invalid) {
    const result = await attestProductionRuntimeBindings(request(body), environment(), now);
    assert.equal(result.status, 400);
    assert.equal(await result.text(), "");
  }
  const oversized = await attestProductionRuntimeBindings(request({ ...expected, EXTRA: "x".repeat(1025) }), environment(), now);
  assert.equal(oversized.status, 400);
});

test("the Function compares only its five in-process URL bindings and discloses booleans", async () => {
  const unrelatedSecret = "unrelated-runtime-secret-sentinel";
  const result = await attestProductionRuntimeBindings(request(), environment({ ARBITRARY_SECRET: unrelatedSecret }), now);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual(body, {
    allMatch: true,
    matches: Object.fromEntries(Object.keys(urls).map((key) => [key, true])),
    deployment: { id: "dpl_candidate123", projectId: "prj_app123", sourceSha: "a".repeat(40) },
  });
  const serialized = JSON.stringify(body);
  for (const forbidden of [...Object.values(urls), ...Object.values(expected), token, unrelatedSecret]) {
    assert.equal(serialized.includes(forbidden), false);
  }
  for (const header of ["cache-control", "cdn-cache-control", "vercel-cdn-cache-control"]) {
    assert.match(result.headers.get(header) ?? "", /no-store/);
  }
});

test("mismatched and missing bindings are false without exposing their value", async () => {
  const env = environment({ NOTES_DATABASE_URL: "libsql://other.example.invalid", SIGNAL_DATABASE_URL: undefined });
  const result = await attestProductionRuntimeBindings(request(), env, now);
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(body.allMatch, false);
  assert.deepEqual(body.matches, {
    TASKS_DATABASE_URL: true,
    NOTES_DATABASE_URL: false,
    TIMELINE_DATABASE_URL: true,
    SIGNAL_DATABASE_URL: false,
    ENTITLEMENTS_DATABASE_URL: true,
  });
  assert.equal(JSON.stringify(body).includes("other.example.invalid"), false);
});

test("other HTTP methods and hidden responses stay 404 and uncached", async () => {
  for (const handler of [GET, HEAD, OPTIONS, PUT, PATCH, DELETE, hiddenAttestationResponse]) {
    const response = handler();
    assert.equal(response.status, 404);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(await response.text(), "");
  }
});
