import { createHmac, timingSafeEqual } from "node:crypto";

type SharedNotesAssertion = {
  iss: "signal-notes";
  aud: "signal-tasks.notes-extract";
  sub: string;
  noteId: string;
  workspaceId: string;
  iat: number;
  exp: number;
  jti: string;
  traceId: string;
};

export type LegacyCrossProductAssertion = SharedNotesAssertion & { v: 1 };

export type CrossProductAssertion = SharedNotesAssertion & {
  v: 2;
  approvedBodySha256: string;
};

export type ExpectedNotesAssertion = Readonly<{
  noteId: string;
  workspaceId: string;
  approvedBodySha256: string;
}>;

const MAX_TTL_SECONDS = 300;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const seenJtis = new Map<string, number>();

function consumeJti(jti: string, exp: number, now: number): void {
  for (const [key, expiry] of seenJtis) {
    if (expiry <= now) seenJtis.delete(key);
  }
  if (seenJtis.has(jti)) throw new Error("replayed assertion");
  seenJtis.set(jti, exp);
}

function decodeSignedClaims(
  assertion: string,
  secret: string,
): Record<string, unknown> {
  const parts = assertion.split(".");
  const [encoded, presented] = parts;
  if (parts.length !== 2 || !encoded || !presented || presented.length < 32) {
    throw new Error("invalid assertion");
  }

  const expected = createHmac("sha256", secret).update(encoded).digest();
  const received = Buffer.from(presented, "base64url");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new Error("invalid assertion");
  }

  try {
    const claims: unknown = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );
    if (!claims || typeof claims !== "object" || Array.isArray(claims)) {
      throw new Error("invalid assertion");
    }
    return claims as Record<string, unknown>;
  } catch {
    throw new Error("invalid assertion");
  }
}

function hasValidSharedClaims(
  claims: Record<string, unknown>,
  now: number,
): claims is Record<string, unknown> & SharedNotesAssertion {
  return (
    claims.iss === "signal-notes" &&
    claims.aud === "signal-tasks.notes-extract" &&
    typeof claims.sub === "string" &&
    claims.sub.length > 0 &&
    typeof claims.noteId === "string" &&
    claims.noteId.length > 0 &&
    typeof claims.workspaceId === "string" &&
    claims.workspaceId.length > 0 &&
    typeof claims.iat === "number" &&
    Number.isSafeInteger(claims.iat) &&
    typeof claims.exp === "number" &&
    Number.isSafeInteger(claims.exp) &&
    typeof claims.jti === "string" &&
    claims.jti.length > 0 &&
    typeof claims.traceId === "string" &&
    claims.traceId.length > 0 &&
    claims.exp > now &&
    claims.iat <= now + 30 &&
    claims.exp > claims.iat &&
    claims.exp - claims.iat <= MAX_TTL_SECONDS
  );
}

/** Verify the rollback-only v1 protocol without allowing it on the v2 seam. */
export function verifyLegacyNotesAssertion(
  assertion: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): LegacyCrossProductAssertion {
  const claims = decodeSignedClaims(assertion, secret);
  if (claims.v !== 1 || !hasValidSharedClaims(claims, now)) {
    throw new Error("invalid assertion");
  }
  consumeJti(claims.jti, claims.exp, now);
  return claims as LegacyCrossProductAssertion;
}

/** Authenticate a v2 Notes assertion before reading or parsing its JSON body. */
export function verifyNotesAssertion(
  assertion: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): CrossProductAssertion {
  const claims = decodeSignedClaims(assertion, secret);
  if (
    claims.v !== 2 ||
    !hasValidSharedClaims(claims, now) ||
    typeof claims.approvedBodySha256 !== "string" ||
    !SHA256_HEX.test(claims.approvedBodySha256) ||
    !UUID.test(claims.jti) ||
    !UUID.test(claims.traceId)
  ) {
    throw new Error("invalid assertion");
  }
  consumeJti(claims.jti, claims.exp, now);
  return claims as CrossProductAssertion;
}

/** Bind the authenticated v2 claims to the parsed request without normalizing. */
export function assertNotesAssertionBindings(
  claims: CrossProductAssertion,
  expected: ExpectedNotesAssertion,
): void {
  if (
    !SHA256_HEX.test(expected.approvedBodySha256) ||
    claims.noteId !== expected.noteId ||
    claims.workspaceId !== expected.workspaceId ||
    claims.approvedBodySha256 !== expected.approvedBodySha256
  ) {
    throw new Error("invalid assertion");
  }
}
