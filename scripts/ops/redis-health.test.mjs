import assert from "node:assert/strict";
import { test } from "node:test";
import { probeRedis } from "./redis-health.mjs";
const config = { url: "https://redis.example.invalid", token: "synthetic-token" };
function store({ expiryFails = false, neverExpires = false } = {}) {
  let count = 0, expired = false, key;
  return {
    sleep: async ms => { assert.equal(ms, 16000); expired = true; },
    fetchImpl: async (url, init) => {
      assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
      const body = JSON.parse(init.body);
      if (url.endsWith("/multi-exec")) {
        assert.deepEqual(body[1], ["EXPIRE", body[0][1], "15", "NX"]);
        key ??= body[0][1]; assert.equal(body[0][1], key); assert.match(key, /^signal:health:weekly:/);
        count++; return Response.json([{ result: count }, expiryFails ? { error: "synthetic" } : { result: count === 1 ? 1 : 0 }]);
      }
      assert.equal(body[1], key);
      return Response.json({ result: body[0] === "TTL" ? 15 : (expired && !neverExpires ? null : "3") });
    },
  };
}
test("weekly probe verifies a unique temporary counter and actual expiry with eight commands", async () => {
  assert.deepEqual(await probeRedis(config, store()), { status: "passed", counterVerified: true, expiryVerified: true, commands: 8, customerKeysTouched: 0 });
});
test("failed expiry and missing reset cannot pass", async () => {
  await assert.rejects(probeRedis(config, store({ expiryFails: true })), /counter\/expiry/);
  await assert.rejects(probeRedis(config, store({ neverExpires: true })), /expiry reset/);
});
test("network errors are sanitized and never retried", async () => {
  let calls = 0;
  await assert.rejects(probeRedis(config, { fetchImpl: async () => { calls++; throw new Error("private-provider-detail"); } }), /^Error: Redis health request unavailable$/);
  assert.equal(calls, 1);
});
test("partial configuration cannot issue a request", async () => {
  await assert.rejects(probeRedis({ ...config, token: "" }, { fetchImpl: async () => assert.fail("must not fetch") }), /configuration/);
});
