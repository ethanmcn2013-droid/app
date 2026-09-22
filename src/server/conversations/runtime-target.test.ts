import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { resolveConversationRuntimeTarget } from "./runtime-target";

const url = "libsql://isolated-conversation.turso.io";
const sha256 = createHash("sha256").update(url).digest("hex");
const remote = {
  SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true",
  SIGNAL_CONVERSATION_DATABASE_MODE: "remote",
  SIGNAL_CONVERSATION_REMOTE_ENABLED: "true",
  SIGNAL_CONVERSATION_REMOTE_TARGET: "isolated-acceptance",
  SIGNAL_CONVERSATION_REMOTE_URL_SHA256: sha256,
  TASKS_DATABASE_URL: url,
  TASKS_AUTH_TOKEN: "synthetic-token",
};

test("remote conversation target requires every independent activation and exact Tasks URL", () => {
  const accepted = resolveConversationRuntimeTarget(remote, false);
  assert.equal(accepted.mode, "remote");
  if (accepted.mode !== "remote") return;
  assert.equal(accepted.target, "isolated-acceptance");
  assert.equal(accepted.url, url);
  assert.equal(accepted.authToken, "synthetic-token");
  assert.equal(accepted.cacheKey.includes("synthetic-token"), false);
  assert.equal(accepted.cacheKey.includes(url), false);

  for (const removed of Object.keys(remote)) {
    assert.equal(resolveConversationRuntimeTarget({ ...remote, [removed]: undefined }, false).mode, "unavailable", removed);
  }
  assert.equal(resolveConversationRuntimeTarget(remote, true).mode, "unavailable");
  assert.equal(resolveConversationRuntimeTarget({ ...remote, TASKS_DATABASE_URL: "libsql://other.turso.io" }, false).mode, "unavailable");
  assert.equal(resolveConversationRuntimeTarget({ ...remote, TASKS_AUTH_TOKEN: "rotated-token" }, false).mode, "remote");
  const rotated = resolveConversationRuntimeTarget({ ...remote, TASKS_AUTH_TOKEN: "rotated-token" }, false);
  assert.notEqual(rotated.mode === "remote" ? rotated.cacheKey : null, accepted.cacheKey);
});

test("remote target refuses local, insecure and ambiguous URL forms", () => {
  for (const badUrl of [
    "file:tasks.db", "http://isolated-conversation.turso.io", "https://isolated-conversation.turso.io",
    "libsql://user:secret@isolated-conversation.turso.io", "libsql://isolated-conversation.turso.io:443",
    "libsql://isolated-conversation.turso.io/other", "libsql://isolated-conversation.turso.io?tls=0",
    "libsql://isolated-conversation.turso.io#fragment", "libsql://",
  ]) {
    const candidate = { ...remote, TASKS_DATABASE_URL: badUrl,
      SIGNAL_CONVERSATION_REMOTE_URL_SHA256: createHash("sha256").update(badUrl).digest("hex") };
    assert.equal(resolveConversationRuntimeTarget(candidate, false).mode, "unavailable", badUrl);
  }
  assert.equal(resolveConversationRuntimeTarget({ ...remote, SIGNAL_CONVERSATION_REMOTE_TARGET: "Production DB" }, false).mode, "unavailable");
  assert.equal(resolveConversationRuntimeTarget({ ...remote, SIGNAL_CONVERSATION_REMOTE_URL_SHA256: "wrong" }, false).mode, "unavailable");
});

test("local fixture mode stays unavailable in production and Vercel", () => {
  const local = { SIGNAL_CONVERSATION_INTERNAL_ENABLED: "true", SIGNAL_CONVERSATION_DATABASE_MODE: "local", TASKS_DATABASE_URL: "file:synthetic.db" };
  assert.equal(resolveConversationRuntimeTarget(local, false).mode, "local");
  assert.equal(resolveConversationRuntimeTarget({ ...local, NODE_ENV: "production" }, false).mode, "unavailable");
  assert.equal(resolveConversationRuntimeTarget({ ...local, VERCEL: "1" }, false).mode, "unavailable");
  assert.equal(resolveConversationRuntimeTarget({ ...local, TASKS_DATABASE_URL: "file::memory:" }, false).mode, "unavailable");
});
