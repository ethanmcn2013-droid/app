import { createHash } from "node:crypto";

const CLERK_API_ORIGIN = "https://api.clerk.com";
const TOKEN_RENEWAL_LEAD_MS = 10_000;
const DEFAULT_MAX_SESSIONS = 10;

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function hashActorId(userId) {
  // Hash the Clerk user ID specifically; internal app user IDs must not be supplied here.
  return `sha256:${createHash("sha256").update(userId, "utf8").digest("hex")}`;
}

function validateOptions({ secretKey, instanceHash, expectedInstanceHash, expectedIssuer, controlledActorManifest, allowedApplicationOrigins, executionMode, maxSessions, identityRequestCap, requestTimeoutMs, maxRetries }) {
  if (typeof secretKey !== "string" || !secretKey.startsWith("sk_test_") || secretKey.length <= "sk_test_".length) {
    throw fail("CLERK_TEST_KEY_REQUIRED", "A Clerk development secret key beginning with sk_test_ is required");
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(instanceHash ?? "") || instanceHash !== expectedInstanceHash) {
    throw fail("CLERK_INSTANCE_MISMATCH", "Observed Clerk instance hash does not match the expected test instance");
  }
  if (!["authenticated-local-test", "hosted-test"].includes(executionMode)) {
    throw fail("EXECUTION_MODE_REQUIRED", "Choose authenticated-local-test or hosted-test explicitly");
  }
  let issuerUrl;
  try { issuerUrl = new URL(expectedIssuer); } catch { /* rejected below */ }
  if (!issuerUrl || issuerUrl.protocol !== "https:" || issuerUrl.origin !== expectedIssuer) {
    throw fail("CLERK_ISSUER_REQUIRED", "An exact HTTPS Clerk issuer origin is required");
  }
  if (!controlledActorManifest || controlledActorManifest.instanceHash !== instanceHash || !Array.isArray(controlledActorManifest.actors) || controlledActorManifest.actors.length !== 2) {
    throw fail("CONTROLLED_ACTOR_MANIFEST_INVALID", "The manifest must bind exactly two controlled actors to the expected Clerk instance");
  }
  const actorHashes = new Set();
  const actorsByHash = new Map();
  for (const actor of controlledActorManifest.actors) {
    if (!actor || typeof actor.userId !== "string" || !/^user_[A-Za-z0-9_-]+$/.test(actor.userId) || actor.ownershipConfirmed !== true) {
      throw fail("CONTROLLED_ACTOR_MANIFEST_INVALID", "Each controlled actor must have an owned Clerk user ID");
    }
    const actualActorHash = hashActorId(actor.userId);
    if (actor.actorHash !== actualActorHash || actorHashes.has(actualActorHash)) {
      throw fail("CONTROLLED_ACTOR_MANIFEST_INVALID", "Controlled actor hashes must uniquely match the configured Clerk user IDs");
    }
    actorHashes.add(actualActorHash);
    actorsByHash.set(actualActorHash, Object.freeze({ userId: actor.userId, actorHash: actualActorHash }));
  }
  if (!Array.isArray(allowedApplicationOrigins) || allowedApplicationOrigins.length === 0) {
    throw fail("APPLICATION_ORIGIN_ALLOWLIST_REQUIRED", "At least one exact application origin is required");
  }
  for (const origin of allowedApplicationOrigins) {
    let parsed;
    try { parsed = new URL(origin); } catch { /* rejected below */ }
    const loopback = parsed && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    const allowedProtocol = executionMode === "hosted-test"
      ? parsed?.protocol === "https:"
      : parsed?.protocol === "http:" && loopback;
    if (!parsed || parsed.origin !== origin || !allowedProtocol) {
      throw fail("APPLICATION_ORIGIN_ALLOWLIST_INVALID", "Hosted origins must use HTTPS; authenticated local test origins must be loopback HTTP");
    }
  }
  if (!Number.isInteger(maxSessions) || maxSessions < 1 || maxSessions > DEFAULT_MAX_SESSIONS) {
    throw fail("SESSION_LIMIT_INVALID", "The session limit must be between one and ten");
  }
  if (!Number.isInteger(identityRequestCap) || identityRequestCap < 1) {
    throw fail("IDENTITY_REQUEST_CAP_REQUIRED", "An explicit positive Clerk identity-provider request cap is required");
  }
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 60_000) {
    throw fail("REQUEST_TIMEOUT_INVALID", "Request timeout must be between 1 and 60000 milliseconds");
  }
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 3) {
    throw fail("RETRY_LIMIT_INVALID", "Retry limit must be between zero and three");
  }
  return { actorsByHash, allowedOriginSet: new Set(allowedApplicationOrigins) };
}

function decodeJwtClaims(jwt) {
  if (typeof jwt !== "string") return null;
  const segments = jwt.split(".");
  if (segments.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

function responseJwt(payload) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload.jwt === "string") return payload.jwt;
  if (payload && typeof payload.token === "string") return payload.token;
  return null;
}

function makeTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function composeRequestSignal(callerSignal, timeout) {
  const controller = new AbortController();
  let abortSource;
  const forward = (source, signal) => {
    if (controller.signal.aborted) return;
    abortSource = source;
    controller.abort(signal.reason);
  };
  const onCallerAbort = () => forward("caller", callerSignal);
  const onTimeoutAbort = () => forward("timeout", timeout.signal);
  if (callerSignal) {
    if (callerSignal.aborted) onCallerAbort();
    else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }
  if (timeout.signal.aborted) onTimeoutAbort();
  else timeout.signal.addEventListener("abort", onTimeoutAbort, { once: true });
  return {
    signal: controller.signal,
    get abortSource() { return abortSource; },
    clear() {
      callerSignal?.removeEventListener("abort", onCallerAbort);
      timeout.signal.removeEventListener("abort", onTimeoutAbort);
      timeout.clear();
    },
  };
}

/**
 * Manages Clerk development sessions and authenticated app calls for two allowlisted actors.
 * Secret keys and JWTs remain private to the manager and are never included in errors or metrics.
 * @param {{secretKey?: string, instanceHash?: string, expectedInstanceHash?: string, expectedIssuer?: string, executionMode?: 'authenticated-local-test'|'hosted-test', controlledActorManifest?: {instanceHash: string, actors: Array<{userId: string, actorHash: string, ownershipConfirmed: boolean}>}, allowedApplicationOrigins?: string[], fetchImpl?: typeof fetch, now?: () => number, requestTimeoutMs?: number, maxRetries?: number, maxSessions?: number, identityRequestCap?: number, onSessionCreated?: (receipt: {sessionId: string, userId: string, actorHash: string, instanceHash: string}) => void|Promise<void>, onAmbiguousCreateFailure?: (receipt: {actorHash: string, code: string, outcome: string, possibleOrphan: boolean, occurredAtMs: number}) => void|Promise<void>}} options
 * @returns {{createSession: (actorHash: string) => Promise<object>, fetchAuthenticated: (handle: object, url: string|URL, init?: RequestInit) => Promise<Response>, cleanup: () => Promise<{ok: boolean, attempted: number, revoked: number, unresolved: number, errors: Array<{code: string, actorHash: string}>}>, getMetrics: () => object}}
 */
export function createAuthenticatedSessionManager({
  secretKey,
  instanceHash,
  expectedInstanceHash,
  expectedIssuer,
  executionMode,
  controlledActorManifest,
  allowedApplicationOrigins,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  requestTimeoutMs = 5_000,
  maxRetries = 2,
  maxSessions = DEFAULT_MAX_SESSIONS,
  identityRequestCap,
  onSessionCreated,
  onAmbiguousCreateFailure,
} = {}) {
  const { actorsByHash, allowedOriginSet } = validateOptions({
    secretKey, instanceHash, expectedInstanceHash, expectedIssuer, controlledActorManifest, allowedApplicationOrigins, executionMode,
    maxSessions, identityRequestCap, requestTimeoutMs, maxRetries,
  });
  if (typeof fetchImpl !== "function") throw fail("FETCH_REQUIRED", "An injected or built-in fetch implementation is required");
  if (onSessionCreated !== undefined && typeof onSessionCreated !== "function") throw new TypeError("onSessionCreated must be a function");
  if (onAmbiguousCreateFailure !== undefined && typeof onAmbiguousCreateFailure !== "function") throw new TypeError("onAmbiguousCreateFailure must be a function");

  const sessions = new Map();
  const handles = new WeakMap();
  const usedSessionIds = new Set();
  let closed = false;
  let cleanupInFlight;
  let completedCleanupReceipt;
  const cleanupAttemptedSessionIds = new Set();
  let cleanupRevokedCount = 0;
  let creationQueue = Promise.resolve();
  const metrics = {
    identityProvider: { requests: 0, successes: 0, failures: 0, retries: 0, createRequests: 0, tokenRequests: 0, revokeRequests: 0, ambiguousCreateFailures: 0 },
    app: { requests: 0, responses: 0, failures: 0 },
  };

  async function pauseBeforeRetry(retryIndex) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(100 * (2 ** retryIndex), 500)));
  }

  async function providerRequest(path, { method = "POST", body, retries = 0, kind }) {
    let lastError;
    const reservedRevokes = kind === "revoke" ? 0 : [...sessions.values()].filter((record) => !record.revoked).length;
    const availableAttempts = kind === "revoke"
      ? retries + 1
      : Math.max(0, identityRequestCap - metrics.identityProvider.requests - reservedRevokes);
    const attemptLimit = Math.min(retries + 1, availableAttempts);
    if (attemptLimit === 0) throw fail("CLERK_IDENTITY_REQUEST_CAP", "Clerk identity-provider request cap reached while preserving cleanup capacity");
    for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
      if (metrics.identityProvider.requests >= identityRequestCap) {
        throw fail("CLERK_IDENTITY_REQUEST_CAP", "Clerk identity-provider request cap reached");
      }
      metrics.identityProvider.requests += 1;
      metrics.identityProvider[`${kind}Requests`] += 1;
      const timeout = makeTimeoutSignal(requestTimeoutMs);
      try {
        const response = await fetchImpl(`${CLERK_API_ORIGIN}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${secretKey}`,
            Accept: "application/json",
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          redirect: "error",
          signal: timeout.signal,
        });
        if (!response.ok) {
          metrics.identityProvider.failures += 1;
          const retryable = response.status === 429 || response.status >= 500;
          lastError = fail(retryable ? "CLERK_PROVIDER_HTTP_ERROR" : "CLERK_PROVIDER_HTTP_REJECTED", `Clerk ${kind} request failed with HTTP ${response.status}`);
          if (!retryable || attempt + 1 === attemptLimit) throw lastError;
        } else {
          let payload;
          try { payload = await response.json(); } catch {
            metrics.identityProvider.failures += 1;
            throw fail("CLERK_PROVIDER_RESPONSE_INVALID", `Clerk ${kind} response was not valid JSON`);
          }
          metrics.identityProvider.successes += 1;
          return payload;
        }
      } catch (error) {
        if (error?.code?.startsWith("CLERK_")) {
          lastError = error;
          if (error.code !== "CLERK_PROVIDER_HTTP_ERROR" || attempt + 1 === attemptLimit) throw error;
        } else {
          metrics.identityProvider.failures += 1;
          lastError = fail(error?.name === "AbortError" ? "CLERK_PROVIDER_TIMEOUT" : "CLERK_PROVIDER_NETWORK_ERROR", `Clerk ${kind} request did not complete`);
          if (attempt + 1 === attemptLimit) throw lastError;
        }
      } finally {
        timeout.clear();
      }
      metrics.identityProvider.retries += 1;
      await pauseBeforeRetry(attempt);
    }
    throw lastError ?? fail("CLERK_PROVIDER_REQUEST_FAILED", "Clerk request failed");
  }

  async function cleanup() {
    if (completedCleanupReceipt) return completedCleanupReceipt;
    if (cleanupInFlight) return cleanupInFlight;
    cleanupInFlight = (async () => {
      closed = true;
      const report = { ok: true, attempted: 0, revoked: 0, unresolved: 0, errors: [] };
      for (const record of [...sessions.values()].reverse()) {
        if (record.revoked) continue;
        report.attempted += 1;
        cleanupAttemptedSessionIds.add(record.sessionId);
        try {
          await providerRequest(`/v1/sessions/${encodeURIComponent(record.sessionId)}/revoke`, {
            retries: 0,
            kind: "revoke",
          });
          record.revoked = true;
          report.revoked += 1;
          cleanupRevokedCount += 1;
        } catch (error) {
          report.ok = false;
          report.unresolved += 1;
          report.errors.push({ code: error.code ?? "CLERK_REVOKE_FAILED", actorHash: record.actorHash });
        }
      }
      // Receipt counts are unique owned sessions; raw retry traffic remains in provider metrics.
      report.attempted = cleanupAttemptedSessionIds.size;
      report.revoked = cleanupRevokedCount;
      if (report.ok) {
        report.errors = Object.freeze([...report.errors]);
        completedCleanupReceipt = Object.freeze(report);
        return completedCleanupReceipt;
      }
      return report;
    })();
    try { return await cleanupInFlight; } finally { cleanupInFlight = undefined; }
  }

  async function createSessionSerial(actorHash) {
    if (closed) throw fail("SESSION_MANAGER_CLOSED", "This Clerk session manager has been closed");
    if (!actorsByHash.has(actorHash)) throw fail("ACTOR_NOT_ALLOWLISTED", "Requested actor is not in the controlled actor manifest");
    if (sessions.size >= maxSessions) throw fail("SESSION_LIMIT_REACHED", "The configured Clerk session limit has been reached");
    const actor = actorsByHash.get(actorHash);
    const activeSessions = [...sessions.values()].filter((record) => !record.revoked).length;
    if (metrics.identityProvider.requests + 2 + activeSessions + 1 > identityRequestCap) {
      throw fail("CLERK_IDENTITY_REQUEST_CAP", "Insufficient Clerk request budget for session creation, token issue, and cleanup");
    }
    let payload;
    try {
      // This create call is never retried: a timeout could hide a committed session ID.
      payload = await providerRequest("/v1/sessions", { body: { user_id: actor.userId }, kind: "create" });
    } catch (error) {
      if (["CLERK_PROVIDER_TIMEOUT", "CLERK_PROVIDER_NETWORK_ERROR", "CLERK_PROVIDER_HTTP_ERROR", "CLERK_PROVIDER_RESPONSE_INVALID"].includes(error.code)) {
        metrics.identityProvider.ambiguousCreateFailures += 1;
        try { await onAmbiguousCreateFailure?.({ actorHash, code: error.code, outcome: "unknown-session-id", possibleOrphan: true, occurredAtMs: now() }); } catch { /* Never replace a sanitized provider error with journal details. */ }
        const ambiguous = fail("CLERK_CREATE_OUTCOME_UNKNOWN", "Clerk session creation outcome is unknown; inspect the private recovery journal before retrying");
        const cleanupReport = await cleanup();
        ambiguous.cleanupReport = cleanupReport;
        throw ambiguous;
      }
      const cleanupReport = await cleanup();
      error.cleanupReport = cleanupReport;
      throw error;
    }
    const sessionId = payload?.id;
    if (typeof sessionId !== "string" || sessionId.length === 0 || payload?.user_id !== actor.userId) {
      try { await onAmbiguousCreateFailure?.({ actorHash, code: "CLERK_SESSION_OWNERSHIP_MISMATCH", outcome: "unknown-session-id", possibleOrphan: true, occurredAtMs: now() }); } catch { /* Keep provider details private. */ }
      const error = fail("CLERK_SESSION_OWNERSHIP_MISMATCH", "Clerk returned a session that does not match the controlled actor");
      error.cleanupReport = await cleanup();
      throw error;
    }
    if (usedSessionIds.has(sessionId)) {
      const error = fail("CLERK_SESSION_ID_REUSED", "Clerk returned a previously used session ID");
      error.cleanupReport = await cleanup();
      throw error;
    }
    usedSessionIds.add(sessionId);
    const record = { sessionId, userId: actor.userId, actorHash, token: null, revoked: false, tokenRefresh: undefined };
    sessions.set(sessionId, record);
    const handle = Object.freeze({ actorHash, slot: sessions.size });
    handles.set(handle, record);
    try {
      try { await onSessionCreated?.({ sessionId, userId: actor.userId, actorHash, instanceHash }); } catch {
        throw fail("SESSION_JOURNAL_FAILED", "Private session journal callback did not complete");
      }
      await ensureToken(record);
      return handle;
    } catch (error) {
      const cleanupReport = await cleanup();
      if (error && typeof error === "object") error.cleanupReport = cleanupReport;
      throw error;
    }
  }

  function createSession(actorHash) {
    const operation = creationQueue.then(() => createSessionSerial(actorHash));
    creationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async function ensureToken(record) {
    if (record.revoked) throw fail("SESSION_REVOKED", "The requested controlled session has been revoked");
    const tokenIsUsable = record.token && record.token.expiresAtMs - now() > TOKEN_RENEWAL_LEAD_MS;
    if (tokenIsUsable) return record.token.jwt;
    if (record.tokenRefresh) return record.tokenRefresh;
    record.tokenRefresh = (async () => {
      const payload = await providerRequest(`/v1/sessions/${encodeURIComponent(record.sessionId)}/tokens`, {
        // Clerk's no-template token endpoint rejected an absent content type in the bounded probe.
        // An empty JSON object supplies the required type without selecting a JWT template.
        body: {},
        retries: maxRetries,
        kind: "token",
      });
      const jwt = responseJwt(payload);
      const claims = decodeJwtClaims(jwt);
      if (!claims || claims.sub !== record.userId || claims.iss !== expectedIssuer || !Number.isFinite(claims.exp)
          || (claims.sid !== undefined && claims.sid !== record.sessionId)) {
        throw fail("CLERK_SESSION_TOKEN_INVALID", "Clerk returned a token that does not match the controlled user");
      }
      const expiresAtMs = claims.exp * 1_000;
      if (expiresAtMs - now() <= 0) throw fail("CLERK_SESSION_TOKEN_EXPIRED", "Clerk returned an already expired session token");
      record.token = { jwt, expiresAtMs };
      return jwt;
    })();
    try { return await record.tokenRefresh; } finally { record.tokenRefresh = undefined; }
  }

  async function fetchAuthenticated(handle, url, init = {}) {
    if (closed) throw fail("SESSION_MANAGER_CLOSED", "This Clerk session manager has been closed");
    const record = handle && handles.get(handle);
    if (!record || record.revoked) throw fail("SESSION_HANDLE_NOT_OWNED", "Session handle is not owned by this manager or has been revoked");
    let parsed;
    try { parsed = new URL(url); } catch { throw fail("APPLICATION_ORIGIN_NOT_ALLOWED", "Application request URL is invalid"); }
    if (!allowedOriginSet.has(parsed.origin)) throw fail("APPLICATION_ORIGIN_NOT_ALLOWED", "Application request origin is not allowlisted");
    if (parsed.username || parsed.password) throw fail("APPLICATION_ORIGIN_NOT_ALLOWED", "Application request URLs cannot contain embedded credentials");
    if (init.signal?.aborted) throw fail("APPLICATION_REQUEST_ABORTED", "Authenticated application request was cancelled before it started");
    const jwt = await ensureToken(record);
    if (init.signal?.aborted) throw fail("APPLICATION_REQUEST_ABORTED", "Authenticated application request was cancelled before it started");
    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${jwt}`);
    const timeout = makeTimeoutSignal(requestTimeoutMs);
    const request = composeRequestSignal(init.signal, timeout);
    if (request.abortSource === "caller") {
      request.clear();
      throw fail("APPLICATION_REQUEST_ABORTED", "Authenticated application request was cancelled before it started");
    }
    metrics.app.requests += 1;
    try {
      const response = await fetchImpl(parsed.href, {
        ...init,
        headers,
        redirect: "error",
        signal: request.signal,
      });
      metrics.app.responses += 1;
      if (!response.body || [204, 205, 304].includes(response.status)) {
        request.clear();
        return response;
      }
      const reader = response.body.getReader();
      const boundedBody = new ReadableStream({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              request.clear();
              controller.close();
            } else {
              controller.enqueue(value);
            }
          } catch (error) {
            request.clear();
            const callerCancelled = request.abortSource === "caller" && error?.name === "AbortError";
            controller.error(fail(callerCancelled ? "APPLICATION_REQUEST_ABORTED" : "APPLICATION_RESPONSE_BODY_FAILED",
              callerCancelled ? "Authenticated application request was cancelled" : "Authenticated application response body did not complete"));
          }
        },
        async cancel(reason) {
          request.clear();
          await reader.cancel(reason);
        },
      });
      return new Response(boundedBody, { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) {
      request.clear();
      metrics.app.failures = (metrics.app.failures ?? 0) + 1;
      const callerCancelled = request.abortSource === "caller" && error?.name === "AbortError";
      const timedOut = request.abortSource === "timeout" && error?.name === "AbortError";
      throw fail(callerCancelled ? "APPLICATION_REQUEST_ABORTED" : timedOut ? "APPLICATION_REQUEST_TIMEOUT" : "APPLICATION_REQUEST_FAILED",
        callerCancelled ? "Authenticated application request was cancelled" : timedOut ? "Authenticated application request timed out" : "Authenticated application request did not complete");
    }
  }

  function getMetrics() {
    return {
      identityProvider: { ...metrics.identityProvider },
      app: { ...metrics.app },
      ownedSessionCount: sessions.size,
      activeOwnedSessionCount: [...sessions.values()].filter((record) => !record.revoked).length,
      instanceHash,
      actorHashes: [...actorsByHash.keys()],
      executionMode,
    };
  }

  return Object.freeze({ createSession, fetchAuthenticated, cleanup, getMetrics });
}

export const authenticatedSessionConstants = Object.freeze({ tokenRenewalLeadMs: TOKEN_RENEWAL_LEAD_MS, maxSessions: DEFAULT_MAX_SESSIONS });
