import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import { checkFixedWindow, redisConfig, isRedisConfigured, REDIS_TIMEOUT_MS } from "../../../lib/redis-rate-limit";
import { allow, checkAttemptLimit } from "../../../lib/ratelimit";
import { checkRateLimit } from "./rate-limit";

const names = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN", "NODE_ENV"];
const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
const originalFetch = globalThis.fetch;
const environment: Record<string, string | undefined> = process.env;
beforeEach(() => {
  for (const name of names) delete process.env[name];
  environment.NODE_ENV = "production";
  globalThis.fetch = async () => { throw new Error("Unexpected HTTP: offline tests only"); };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const name of names) { const value = original[name]; if (value === undefined) delete process.env[name]; else process.env[name] = value; }
});
function configured() {
  process.env.KV_REST_API_URL = "https://redis.example.invalid/";
  process.env.KV_REST_API_TOKEN = "synthetic-token";
}
function response(data: unknown, status = 200) {
  globalThis.fetch = async () => new Response(JSON.stringify(data), { status });
}

test("blank legacy values select the complete Marketplace pair", () => {
  configured(); process.env.UPSTASH_REDIS_REST_URL = " "; process.env.UPSTASH_REDIS_REST_TOKEN = "";
  assert.deepEqual(redisConfig(), { url: "https://redis.example.invalid", token: "synthetic-token" });
});
test("complete direct pair takes precedence; a partial pair never borrows a token", () => {
  configured(); process.env.UPSTASH_REDIS_REST_URL = "https://direct.example.invalid";
  assert.equal(redisConfig(), null); assert.equal(isRedisConfigured(), true);
  process.env.UPSTASH_REDIS_REST_TOKEN = "direct-synthetic";
  assert.deepEqual(redisConfig(), { url: "https://direct.example.invalid", token: "direct-synthetic" });
});
for (const url of ["http://redis.example.invalid", "https://name:password@redis.example.invalid", "https://redis.example.invalid/route", "https://redis.example.invalid?token=bad", "invalid"]) {
  test(`invalid endpoint configuration is rejected: ${url}`, async () => {
    configured(); process.env.KV_REST_API_URL = url;
    assert.deepEqual(await checkFixedWindow("key", 2, 60), { allowed: false, reason: "config-miss" });
  });
}
test("missing production configuration closes redemption/Timeline, keeps AI best effort", async () => {
  assert.deepEqual(await checkAttemptLimit("redeem-user", "synthetic-user", 2, "1 m"), { allowed: false, reason: "config-miss" });
  assert.deepEqual(await checkRateLimit("create", "synthetic-ip", 2, 60), { allowed: false, reason: "config-miss" });
  assert.equal(await allow("ai", "synthetic-user", 2, "1 m"), true);
});
test("only absent development configuration permits local fallback", async () => {
  environment.NODE_ENV = "development";
  assert.deepEqual(await checkRateLimit("local-test", "caller", 1, 60), { allowed: true });
  assert.deepEqual(await checkRateLimit("local-test", "caller", 1, 60), { allowed: false, reason: "quota" });
  process.env.KV_REST_API_URL = "https://redis.example.invalid";
  assert.deepEqual(await checkRateLimit("local-test", "caller", 1, 60), { allowed: false, reason: "config-miss" });
});
test("atomic request preserves keys, expiry NX, no-store and no redirects", async () => {
  configured(); let requests = 0;
  globalThis.fetch = async (input, init) => {
    requests++; assert.equal(input, "https://redis.example.invalid/multi-exec");
    assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
    assert.ok(init?.signal); assert.deepEqual(JSON.parse(String(init?.body)), [["INCR", "signal:rl:redeem-user:caller"], ["EXPIRE", "signal:rl:redeem-user:caller", "600", "NX"]]);
    return Response.json([{ result: 1 }, { result: 1 }]);
  };
  assert.deepEqual(await checkAttemptLimit("redeem-user", "caller", 10, "10 m"), { allowed: true });
  assert.equal(requests, 1);
});
test("zero expiry result is valid for an existing window and quota is distinct", async () => {
  configured(); response([{ result: 3 }, { result: 0 }]);
  assert.deepEqual(await checkFixedWindow("key", 2, 60), { allowed: false, reason: "quota" });
  assert.equal(await allow("ai", "caller", 2, "1 m"), false);
});
for (const data of [{ error: "discarded" }, [], [{ result: 1 }], [{ result: "1" }, { result: 1 }], [{ result: 0 }, { result: 1 }], [{ result: 1.5 }, { result: 1 }], [{ error: "increment failed" }, { result: 1 }], [{ result: 1 }, { error: "expiry failed" }], [{ result: 1 }, { result: 2 }], [{ result: 1 }, { result: null }]]) {
  test(`malformed/failed transaction denies: ${JSON.stringify(data)}`, async () => {
    configured(); response(data);
    assert.deepEqual(await checkFixedWindow("key", 2, 60), { allowed: false, reason: "unavailable" });
  });
}
for (const status of [401, 403, 429, 503]) {
  test(`HTTP ${status} is an outage, never caller quota or a retry`, async () => {
    configured(); let requests = 0; globalThis.fetch = async () => { requests++; return new Response("", { status }); };
    assert.deepEqual(await checkRateLimit("create", "caller", 2, 60), { allowed: false, reason: "unavailable" });
    assert.equal(requests, 1);
  });
}
test("malformed JSON and network errors are contained", async () => {
  configured(); globalThis.fetch = async () => new Response("not-json");
  assert.deepEqual(await checkFixedWindow("key", 2, 60), { allowed: false, reason: "unavailable" });
  globalThis.fetch = async () => { throw new Error("synthetic provider error"); };
  assert.deepEqual(await checkAttemptLimit("redeem-user", "caller", 2, "1 m"), { allowed: false, reason: "unavailable" });
  assert.equal(await allow("ai", "caller", 2, "1 m"), true);
});
for (const hangsAt of ["fetch", "body"]) {
  test(`deadline covers ${hangsAt} without duplicate increments`, async () => {
    configured(); let calls = 0; let signal: AbortSignal | undefined;
    globalThis.fetch = async (_, init) => {
      calls++; signal = init?.signal as AbortSignal;
      if (hangsAt === "fetch") return new Promise<Response>(() => {});
      return { ok: true, json: () => new Promise(() => {}) } as Response;
    };
    const start = Date.now();
    assert.deepEqual(await checkFixedWindow("key", 2, 60), { allowed: false, reason: "unavailable" });
    assert.equal(calls, 1); assert.equal(signal?.aborted, true);
    assert.ok(Date.now() - start < REDIS_TIMEOUT_MS + 1000);
  });
}
test("parallel callers use the remote counter, not a per-process allowance", async () => {
  configured(); const counts = new Map<string, number>();
  globalThis.fetch = async (_, init) => {
    const [[, key]] = JSON.parse(String(init?.body));
    const next = (counts.get(key) ?? 0) + 1; counts.set(key, next);
    return Response.json([{ result: next }, { result: next === 1 ? 1 : 0 }]);
  };
  const results = await Promise.all(Array.from({ length: 10 }, () => checkRateLimit("shared", "caller", 3, 60)));
  assert.equal(results.filter(result => result.allowed).length, 3);
  assert.equal(counts.get("rl:shared:caller"), 10);
});
test("invalid limits are rejected before fetching", async () => {
  configured(); for (const [limit, seconds] of [[0, 60], [1, 0], [1.5, 60], [1, NaN]]) await assert.rejects(checkFixedWindow("key", limit, seconds), TypeError);
});
