import { createHmac, timingSafeEqual } from "node:crypto";

export type CrossProductAssertion = {
  v: 1;
  iss: "signal-notes";
  aud: "signal-tasks.notes-extract";
  sub: string;
  noteId: string;
  iat: number;
  exp: number;
  jti: string;
  traceId: string;
};

const MAX_TTL_SECONDS = 300;

/** Verify a Notes assertion before using its subject for any database query. */
export function verifyNotesAssertion(
  assertion: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): CrossProductAssertion {
  const [encoded, presented] = assertion.split(".");
  if (!encoded || !presented || presented.length < 32) throw new Error("invalid assertion");
  const expected = createHmac("sha256", secret).update(encoded).digest();
  const received = Buffer.from(presented, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(expected, received)) throw new Error("invalid assertion");
  let claims: Partial<CrossProductAssertion>;
  try {
    claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<CrossProductAssertion>;
  } catch {
    throw new Error("invalid assertion");
  }
  if (
    claims.v !== 1 || claims.iss !== "signal-notes" || claims.aud !== "signal-tasks.notes-extract" ||
    typeof claims.sub !== "string" || typeof claims.noteId !== "string" ||
    typeof claims.iat !== "number" || typeof claims.exp !== "number" ||
    typeof claims.jti !== "string" || typeof claims.traceId !== "string" ||
    claims.exp <= now || claims.iat > now + 30 || claims.exp - claims.iat > MAX_TTL_SECONDS
  ) throw new Error("invalid assertion");
  return claims as CrossProductAssertion;
}
