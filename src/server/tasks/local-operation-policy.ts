import { fileURLToPath } from "node:url";
import { isAbsolute, relative, resolve } from "node:path";

const modules = ["TASKS", "NOTES", "TIMELINE", "SIGNAL", "ENTITLEMENTS"] as const;
type Environment = Readonly<Record<string, string | undefined>>;
export function assertLocalOperationNotExpired(env: Environment = process.env) {
  if (env.SIGNAL_LOCAL_TASK_OPERATIONS !== "true") return;
  const expiry = Date.parse(env.SIGNAL_LOCAL_TASK_EXPIRES_AT ?? "");
  if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error("Local admission expired");
}
export function localClerkOrigins(env: Environment = process.env): string[] {
  let origins: unknown;
  try { origins = JSON.parse(env.SIGNAL_LOCAL_TASK_CLERK_ORIGINS ?? ""); } catch { throw new Error("Exact Clerk origins required"); }
  if (!Array.isArray(origins) || origins.length > 6 || !origins.includes(env.SIGNAL_LOCAL_TASK_ISSUER) || new Set(origins).size !== origins.length || origins.some(origin => { try { const url = new URL(origin); return typeof origin !== "string" || url.protocol !== "https:" || url.origin !== origin; } catch { return true; } })) throw new Error("Invalid Clerk origins");
  return origins;
}
export function localFetchAllowed(url: string, env: Environment = process.env, method = "GET") {
  assertLocalOperationNotExpired(env);
  const origin = new URL(url).origin;
  // Server-side ordinary verification/current-user reads may leave the loopback
  // process; provider account mutations are never part of this fixture runtime.
  return origin === env.SIGNAL_LOCAL_TASK_ORIGIN || (["GET", "HEAD"].includes(method.toUpperCase()) && localClerkOrigins(env).includes(origin));
}
export function validateLocalOperationRuntime(env: Environment = process.env) {
  if (env.SIGNAL_LOCAL_TASK_OPERATIONS !== "true") throw new Error("Local operations disabled");
  assertLocalOperationNotExpired(env);
  localClerkOrigins(env);
  if (env.VERCEL || env.VERCEL_ENV || env.NEXT_PUBLIC_DEMO_MODE === "true" || env.DEMO_MODE === "true" ||
    env.SIGNAL_ACCESS_MODE !== "production" || env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE !== "production") throw new Error("Invalid local access mode");
  const origin = env.SIGNAL_LOCAL_TASK_ORIGIN;
  if (!origin || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{3,4}$/.test(origin) || new URL(origin).port === "") throw new Error("Invalid local origin");
  if (!env.SIGNAL_LOCAL_TASK_ISSUER || !/^https:\/\/[a-z0-9-]+\.clerk\.accounts\.dev$/.test(env.SIGNAL_LOCAL_TASK_ISSUER) ||
    !env.SIGNAL_LOCAL_TASK_SUBJECTS || env.SIGNAL_LOCAL_TASK_SUBJECTS.split(",").length !== 2 ||
    new Set(env.SIGNAL_LOCAL_TASK_SUBJECTS.split(",")).size !== 2 || env.SIGNAL_LOCAL_TASK_SUBJECTS.split(",").some(id => !/^user_[A-Za-z0-9]+$/.test(id)) ||
    !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") || !env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Invalid development identity configuration");
  const ownedRoot = env.SIGNAL_LOCAL_TASK_STORE_ROOT;
  if (!ownedRoot || !isAbsolute(ownedRoot)) throw new Error("Missing owned store root");
  const root = resolve(ownedRoot);
  const paths = new Set<string>();
  for (const module of modules) {
    const url = env[`${module}_DATABASE_URL`];
    if (!url || !url.startsWith("file:") || env[`${module}_AUTH_TOKEN`]) throw new Error("Invalid local store");
    let path: string;
    try { path = resolve(fileURLToPath(url)); } catch { throw new Error("Invalid local store"); }
    const inside = relative(root, path);
    if (!inside || inside.startsWith("..") || isAbsolute(inside) || paths.has(path.toLowerCase())) throw new Error("Store ownership mismatch");
    paths.add(path.toLowerCase());
  }
  const forbidden = ["RESEND_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "BLOB_READ_WRITE_TOKEN", "CRON_SECRET", "STUDIO_CRON_PING_URL", "STUDIO_CRON_PING_SECRET", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "AI_GATEWAY_API_KEY", "SPONSOR_USAGE_HASH_SALT", "POSTHOG_API_KEY"];
  if (env.SPONSOR_USAGE_EVENTS === "1") throw new Error("Local runtime disables sponsor delivery");
  if (forbidden.some(key => !!env[key]) || Object.entries(env).some(([key, value]) => key.startsWith("SIGNAL_PROJECT_DRIVE_") && value === "true")) throw new Error("External effects configured");
  return { origin, root };
}
export function localOperationRequestAllowed(request: Request, env: Environment = process.env) {
  try {
    const { origin } = validateLocalOperationRuntime(env);
    const url = new URL(request.url);
    const suppliedOrigin = request.headers.get("origin");
    // Same-origin browser GET fetches normally omit Origin. Require both
    // browser Fetch Metadata and exact-origin Referer in that read-only case.
    const sameOriginGet = request.method === "GET" && suppliedOrigin === null && request.headers.get("sec-fetch-site") === "same-origin" &&
      ["cors", "same-origin"].includes(request.headers.get("sec-fetch-mode") ?? "") && new URL(request.headers.get("referer") ?? "").origin === origin;
    // Next 16 base-server supplies this tuple on ordinary direct requests.
    // It may corroborate the exact transport, never reinterpret its authority.
    const expected = new URL(origin);
    const forwardedMatches = [["x-forwarded-host", expected.host], ["x-forwarded-proto", "http"], ["x-forwarded-port", expected.port], ["x-forwarded-for", "127.0.0.1"]]
      .every(([name, value]) => !request.headers.has(name) || request.headers.get(name) === value);
    return url.origin === origin && request.headers.get("host") === new URL(origin).host && (suppliedOrigin === origin || sameOriginGet) &&
      forwardedMatches && !request.headers.has("forwarded");
  } catch { return false; }
}
