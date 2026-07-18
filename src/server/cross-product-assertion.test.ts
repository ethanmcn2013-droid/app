import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";

import {
  assertNotesAssertionBindings,
  verifyLegacyNotesAssertion,
  verifyNotesAssertion,
} from "./cross-product-assertion";

const BODY_SHA = "a".repeat(64);
const uuid = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

function token(
  sub: string,
  noteId: string,
  secret: string,
  options: {
    now?: number;
    v?: number;
    workspaceId?: string;
    approvedBodySha256?: string | null;
    jti?: string;
    traceId?: string;
  } = {},
) {
  const now = options.now ?? 1_000;
  const claims = {
    v: options.v ?? 2,
    iss: "signal-notes",
    aud: "signal-tasks.notes-extract",
    sub,
    noteId,
    workspaceId: options.workspaceId ?? "ws_a",
    ...(options.approvedBodySha256 === null
      ? {}
      : { approvedBodySha256: options.approvedBodySha256 ?? BODY_SHA }),
    iat: now,
    exp: now + 300,
    jti: options.jti ?? uuid(1),
    traceId: options.traceId ?? uuid(999),
  };
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}

const expected = (overrides: Partial<{
  noteId: string;
  workspaceId: string;
  approvedBodySha256: string;
}> = {}) => ({
  noteId: "note_a",
  workspaceId: "ws_a",
  approvedBodySha256: BODY_SHA,
  ...overrides,
});

test("Notes v2 assertion verifies and exposes its immutable body fingerprint", () => {
  const claims = verifyNotesAssertion(
    token("user_a", "note_a", "secret"),
    "secret",
    1_001,
  );
  assertNotesAssertionBindings(claims, expected());
  assert.equal(claims.sub, "user_a");
  assert.equal(claims.approvedBodySha256, BODY_SHA);
});

test("Notes assertion rejects wrong secret, audience-bound identity drift, and expiry", () => {
  const wrongSecret = token("user_a", "note_a", "secret", { jti: uuid(2) });
  assert.throws(() => verifyNotesAssertion(wrongSecret, "wrong", 1_001));

  const claims = verifyNotesAssertion(
    token("user_a", "note_a", "secret", { jti: uuid(3) }),
    "secret",
    1_001,
  );
  assert.throws(() =>
    assertNotesAssertionBindings(claims, expected({ noteId: "note_b" })),
  );
  assert.throws(() =>
    assertNotesAssertionBindings(claims, expected({ workspaceId: "ws_b" })),
  );

  const expired = token("user_a", "note_a", "secret", { jti: uuid(4) });
  assert.throws(() => verifyNotesAssertion(expired, "secret", 1_301));
});

test("Notes assertion fails closed on v1, missing, malformed, or mismatched body hashes", () => {
  for (const [name, value] of [
    ["v1", token("user_v1", "note_a", "secret", { v: 1, jti: uuid(10) })],
    [
      "missing",
      token("user_missing", "note_a", "secret", {
        approvedBodySha256: null,
        jti: uuid(11),
      }),
    ],
    [
      "uppercase",
      token("user_upper", "note_a", "secret", {
        approvedBodySha256: "A".repeat(64),
        jti: uuid(12),
      }),
    ],
    [
      "short",
      token("user_short", "note_a", "secret", {
        approvedBodySha256: "a".repeat(63),
        jti: uuid(13),
      }),
    ],
    [
      "non-uuid jti",
      token("user_bad_jti", "note_a", "secret", { jti: "not-a-uuid" }),
    ],
    [
      "non-uuid trace",
      token("user_bad_trace", "note_a", "secret", {
        jti: uuid(15),
        traceId: "not-a-uuid",
      }),
    ],
    [
      "extra token segment",
      `${token("user_extra", "note_a", "secret", { jti: uuid(16) })}.extra`,
    ],
  ]) {
    assert.throws(() => verifyNotesAssertion(value, "secret", 1_001), name);
  }

  const claims = verifyNotesAssertion(
    token("user_different", "note_a", "secret", {
      approvedBodySha256: "b".repeat(64),
      jti: uuid(14),
    }),
    "secret",
    1_001,
  );
  assert.throws(() => assertNotesAssertionBindings(claims, expected()));
});

test("Notes assertion rejects replay of the same jti", () => {
  const value = token("user_replay", "note_a", "secret", {
    now: 2_000,
    jti: uuid(20),
  });
  assert.equal(
    verifyNotesAssertion(value, "secret", 2_001).sub,
    "user_replay",
  );
  assert.throws(() => verifyNotesAssertion(value, "secret", 2_001), /replayed/);
});

test("legacy and exact protocols stay isolated on their versioned seams", () => {
  const legacy = token("user_legacy", "note_a", "secret", {
    v: 1,
    approvedBodySha256: null,
    jti: uuid(30),
  });
  assert.equal(
    verifyLegacyNotesAssertion(legacy, "secret", 1_001).sub,
    "user_legacy",
  );

  const v2 = token("user_v2", "note_a", "secret", { jti: uuid(31) });
  assert.throws(() => verifyLegacyNotesAssertion(v2, "secret", 1_001));
  assert.throws(() => verifyNotesAssertion(legacy, "secret", 1_001));
});
