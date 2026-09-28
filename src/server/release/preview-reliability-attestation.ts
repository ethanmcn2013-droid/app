import { createHash, timingSafeEqual } from "node:crypto";
import { parsePublishableKey } from "@clerk/shared/keys";
import { resolveConversationControls } from "../../lib/conversations/flags";
import { resolveConversationRuntimeTarget } from "../conversations/runtime-target";

const STORE_KEYS = ["TASKS_DATABASE_URL", "NOTES_DATABASE_URL", "TIMELINE_DATABASE_URL", "SIGNAL_DATABASE_URL", "ENTITLEMENTS_DATABASE_URL"] as const;
const PROVIDER_KEYS = ["RESEND_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "GOOGLE_OAUTH_CLIENT_SECRET", "BLOB_READ_WRITE_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "AI_GATEWAY_API_KEY", "NOTES_TO_TASKS_SECRET", "NOTES_TO_TIMELINE_SECRET", "STUDIO_CRON_PING_SECRET"] as const;
const IDENTITY_OVERRIDE_KEYS = ["CLERK_DOMAIN", "NEXT_PUBLIC_CLERK_DOMAIN", "CLERK_PROXY_URL", "NEXT_PUBLIC_CLERK_PROXY_URL", "CLERK_IS_SATELLITE", "NEXT_PUBLIC_CLERK_IS_SATELLITE"] as const;
const headers = { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
type Environment = Readonly<Record<string, string | undefined>>;
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

function testIssuerHash(key: string | undefined): string | null {
  const parsed = parsePublishableKey(key);
  if (parsed?.instanceType !== "development") return null;
  try {
    const issuer = `https://${parsed.frontendApi}`;
    const url = new URL(issuer);
    if (url.origin !== issuer || url.username || url.password || url.port) return null;
    return sha(issuer);
  } catch { return null; }
}

/** Short-lived, read-only preview receipt. Never reads records or enables writes. */
export function previewReliabilityAttestation(request: Request, env: Environment, now = Date.now()): Response {
  const hidden = () => new Response(null, { status: 404, headers });
  const until = Number(env.SIGNAL_RELIABILITY_ATTEST_UNTIL_MS);
  const token = env.SIGNAL_RELIABILITY_ATTEST_TOKEN ?? "";
  const presented = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (request.method !== "GET" || env.VERCEL !== "1" || env.VERCEL_ENV !== "preview" ||
      env.VERCEL_TARGET_ENV !== "preview" || env.NODE_ENV !== "production" ||
      env.SIGNAL_RELIABILITY_ATTEST !== "isolated-reliability-v1" ||
      !Number.isFinite(until) || until <= now || until - now > 6 * 60 * 60 * 1000 ||
      !/^[A-Za-z0-9_-]{43}$/.test(token) || !request.headers.get("authorization")?.startsWith("Bearer ") ||
      Buffer.byteLength(presented) !== Buffer.byteLength(token) ||
      !timingSafeEqual(Buffer.from(presented), Buffer.from(token))) return hidden();
  const origin = env.SIGNAL_RELIABILITY_ORIGIN ?? (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined);
  // Diagnostics disclose only fixed predicates after the same short-lived Preview authentication gate.
  // They are not a runtime attestation and never supply substitute deployment or store identity.
  if (new URL(request.url).searchParams.get("diagnostic") === "1") {
    const controls = resolveConversationControls(env);
    const target = resolveConversationRuntimeTarget(env, false);
    return Response.json({ schema: "isolated-reliability-diagnostic/1", predicates: {
      originMatches: Boolean(origin) && new URL(request.url).origin === origin,
      originHttps: origin?.startsWith("https://") === true,
      testPublishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") === true,
      testSecretKey: env.CLERK_SECRET_KEY?.startsWith("sk_test_") === true,
      deploymentIdFormat: /^dpl_[A-Za-z0-9]+$/.test(env.VERCEL_DEPLOYMENT_ID ?? ""),
      projectIdFormat: /^prj_[A-Za-z0-9]+$/.test(env.VERCEL_PROJECT_ID ?? ""),
      sourceShaFormat: /^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? ""),
      storesPresent: STORE_KEYS.every(key => Boolean(env[key])),
      providersDisabled: !PROVIDER_KEYS.some(key => Boolean(env[key])),
      serverAccessProduction: env.SIGNAL_ACCESS_MODE === "production",
      publicAccessProduction: env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE === "production",
      identityOverridesAbsent: !IDENTITY_OVERRIDE_KEYS.some(key => Boolean(env[key])),
      testIssuerParseable: testIssuerHash(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) !== null,
      conversationInternalEnabled: controls.internalEnabled,
      conversationSendsEnabled: controls.sendsEnabled,
      conversationDeliveryDisabled: !controls.deliveryEnabled,
      conversationDirectMessagesDisabled: !controls.directMessagesEnabled,
      twoConversationActors: controls.allowedActorIds.size === 2,
      conversationRemoteTarget: target.mode === "remote",
    } }, { headers });
  }
  if (!origin || new URL(request.url).origin !== origin || !origin.startsWith("https://") ||
      !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") || !env.CLERK_SECRET_KEY?.startsWith("sk_test_") ||
      !/^dpl_[A-Za-z0-9]+$/.test(env.VERCEL_DEPLOYMENT_ID ?? "") ||
      !/^prj_[A-Za-z0-9]+$/.test(env.VERCEL_PROJECT_ID ?? "") ||
      !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? "") ||
      !STORE_KEYS.every(key => Boolean(env[key])) || PROVIDER_KEYS.some(key => Boolean(env[key]))) return hidden();
  // Both explicit inputs prevent Preview's default review/seed-data posture.
  if (env.SIGNAL_ACCESS_MODE !== "production" || env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE !== "production" ||
      IDENTITY_OVERRIDE_KEYS.some(key => Boolean(env[key]))) return hidden();
  const identityIssuerHash = testIssuerHash(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const controls = resolveConversationControls(env);
  const target = resolveConversationRuntimeTarget(env, false);
  if (!identityIssuerHash || !controls.internalEnabled || !controls.sendsEnabled ||
      controls.deliveryEnabled || controls.directMessagesEnabled || controls.allowedActorIds.size !== 2 ||
      target.mode !== "remote") return hidden();
  return Response.json({
    schema: "isolated-reliability-runtime/2", sourceSha: env.VERCEL_GIT_COMMIT_SHA,
    projectId: env.VERCEL_PROJECT_ID, deploymentId: env.VERCEL_DEPLOYMENT_ID,
    vercelEnvironment: env.VERCEL_ENV, vercelTargetEnvironment: env.VERCEL_TARGET_ENV,
    region: env.VERCEL_REGION ?? null, origin, nodeVersion: process.versions.node,
    stores: Object.fromEntries(STORE_KEYS.map(key => [key, sha(env[key]!)])),
    identityProviderHash: sha(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    identityIssuerHash, accessMode: "production",
    conversationControls: {
      internalEnabled: controls.internalEnabled, sendsEnabled: controls.sendsEnabled,
      deliveryEnabled: controls.deliveryEnabled, directMessagesEnabled: controls.directMessagesEnabled,
      allowedActorHashes: [...controls.allowedActorIds].map(sha).sort(),
      guestsEnabled: controls.guestsEnabled, attachmentsEnabled: controls.attachmentsEnabled, aiEnabled: controls.aiEnabled,
    },
    conversationRuntime: { mode: target.mode, databaseUrlHash: sha(target.url) },
    // Native attachment metadata uses Tasks; Vercel without a Blob token rejects byte writes.
    attachments: { metadataStore: "tasks", databaseUrlHash: sha(env.TASKS_DATABASE_URL!), byteStorageMode: "vercel-no-token", bytesEnabled: false },
    externalProvidersDisabled: true, externalDeliveryDisabled: true, observedAt: new Date(now).toISOString(),
  }, { headers });
}
