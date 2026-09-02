import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { assertProjectId } from "@/lib/projects/project-ref";
import {
  GOOGLE_OAUTH_STATE_MAX_TTL_SECONDS,
  GoogleOAuthStateError,
  createGoogleOAuthState,
  googleOAuthStateSecretFromEnv,
  verifyGoogleOAuthState,
  type CreatedGoogleOAuthState,
  type GoogleOAuthStateBinding,
  type GoogleOAuthStateExpectation,
  type GoogleOAuthStateIntent,
} from "@/server/connections/google-oauth-state";

const SECRET = "oauth-state-secret-material-0123456789abcdef";
const OTHER_SECRET = "other-oauth-secret-material-0123456789abc";
const NOW = 2_000_000_000;

function binding(
  overrides: Partial<{
    userId: string;
    sessionId: string;
    projectId: string;
    intent: GoogleOAuthStateIntent;
  }> = {},
): GoogleOAuthStateBinding {
  return {
    userId: overrides.userId ?? "user_clerk123",
    sessionId: overrides.sessionId ?? "sess_clerk456",
    projectId: assertProjectId(overrides.projectId ?? "ws-project-789"),
    intent: overrides.intent ?? "connect-google-drive",
  };
}

function expected(
  created: CreatedGoogleOAuthState,
  overrides: Partial<{
    nonce: string;
    userId: string;
    sessionId: string;
    projectId: string;
    intent: GoogleOAuthStateIntent;
  }> = {},
): GoogleOAuthStateExpectation {
  return {
    ...binding(overrides),
    nonce: overrides.nonce ?? created.nonce,
  };
}

function signedPayload(value: unknown, secret = SECRET): string {
  const encoded = Buffer.from(JSON.stringify(value), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

function claimsOf(created: CreatedGoogleOAuthState): Record<string, unknown> {
  const [encoded] = created.state.split(".");
  return JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
}

describe("Google OAuth state · valid envelope", () => {
  it("binds one cryptographic nonce to the Clerk session and explicit Project", () => {
    const created = createGoogleOAuthState(binding(), SECRET, { now: NOW });
    const claims = verifyGoogleOAuthState(
      created.state,
      expected(created),
      SECRET,
      NOW + 1,
    );

    assert.equal(Buffer.from(created.nonce, "base64url").length, 32);
    assert.equal(created.state.split(".").length, 2);
    assert.equal(claims.version, 1);
    assert.equal(claims.nonce, created.nonce);
    assert.equal(claims.userId, "user_clerk123");
    assert.equal(claims.sessionId, "sess_clerk456");
    assert.equal(claims.projectId, "ws-project-789");
    assert.equal(claims.intent, "connect-google-drive");
    assert.equal(claims.issuedAt, NOW);
    assert.equal(
      claims.expiresAt,
      NOW + GOOGLE_OAUTH_STATE_MAX_TTL_SECONDS,
    );
  });

  it("reads only OAUTH_STATE_SECRET and refuses a missing fallback", () => {
    assert.equal(
      googleOAuthStateSecretFromEnv({
        OAUTH_STATE_SECRET: SECRET,
        PROVIDER_TOKEN_KEY: "must-not-be-used",
      }),
      SECRET,
    );
    assert.throws(
      () => googleOAuthStateSecretFromEnv({ PROVIDER_TOKEN_KEY: SECRET }),
      (error: GoogleOAuthStateError) => error.reason === "missing-secret",
    );
  });
});

describe("Google OAuth state · forgery and malformed input", () => {
  it("rejects a forged payload and a forged signature", () => {
    const created = createGoogleOAuthState(binding(), SECRET, { now: NOW });
    const [encoded, signature] = created.state.split(".");
    const forgedClaims = claimsOf(created);
    forgedClaims.userId = "user_attacker";
    const forgedEncoded = Buffer.from(JSON.stringify(forgedClaims), "utf8").toString(
      "base64url",
    );
    const forgedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

    for (const state of [
      `${forgedEncoded}.${signature}`,
      `${encoded}.${forgedSignature}`,
    ]) {
      assert.throws(
        () => verifyGoogleOAuthState(state, expected(created), SECRET, NOW + 1),
        (error: GoogleOAuthStateError) =>
          error.reason === "invalid-state" &&
          !error.message.includes(state) &&
          !error.message.includes(created.nonce),
      );
    }
  });

  it("rejects malformed, non-canonical, and wrong-secret states", () => {
    const created = createGoogleOAuthState(binding(), SECRET, { now: NOW });
    const validClaims = claimsOf(created);
    const reordered = {
      nonce: validClaims.nonce,
      version: validClaims.version,
      userId: validClaims.userId,
      sessionId: validClaims.sessionId,
      projectId: validClaims.projectId,
      intent: validClaims.intent,
      issuedAt: validClaims.issuedAt,
      expiresAt: validClaims.expiresAt,
    };
    const withExtraField = { ...validClaims, accessToken: "must-never-parse" };

    for (const state of [
      "",
      "one-part",
      "one.two.three",
      "not+base64url.signature",
      signedPayload([]),
      signedPayload(reordered),
      signedPayload(withExtraField),
    ]) {
      assert.throws(
        () => verifyGoogleOAuthState(state, expected(created), SECRET, NOW + 1),
        (error: GoogleOAuthStateError) => error.reason === "invalid-state",
      );
    }

    assert.throws(
      () =>
        verifyGoogleOAuthState(
          created.state,
          expected(created),
          OTHER_SECRET,
          NOW + 1,
        ),
      (error: GoogleOAuthStateError) => error.reason === "invalid-state",
    );
  });

  it("rejects a correctly signed payload with an intent outside the allowlist", () => {
    const created = createGoogleOAuthState(binding(), SECRET, { now: NOW });
    const disallowedIntent = {
      ...claimsOf(created),
      intent: "delete-google-drive",
    };

    assert.throws(
      () =>
        verifyGoogleOAuthState(
          signedPayload(disallowedIntent),
          expected(created),
          SECRET,
          NOW + 1,
        ),
      (error: GoogleOAuthStateError) => error.reason === "invalid-state",
    );
  });
});

describe("Google OAuth state · time limits", () => {
  it("rejects expiry at the boundary", () => {
    const created = createGoogleOAuthState(binding(), SECRET, {
      now: NOW,
      ttlSeconds: 60,
    });
    assert.throws(
      () =>
        verifyGoogleOAuthState(
          created.state,
          expected(created),
          SECRET,
          NOW + 60,
        ),
      (error: GoogleOAuthStateError) => error.reason === "expired",
    );
  });

  it("rejects a state issued beyond the small clock-skew allowance", () => {
    const created = createGoogleOAuthState(binding(), SECRET, {
      now: NOW + 31,
    });
    assert.throws(
      () => verifyGoogleOAuthState(created.state, expected(created), SECRET, NOW),
      (error: GoogleOAuthStateError) => error.reason === "future-issued",
    );
  });

  it("never creates or accepts a lifetime over ten minutes", () => {
    assert.throws(
      () =>
        createGoogleOAuthState(binding(), SECRET, {
          now: NOW,
          ttlSeconds: GOOGLE_OAUTH_STATE_MAX_TTL_SECONDS + 1,
        }),
      (error: GoogleOAuthStateError) => error.reason === "invalid-lifetime",
    );
    assert.throws(
      () =>
        createGoogleOAuthState(binding(), SECRET, {
          now: Number.MAX_SAFE_INTEGER,
          ttlSeconds: 1,
        }),
      (error: GoogleOAuthStateError) => error.reason === "invalid-lifetime",
    );

    const created = createGoogleOAuthState(binding(), SECRET, { now: NOW });
    const tooLong = claimsOf(created);
    tooLong.expiresAt = NOW + GOOGLE_OAUTH_STATE_MAX_TTL_SECONDS + 1;
    assert.throws(
      () =>
        verifyGoogleOAuthState(
          signedPayload(tooLong),
          expected(created),
          SECRET,
          NOW + 1,
        ),
      (error: GoogleOAuthStateError) => error.reason === "invalid-state",
    );
  });
});

describe("Google OAuth state · callback binding", () => {
  it("rejects the wrong nonce, session, user, Project, or allowlisted intent", () => {
    const created = createGoogleOAuthState(binding(), SECRET, { now: NOW });
    const wrongNonce = randomBytes(32).toString("base64url");
    const cases: GoogleOAuthStateExpectation[] = [
      expected(created, { nonce: wrongNonce }),
      expected(created, { sessionId: "sess_someone-else" }),
      expected(created, { userId: "user_someone-else" }),
      expected(created, { projectId: "ws-another-project" }),
      expected(created, { intent: "reconnect-google-drive" }),
    ];

    for (const wrongBinding of cases) {
      assert.throws(
        () =>
          verifyGoogleOAuthState(
            created.state,
            wrongBinding,
            SECRET,
            NOW + 1,
          ),
        (error: GoogleOAuthStateError) =>
          error.reason === "binding-mismatch",
      );
    }
  });
});

describe("Google OAuth state · secret strength", () => {
  it("refuses a secret shorter than 32 bytes on create, verify, and env read", () => {
    const created = createGoogleOAuthState(binding(), SECRET, { now: NOW });
    const weak = "too-short";

    assert.throws(
      () => createGoogleOAuthState(binding(), weak, { now: NOW }),
      (error: GoogleOAuthStateError) => error.reason === "weak-secret",
    );
    assert.throws(
      () =>
        verifyGoogleOAuthState(
          created.state,
          expected(created),
          weak,
          NOW + 1,
        ),
      (error: GoogleOAuthStateError) => error.reason === "weak-secret",
    );
    assert.throws(
      () => googleOAuthStateSecretFromEnv({ OAUTH_STATE_SECRET: weak }),
      (error: GoogleOAuthStateError) => error.reason === "weak-secret",
    );
  });
});
