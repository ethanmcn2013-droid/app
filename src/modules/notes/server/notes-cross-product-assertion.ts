import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

/**
 * Short-lived, audience-bound assertion used for server-to-server calls.
 *
 * The assertion carries the already-authenticated subject, so the receiving
 * product never has to trust a user id supplied in a mutable request body.
 * This is intentionally a small HMAC envelope rather than a general JWT
 * dependency: both products already share a secret and need one narrow seam.
 */
/** Legacy v1 assertion retained only for the rollback endpoint. */
export type CrossProductAssertion = {
  v: 1;
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

/** Exact-body-bound assertion required by the Notes -> Tasks extract route. */
export type TasksExtractAssertionV2 = {
  v: 2;
  iss: "signal-notes";
  aud: "signal-tasks.notes-extract";
  sub: string;
  noteId: string;
  workspaceId: string;
  approvedBodySha256: string;
  iat: number;
  exp: number;
  jti: string;
  traceId: string;
};

const MAX_TTL_SECONDS = 300;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/** Legacy v1 creator for `/api/notes-extract`; never use for the v2 route. */
export function createTasksAssertion(
  subject: string,
  noteId: string,
  workspaceId: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): string {
  const claims: CrossProductAssertion = {
    v: 1,
    iss: "signal-notes",
    aud: "signal-tasks.notes-extract",
    sub: subject,
    noteId,
    workspaceId,
    iat: now,
    exp: now + MAX_TTL_SECONDS,
    jti: randomUUID(),
    traceId: randomUUID(),
  };
  const encoded = encode(claims);
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

/**
 * v2 binds the exact approved UTF-8 body fingerprint into the signed envelope.
 * The Tasks receiver must reject v1 for the notes-extract endpoint.
 */
export function createTasksExtractAssertionV2(
  subject: string,
  noteId: string,
  workspaceId: string,
  approvedBodySha256: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): string {
  if (!SHA256_PATTERN.test(approvedBodySha256)) {
    throw new Error("invalid approved body fingerprint");
  }
  const claims: TasksExtractAssertionV2 = {
    v: 2,
    iss: "signal-notes",
    aud: "signal-tasks.notes-extract",
    sub: subject,
    noteId,
    workspaceId,
    approvedBodySha256,
    iat: now,
    exp: now + MAX_TTL_SECONDS,
    jti: randomUUID(),
    traceId: randomUUID(),
  };
  const encoded = encode(claims);
  const signature = createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

export function createTasksPersonalizationAssertion(
  subject: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): string {
  const claims = {
    v: 1 as const,
    iss: "signal-notes" as const,
    aud: "signal-tasks.workspace-personalization" as const,
    sub: subject,
    iat: now,
    exp: now + MAX_TTL_SECONDS,
    jti: randomUUID(),
    traceId: randomUUID(),
  };
  const encoded = encode(claims);
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}

/** Verify shape and signature locally before sending the assertion onward. */
export function assertTasksAssertion(
  assertion: string,
  secret: string,
  expectedSubject: string,
  expectedNoteId: string,
  expectedWorkspaceId: string,
  now = Math.floor(Date.now() / 1000),
): CrossProductAssertion {
  const parts = assertion.split(".");
  const [encoded, presented] = parts;
  if (parts.length !== 2 || !encoded || !presented || presented.length < 32) {
    throw new Error("invalid assertion");
  }
  const expected = createHmac("sha256", secret)
    .update(encoded)
    .digest();
  const received = Buffer.from(presented, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(expected, received)) {
    throw new Error("invalid assertion");
  }
  let claims: Partial<CrossProductAssertion>;
  try {
    claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<CrossProductAssertion>;
  } catch {
    throw new Error("invalid assertion");
  }
  if (
    claims.v !== 1 ||
    claims.iss !== "signal-notes" ||
    claims.aud !== "signal-tasks.notes-extract" ||
    typeof claims.sub !== "string" ||
    claims.sub !== expectedSubject ||
    typeof claims.noteId !== "string" ||
    claims.noteId !== expectedNoteId ||
    typeof claims.workspaceId !== "string" ||
    claims.workspaceId !== expectedWorkspaceId ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    typeof claims.jti !== "string" ||
    typeof claims.traceId !== "string" ||
    claims.exp <= now ||
    claims.iat > now + 30 ||
    claims.exp - claims.iat > MAX_TTL_SECONDS
  ) {
    throw new Error("invalid assertion");
  }
  return claims as CrossProductAssertion;
}

/** Local verifier/contract fixture for the v2 exact extract assertion. */
export function assertTasksExtractAssertionV2(
  assertion: string,
  secret: string,
  expectedSubject: string,
  expectedNoteId: string,
  expectedWorkspaceId: string,
  expectedApprovedBodySha256: string,
  now = Math.floor(Date.now() / 1000),
): TasksExtractAssertionV2 {
  if (!SHA256_PATTERN.test(expectedApprovedBodySha256)) {
    throw new Error("invalid assertion");
  }
  const parts = assertion.split(".");
  const [encoded, presented] = parts;
  if (parts.length !== 2 || !encoded || !presented || presented.length < 32) {
    throw new Error("invalid assertion");
  }
  const expected = createHmac("sha256", secret).update(encoded).digest();
  const received = Buffer.from(presented, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(expected, received)) {
    throw new Error("invalid assertion");
  }

  let claims: Partial<TasksExtractAssertionV2>;
  try {
    claims = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<TasksExtractAssertionV2>;
  } catch {
    throw new Error("invalid assertion");
  }
  if (
    claims.v !== 2 ||
    claims.iss !== "signal-notes" ||
    claims.aud !== "signal-tasks.notes-extract" ||
    claims.sub !== expectedSubject ||
    claims.noteId !== expectedNoteId ||
    claims.workspaceId !== expectedWorkspaceId ||
    claims.approvedBodySha256 !== expectedApprovedBodySha256 ||
    !SHA256_PATTERN.test(claims.approvedBodySha256 ?? "") ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    typeof claims.jti !== "string" ||
    typeof claims.traceId !== "string" ||
    claims.exp <= now ||
    claims.iat > now + 30 ||
    claims.exp - claims.iat > MAX_TTL_SECONDS
  ) {
    throw new Error("invalid assertion");
  }
  return claims as TasksExtractAssertionV2;
}
