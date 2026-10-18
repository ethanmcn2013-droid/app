import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { assistantTarget, assistantActorEnabled, createAssistantAuthentication } from "./controls";

const env = { NODE_ENV: "test", PING_ASSISTANT_ENABLED: "1", CLERK_SECRET_KEY: "synthetic-clerk", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "synthetic-publishable", TASKS_DATABASE_URL: "file:synthetic.db", PING_ASSISTANT_TASKS_URL_SHA256: createHash("sha256").update("file:synthetic.db").digest("hex"), PING_ASSISTANT_TARGET: "local", PING_ASSISTANT_ACTOR_IDS: "actor-a" };

test("explicit pinned target and allowlisted actor required; demo and ambient defaults denied", () => {
  assert.equal(assistantActorEnabled(env, "actor-a"), true);
  assert.equal(assistantActorEnabled(env, "actor-b"), false);
  assert.equal(assistantTarget(env, true), null);
  for (const patch of [{ PING_ASSISTANT_ENABLED: undefined }, { PING_ASSISTANT_TASKS_URL_SHA256: "0".repeat(64) }, { TASKS_DATABASE_URL: "file:other.db" }, { PING_ASSISTANT_ACTOR_IDS: "*" }, { PING_ASSISTANT_ACTOR_IDS: "actor-a,actor-a" }, { VERCEL: "1" }, { NODE_ENV: "production" }, { CLERK_SECRET_KEY: undefined }]) assert.equal(assistantTarget({ ...env, ...patch }), null);
});

test("requires both real session fields and persisted identity, with no development fallback", async () => {
  for (const [userId, sessionId, actor] of [[null, "session", "actor-a"], ["clerk-a", null, "actor-a"], ["clerk-a", "session", null], ["clerk-a", "session", "actor-b"]]) {
    const authenticate = createAssistantAuthentication({ target: () => assistantTarget(env), session: async () => ({ userId, sessionId }), resolveActor: async () => actor });
    assert.equal(await authenticate(), null);
  }
  const authenticate = createAssistantAuthentication({ target: () => assistantTarget(env), session: async () => ({ userId: "clerk-a", sessionId: "session" }), resolveActor: async clerkId => { assert.equal(clerkId, "clerk-a"); return "actor-a"; } });
  assert.equal(await authenticate(), "actor-a");
});

test("configuration changes during authentication fail closed", async () => {
  let current = { ...env };
  const authenticate = createAssistantAuthentication({ target: () => assistantTarget(current), session: async () => ({ userId: "clerk-a", sessionId: "session" }), resolveActor: async () => { current = { ...current, PING_ASSISTANT_ACTOR_IDS: "actor-b" }; return "actor-a"; } });
  assert.equal(await authenticate(), null);
});
