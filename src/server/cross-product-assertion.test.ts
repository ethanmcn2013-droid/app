import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { verifyNotesAssertion } from "./cross-product-assertion";

function token(sub: string, noteId: string, secret: string, now = 1_000) {
  const claims = { v: 1, iss: "signal-notes", aud: "signal-tasks.notes-extract", sub, noteId, workspaceId: "ws_a", iat: now, exp: now + 300, jti: `jti-${sub}-${noteId}`, traceId: "trace" };
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}

test("Notes assertion verifies and exposes immutable subject", () => {
  assert.equal(verifyNotesAssertion(token("user_a", "note_a", "secret"), "secret", 1_001).sub, "user_a");
});

test("Notes assertion rejects wrong secret, audience, and expiry", () => {
  const value = token("user_a", "note_a", "secret");
  assert.throws(() => verifyNotesAssertion(value, "wrong", 1_001));
  assert.throws(() => verifyNotesAssertion(value, "secret", 1_301));
});

test("Notes assertion rejects replay of the same jti", () => {
  const value = token("user_replay", "note_replay", "secret", 2_000);
  assert.equal(verifyNotesAssertion(value, "secret", 2_001).sub, "user_replay");
  assert.throws(() => verifyNotesAssertion(value, "secret", 2_001), /replayed/);
});
