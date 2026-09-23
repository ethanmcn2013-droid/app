import { createHash, timingSafeEqual } from "node:crypto";

export const PRODUCTION_BINDING_ATTESTATION_MARKER = "production-runtime-bindings-v1";

const STORE_URL_KEYS = [
  "TASKS_DATABASE_URL",
  "NOTES_DATABASE_URL",
  "TIMELINE_DATABASE_URL",
  "SIGNAL_DATABASE_URL",
  "ENTITLEMENTS_DATABASE_URL",
] as const;

type StoreUrlKey = (typeof STORE_URL_KEYS)[number];
type Environment = Readonly<Record<string, string | undefined>>;
type ExpectedHashes = Readonly<Record<StoreUrlKey, string>>;
const MAX_BODY_BYTES = 1024;
const MAX_ATTESTATION_WINDOW_MS = 2 * 60 * 60 * 1000;

export const ATTESTATION_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
} as const;

export function hiddenAttestationResponse(): Response {
  return new Response(null, { status: 404, headers: ATTESTATION_RESPONSE_HEADERS });
}

function validBearer(request: Request, secret: string | undefined): boolean {
  // The operator provisions 32 fresh random bytes, base64url-encoded. This
  // checks format and size; freshness and custody are release-runbook gates.
  if (!secret || !/^[A-Za-z0-9_-]{43}$/.test(secret)) return false;
  const decoded = Buffer.from(secret, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== secret) return false;
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const presented = authorization.slice("Bearer ".length);
  if (presented.length !== secret.length) return false;
  const expectedBytes = Buffer.from(secret);
  const presentedBytes = Buffer.from(presented);
  return presentedBytes.length === expectedBytes.length &&
    timingSafeEqual(presentedBytes, expectedBytes);
}

function receivingWindowOpen(env: Environment, nowMs: number): boolean {
  if (env.SIGNAL_PRODUCTION_BINDING_ATTESTATION !== PRODUCTION_BINDING_ATTESTATION_MARKER ||
    env.VERCEL !== "1" || env.VERCEL_ENV !== "production" ||
    env.VERCEL_TARGET_ENV !== "production" || env.NODE_ENV !== "production" ||
    !/^dpl_[A-Za-z0-9]+$/.test(env.VERCEL_DEPLOYMENT_ID ?? "") ||
    !/^prj_[A-Za-z0-9]+$/.test(env.VERCEL_PROJECT_ID ?? "")) return false;
  const until = env.SIGNAL_PRODUCTION_BINDING_ATTESTATION_UNTIL_MS ?? "";
  if (!/^\d{13}$/.test(until)) return false;
  const remaining = Number(until) - nowMs;
  return Number.isFinite(remaining) && remaining > 0 && remaining <= MAX_ATTESTATION_WINDOW_MS;
}

async function readExpectedHashes(request: Request): Promise<ExpectedHashes | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "") ||
    !request.body) return null;
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(Buffer.from(value));
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (Object.keys(record).length !== STORE_URL_KEYS.length ||
      !STORE_URL_KEYS.every((key) => typeof record[key] === "string" &&
        /^[0-9a-f]{64}$/.test(record[key]))) return null;
    return record as ExpectedHashes;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/** A value-only, read-only comparison against this Function's own bindings. */
export async function attestProductionRuntimeBindings(
  request: Request,
  env: Environment,
  nowMs = Date.now(),
): Promise<Response> {
  if (request.method !== "POST" || !receivingWindowOpen(env, nowMs) ||
    !validBearer(request, env.SIGNAL_PRODUCTION_BINDING_ATTESTATION_TOKEN)) {
    return hiddenAttestationResponse();
  }

  const expected = await readExpectedHashes(request);
  if (!expected) {
    return new Response(null, { status: 400, headers: ATTESTATION_RESPONSE_HEADERS });
  }

  const matches = Object.fromEntries(STORE_URL_KEYS.map((key) => {
    const url = env[key];
    return [key, typeof url === "string" && url.length > 0 &&
      createHash("sha256").update(url).digest("hex") === expected[key]];
  })) as Record<StoreUrlKey, boolean>;
  const sourceSha = env.VERCEL_GIT_COMMIT_SHA;
  return Response.json({
    allMatch: STORE_URL_KEYS.every((key) => matches[key]),
    matches,
    deployment: {
      id: env.VERCEL_DEPLOYMENT_ID,
      projectId: env.VERCEL_PROJECT_ID,
      sourceSha: sourceSha && /^[0-9a-f]{40}$/.test(sourceSha) ? sourceSha : null,
    },
  }, { headers: ATTESTATION_RESPONSE_HEADERS });
}
