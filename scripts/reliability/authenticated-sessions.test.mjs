import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createAuthenticatedSessionManager } from "./authenticated-sessions.mjs";

const instanceHash = `sha256:${"a".repeat(64)}`;
const expectedIssuer = "https://clerk-test.example";
const ids = ["user_controlled_one", "user_controlled_two"];
const actors = ids.map((userId) => ({
  userId,
  actorHash: `sha256:${createHash("sha256").update(userId).digest("hex")}`,
  ownershipConfirmed: true,
}));
const baseOptions = {
  secretKey: "sk_test_fake-test-only",
  instanceHash,
  expectedInstanceHash: instanceHash,
  expectedIssuer,
  executionMode: "hosted-test",
  controlledActorManifest: { instanceHash, actors },
  allowedApplicationOrigins: ["https://preview-test.example"],
  requestTimeoutMs: 100,
  maxRetries: 1,
  maxSessions: 10,
  identityRequestCap: 50,
  now: () => 1_800_000_000_000,
};

function encodeJwt(claims) {
  return `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function sessionResponse(sessionId, userId = ids[0]) {
  return jsonResponse({ id: sessionId, user_id: userId, status: "active" });
}

function tokenResponse(userId = ids[0], exp = 1_800_000_060, sessionId) {
  return jsonResponse({ jwt: encodeJwt({ sub: userId, exp, iss: expectedIssuer, ...(sessionId ? { sid: sessionId } : {}) }) });
}

function actorHash(index = 0) { return actors[index].actorHash; }

test("validates test-only key, explicit instance and the exact two owned Clerk actors before fetch", () => {
  const calls = [];
  const make = (overrides = {}) => createAuthenticatedSessionManager({ ...baseOptions, fetchImpl: async (...args) => { calls.push(args); return jsonResponse({}); }, ...overrides });
  assert.throws(() => make({ secretKey: "sk_live_never-allowed" }), { code: "CLERK_TEST_KEY_REQUIRED" });
  assert.throws(() => make({ expectedInstanceHash: `sha256:${"b".repeat(64)}` }), { code: "CLERK_INSTANCE_MISMATCH" });
  assert.throws(() => make({ controlledActorManifest: { instanceHash, actors: [actors[0]] } }), { code: "CONTROLLED_ACTOR_MANIFEST_INVALID" });
  assert.throws(() => make({ controlledActorManifest: { instanceHash, actors: [{ ...actors[0], ownershipConfirmed: false }, actors[1]] } }), { code: "CONTROLLED_ACTOR_MANIFEST_INVALID" });
  assert.throws(() => make({ controlledActorManifest: { instanceHash, actors: [{ ...actors[0], userId: "internal-user-1" }, actors[1]] } }), { code: "CONTROLLED_ACTOR_MANIFEST_INVALID" });
  assert.equal(calls.length, 0);
});

test("creates only allowlisted sessions, requests an untemplated JWT and authorizes exact app origins", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_owned_1");
    if (url.endsWith("/tokens")) {
      if (init.headers["Content-Type"] !== "application/json" || init.body !== "{}") {
        return jsonResponse({ errors: [{ code: "unsupported_content_type" }] }, 415);
      }
      return tokenResponse();
    }
    return jsonResponse({ ok: true });
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl });
  await assert.rejects(manager.createSession("sha256:unlisted"), { code: "ACTOR_NOT_ALLOWLISTED" });
  const handle = await manager.createSession(actorHash(0));
  const appResponse = await manager.fetchAuthenticated(handle, "https://preview-test.example/api/tasks", {
    method: "POST",
    headers: { Authorization: "Bearer caller-supplied", "Content-Type": "application/json" },
    body: "{}",
    redirect: "manual",
  });
  assert.equal(appResponse.status, 200);
  assert.equal(calls[0].url, "https://api.clerk.com/v1/sessions");
  assert.deepEqual(JSON.parse(calls[0].init.body), { user_id: ids[0] });
  assert.equal(calls[1].url, "https://api.clerk.com/v1/sessions/sess_owned_1/tokens");
  assert.equal(calls[1].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[1].init.body), {});
  assert.equal(calls[2].init.headers.get("Authorization").startsWith("Bearer header."), true);
  assert.notEqual(calls[2].init.headers.get("Authorization"), "Bearer caller-supplied");
  assert.equal(calls[2].init.redirect, "error");
  assert.equal(manager.getMetrics().identityProvider.requests, 2);
  assert.equal(manager.getMetrics().app.requests, 1);
  assert.equal((await manager.cleanup()).ok, true);
  assert.match(calls[3].url, /\/v1\/sessions\/sess_owned_1\/revoke$/);
});

test("keeps the cleanup receipt when token setup fails after a session was created", async () => {
  let revokes = 0;
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_cleanup_receipt");
    if (url.endsWith("/tokens")) return jsonResponse({ errors: [{ code: "unsupported_content_type" }] }, 415);
    if (url.endsWith("/revoke")) { revokes += 1; return jsonResponse({}); }
    throw new Error("unexpected request");
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl });
  let earlyReceipt;
  await assert.rejects(manager.createSession(actorHash(0)), (error) => {
    assert.equal(error.code, "CLERK_PROVIDER_HTTP_REJECTED");
    earlyReceipt = error.cleanupReport;
    assert.equal(earlyReceipt.ok, true);
    assert.equal(earlyReceipt.attempted, 1);
    assert.equal(earlyReceipt.revoked, 1);
    assert.equal(earlyReceipt.unresolved, 0);
    return true;
  });
  assert.strictEqual(await manager.cleanup(), earlyReceipt);
  assert.equal(revokes, 1);
  assert.equal(manager.getMetrics().identityProvider.revokeRequests, 1);
});

test("refuses cross-origin bearer disclosure and handles from another manager", async () => {
  const responses = [sessionResponse("sess_owned_2"), tokenResponse()];
  const fetchImpl = async () => responses.shift();
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl });
  const other = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl });
  const handle = await manager.createSession(actorHash(0));
  await assert.rejects(manager.fetchAuthenticated(handle, "https://unapproved.example/api"), { code: "APPLICATION_ORIGIN_NOT_ALLOWED" });
  await assert.rejects(other.fetchAuthenticated(handle, "https://preview-test.example/api"), { code: "SESSION_HANDLE_NOT_OWNED" });
  assert.equal(manager.getMetrics().app.requests, 0);
  await manager.cleanup();
});

test("allows loopback HTTP only for explicit authenticated-local-test mode", async () => {
  const localManager = createAuthenticatedSessionManager({ ...baseOptions, executionMode: "authenticated-local-test", allowedApplicationOrigins: ["http://127.0.0.1:3000"], fetchImpl: async () => jsonResponse({}) });
  const hostedHttpOptions = { ...baseOptions, allowedApplicationOrigins: ["http://127.0.0.1:3000"], fetchImpl: async () => jsonResponse({}) };
  assert.throws(() => createAuthenticatedSessionManager(hostedHttpOptions), { code: "APPLICATION_ORIGIN_ALLOWLIST_INVALID" });
  assert.throws(() => createAuthenticatedSessionManager({ ...baseOptions, executionMode: undefined }), { code: "EXECUTION_MODE_REQUIRED" });
  assert.equal((await localManager.cleanup()).ok, true);
});

test("rejects embedded URL credentials before sending a bearer token", async () => {
  const fetchImpl = async (url) => url.endsWith("/v1/sessions") ? sessionResponse("sess_url") : tokenResponse();
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl });
  const handle = await manager.createSession(actorHash(0));
  await assert.rejects(manager.fetchAuthenticated(handle, "https://user:password@preview-test.example/api"), { code: "APPLICATION_ORIGIN_NOT_ALLOWED" });
  assert.equal(manager.getMetrics().app.requests, 0);
  await manager.cleanup();
});

test("keeps the application timeout active through response-body consumption", async () => {
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_slow_body");
    if (url.endsWith("/tokens")) return tokenResponse();
    return new Response(new ReadableStream({
      start(controller) {
        init.signal.addEventListener("abort", () => controller.error(Object.assign(new Error("aborted"), { name: "AbortError" })));
      },
    }), { status: 200 });
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl, requestTimeoutMs: 15 });
  const handle = await manager.createSession(actorHash(0));
  const response = await manager.fetchAuthenticated(handle, "https://preview-test.example/api/slow");
  await assert.rejects(response.text(), /response body did not complete/);
  assert.equal(manager.getMetrics().app.requests, 1);
  await manager.cleanup();
});

test("does not issue an authenticated application request for an already-aborted caller", async () => {
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl: async (url) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_pre_aborted");
    if (url.endsWith("/tokens")) return tokenResponse();
    throw new Error("unexpected_application_request");
  } });
  const handle = await manager.createSession(actorHash(0));
  const identityRequestsBeforeAbort = manager.getMetrics().identityProvider.tokenRequests;
  const controller = new AbortController(); controller.abort();
  await assert.rejects(manager.fetchAuthenticated(handle, "https://preview-test.example/api/read", { signal: controller.signal }), { code: "APPLICATION_REQUEST_ABORTED" });
  assert.equal(manager.getMetrics().app.requests, 0);
  assert.equal(manager.getMetrics().identityProvider.tokenRequests, identityRequestsBeforeAbort);
  await manager.cleanup();
});

test("composes caller cancellation with request timeout and aborts the underlying fetch", async () => {
  let markApplicationStarted;
  const applicationStarted = new Promise((resolve) => { markApplicationStarted = resolve; });
  let underlyingSignal;
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl: async (url, init) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_abort_fetch");
    if (url.endsWith("/tokens")) return tokenResponse();
    underlyingSignal = init.signal;
    markApplicationStarted();
    return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true }));
  } });
  const handle = await manager.createSession(actorHash(0));
  const controller = new AbortController();
  const pending = manager.fetchAuthenticated(handle, "https://preview-test.example/api/read", { signal: controller.signal });
  await applicationStarted;
  controller.abort();
  await assert.rejects(pending, { code: "APPLICATION_REQUEST_ABORTED" });
  assert.equal(underlyingSignal.aborted, true);
  assert.equal(manager.getMetrics().app.failures, 1);
  await manager.cleanup();
});

test("caller cancellation after headers aborts underlying response-body consumption", async () => {
  let bodySignal;
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl: async (url, init) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_abort_body");
    if (url.endsWith("/tokens")) return tokenResponse();
    bodySignal = init.signal;
    return new Response(new ReadableStream({
      start(controller) { init.signal.addEventListener("abort", () => controller.error(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true }); },
    }), { status: 200 });
  } });
  const handle = await manager.createSession(actorHash(0));
  const controller = new AbortController();
  const response = await manager.fetchAuthenticated(handle, "https://preview-test.example/api/slow-body", { signal: controller.signal });
  const reading = response.text();
  controller.abort();
  await assert.rejects(reading, { code: "APPLICATION_REQUEST_ABORTED" });
  assert.equal(bodySignal.aborted, true);
  await manager.cleanup();
});

test("does not relabel an ordinary response-stream failure as caller cancellation", async () => {
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl: async (url, init) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_abort_race");
    if (url.endsWith("/tokens")) return tokenResponse();
    return new Response(new ReadableStream({
      start(controller) {
        init.signal.addEventListener("abort", () => controller.error(new Error("ordinary response stream failure")), { once: true });
      },
    }), { status: 200 });
  } });
  const handle = await manager.createSession(actorHash(0));
  const controller = new AbortController();
  const response = await manager.fetchAuthenticated(handle, "https://preview-test.example/api/racing-body", { signal: controller.signal });
  const reading = response.text();
  controller.abort();
  await assert.rejects(reading, { code: "APPLICATION_RESPONSE_BODY_FAILED" });
  await manager.cleanup();
});

test("refreshes a token inside the expiry safety window and accounts refresh separately", async () => {
  let time = 1_800_000_000_000;
  let tokenIssue = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_refresh");
    if (url.endsWith("/tokens")) {
      tokenIssue += 1;
      return tokenResponse(ids[0], tokenIssue === 1 ? 1_800_000_060 : 1_800_000_160);
    }
    return jsonResponse({ ok: true });
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl, now: () => time });
  const handle = await manager.createSession(actorHash(0));
  time += 51_000;
  await manager.fetchAuthenticated(handle, "https://preview-test.example/api/read");
  assert.equal(tokenIssue, 2);
  assert.equal(manager.getMetrics().identityProvider.tokenRequests, 2);
  await manager.cleanup();
});

test("validates JWT issuer, subject and session binding without logging token data", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_bound");
    if (url.endsWith("/tokens")) return jsonResponse({ jwt: encodeJwt({ sub: ids[0], exp: 1_800_000_060, iss: "https://wrong-issuer.example", sid: "sess_other" }) });
    return jsonResponse({});
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl });
  await assert.rejects(manager.createSession(actorHash(0)), { code: "CLERK_SESSION_TOKEN_INVALID" });
  assert.equal(manager.getMetrics().activeOwnedSessionCount, 0);
});

test("partial setup failure revokes every returned manager-owned session and no other ID", async () => {
  const calls = [];
  let creates = 0;
  const journal = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/v1/sessions")) {
      creates += 1;
      if (creates === 1) return sessionResponse("sess_owned_first", ids[0]);
      return jsonResponse({ detail: "SECRET_BODY_MUST_NOT_ESCAPE" }, 503);
    }
    if (url.endsWith("/tokens")) return tokenResponse(ids[0]);
    if (url.endsWith("/revoke")) return jsonResponse({ id: "sess_owned_first", status: "revoked" });
    throw new Error("unexpected request");
  };
  const manager = createAuthenticatedSessionManager({
    ...baseOptions,
    fetchImpl,
    identityRequestCap: 10,
    onSessionCreated: (receipt) => journal.push(receipt),
  });
  const first = await manager.createSession(actorHash(0));
  assert.ok(first);
  await assert.rejects(manager.createSession(actorHash(1)), (error) => {
    assert.equal(error.code, "CLERK_CREATE_OUTCOME_UNKNOWN");
    assert.equal(error.cleanupReport.revoked, 1);
    assert.equal(error.message.includes("SECRET_BODY_MUST_NOT_ESCAPE"), false);
    return true;
  });
  assert.equal(journal.length, 1);
  assert.equal(journal[0].sessionId, "sess_owned_first");
  const revokeUrls = calls.filter((call) => call.url.endsWith("/revoke")).map((call) => call.url);
  assert.deepEqual(revokeUrls, ["https://api.clerk.com/v1/sessions/sess_owned_first/revoke"]);
  assert.equal(manager.getMetrics().identityProvider.ambiguousCreateFailures, 1);
});

test("returns an explicit unresolved cleanup receipt so callers can fail acceptance", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_revoke_fails");
    if (url.endsWith("/tokens")) return tokenResponse();
    if (url.endsWith("/revoke")) return jsonResponse({ internal: "do not expose" }, 503);
    return jsonResponse({});
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl, identityRequestCap: 5, maxRetries: 2 });
  await manager.createSession(actorHash(0));
  const receipt = await manager.cleanup();
  assert.equal(receipt.ok, false);
  assert.equal(receipt.attempted, 1);
  assert.equal(receipt.unresolved, 1);
  assert.equal(receipt.errors[0].code, "CLERK_PROVIDER_HTTP_ERROR");
  assert.equal(JSON.stringify(receipt).includes("do not expose"), false);
});

test("retries only unresolved revocations, reports unique session counts, and caches final success", async () => {
  let revokes = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_cleanup_retry");
    if (url.endsWith("/tokens")) return tokenResponse();
    if (url.endsWith("/revoke")) {
      revokes += 1;
      return revokes === 1 ? jsonResponse({}, 503) : jsonResponse({ status: "revoked" });
    }
    return jsonResponse({});
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl, identityRequestCap: 8, maxRetries: 2 });
  await manager.createSession(actorHash(0));
  const first = await manager.cleanup();
  assert.equal(first.ok, false);
  assert.equal(first.attempted, 1);
  assert.equal(first.revoked, 0);
  assert.equal(first.unresolved, 1);
  const completed = await manager.cleanup();
  assert.equal(completed.ok, true);
  assert.equal(completed.attempted, 1);
  assert.equal(completed.revoked, 1);
  assert.equal(completed.unresolved, 0);
  assert.strictEqual(await manager.cleanup(), completed);
  assert.equal(revokes, 2);
  assert.equal(manager.getMetrics().identityProvider.revokeRequests, 2);
  assert.equal(completed.revoked, completed.attempted);
  assert.ok(completed.attempted <= 10);
  await assert.rejects(manager.createSession(actorHash(1)), { code: "SESSION_MANAGER_CLOSED" });
});

test("records an ambiguous create timeout without retrying or pretending it can revoke an unknown ID", async () => {
  let providerCalls = 0;
  const receipts = [];
  const fetchImpl = async (_url, init) => {
    providerCalls += 1;
    return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("timeout"), { name: "AbortError" }))));
  };
  const manager = createAuthenticatedSessionManager({
    ...baseOptions,
    fetchImpl,
    requestTimeoutMs: 5,
    onAmbiguousCreateFailure: (receipt) => receipts.push(receipt),
  });
  await assert.rejects(manager.createSession(actorHash(0)), (error) => error.code === "CLERK_CREATE_OUTCOME_UNKNOWN");
  assert.equal(providerCalls, 1);
  assert.deepEqual(receipts.map(({ actorHash: hashed, possibleOrphan, outcome }) => ({ actorHash: hashed, possibleOrphan, outcome })), [
    { actorHash: actorHash(0), possibleOrphan: true, outcome: "unknown-session-id" },
  ]);
  assert.equal(manager.getMetrics().identityProvider.createRequests, 1);
  assert.equal(manager.getMetrics().identityProvider.retries, 0);
  assert.equal(manager.getMetrics().ownedSessionCount, 0);
});

test("rejects a provider-reused session ID and revokes only its one manager-owned record", async () => {
  let createCount = 0;
  const revoked = [];
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/sessions")) {
      createCount += 1;
      return sessionResponse("sess_reused", ids[0]);
    }
    if (url.endsWith("/tokens")) return tokenResponse(ids[0]);
    if (url.endsWith("/revoke")) { revoked.push(url); return jsonResponse({}); }
    return jsonResponse({});
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl });
  await manager.createSession(actorHash(0));
  await assert.rejects(manager.createSession(actorHash(0)), { code: "CLERK_SESSION_ID_REUSED" });
  assert.equal(createCount, 2);
  assert.equal(revoked.length, 1);
  assert.match(revoked[0], /sess_reused\/revoke$/);
});

test("permits at most ten created sessions", async () => {
  let createCount = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/sessions")) {
      createCount += 1;
      return sessionResponse(`sess_${createCount}`, ids[(createCount - 1) % 2]);
    }
    if (url.endsWith("/tokens")) {
      const userId = createCount % 2 === 1 ? ids[0] : ids[1];
      return tokenResponse(userId);
    }
    return jsonResponse({});
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl });
  for (let index = 0; index < 10; index += 1) await manager.createSession(actorHash(index % 2));
  await assert.rejects(manager.createSession(actorHash(0)), { code: "SESSION_LIMIT_REACHED" });
  assert.equal(createCount, 10);
  assert.equal(manager.getMetrics().ownedSessionCount, 10);
  assert.equal((await manager.cleanup()).revoked, 10);
});

test("serializes concurrent setup so it cannot create an eleventh session", async () => {
  let createCount = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/sessions")) {
      createCount += 1;
      const index = createCount - 1;
      return sessionResponse(`sess_parallel_${createCount}`, ids[index % 2]);
    }
    if (url.endsWith("/tokens")) return tokenResponse(ids[(createCount - 1) % 2]);
    return jsonResponse({});
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl, identityRequestCap: 50 });
  const outcomes = await Promise.allSettled(Array.from({ length: 11 }, (_, index) => manager.createSession(actorHash(index % 2))));
  assert.equal(outcomes.filter((entry) => entry.status === "fulfilled").length, 10);
  assert.equal(outcomes.filter((entry) => entry.status === "rejected" && entry.reason.code === "SESSION_LIMIT_REACHED").length, 1);
  assert.equal(createCount, 10);
  assert.equal((await manager.cleanup()).revoked, 10);
});

test("enforces identity-provider request cap before creating an uncleanable session", async () => {
  let calls = 0;
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl: async () => { calls += 1; return sessionResponse("sess_cap"); }, maxSessions: 1, identityRequestCap: 2 });
  await assert.rejects(manager.createSession(actorHash(0)), { code: "CLERK_IDENTITY_REQUEST_CAP" });
  assert.equal(calls, 0);
});

test("uses bounded retries only for token issuance", async () => {
  let tokenAttempts = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/sessions")) return sessionResponse("sess_retry");
    if (url.endsWith("/tokens")) {
      tokenAttempts += 1;
      return tokenAttempts === 1 ? jsonResponse({ internal: "PRIVATE_BODY" }, 503) : tokenResponse();
    }
    return jsonResponse({});
  };
  const manager = createAuthenticatedSessionManager({ ...baseOptions, fetchImpl, identityRequestCap: 10 });
  await manager.createSession(actorHash(0));
  assert.equal(tokenAttempts, 2);
  assert.equal(manager.getMetrics().identityProvider.retries, 1);
  await manager.cleanup();
});
