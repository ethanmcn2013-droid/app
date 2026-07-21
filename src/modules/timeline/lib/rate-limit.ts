/**
 * rate-limit.ts, IP-based rate limiting for public Server Actions.
 *
 * Strategy:
 *   - Production with UPSTASH_REDIS_REST_URL set: uses @upstash/redis
 *     sliding-window counter via plain HTTP (no SDK required, avoids
 *     an optional install dependency).
 *   - Development / no Redis env: in-memory Map with TTL eviction.
 *     Resets on server restart; fine for local dev.
 *
 * Usage:
 *   const result = await checkRateLimit("create-workspace", ip, 5, 60);
 *   if (!result.allowed) {
 *     if (result.reason === "config-miss") {
 *       return { error: "This isn't available right now. Try again shortly." };
 *     }
 *     return { error: "Too many requests. Try again in a minute." };
 *   }
 */

// ---------------------------------------------------------------------------
// In-memory fallback (dev / no-Redis)
// ---------------------------------------------------------------------------

type MemEntry = { count: number; resetAt: number };
const memStore = new Map<string, MemEntry>();

function memRateLimit(key: string, limit: number, windowSecs: number): boolean {
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowSecs * 1000 });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Upstash HTTP rate-limit (production)
// Avoids SDK install, atomic INCR + EXPIRE NX via Upstash REST pipeline.
// ---------------------------------------------------------------------------

async function upstashRateLimit(
  key: string,
  limit: number,
  windowSecs: number,
): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url) throw new Error("[rate-limit] UPSTASH_REDIS_REST_URL is required when Upstash is configured");
  if (!token) throw new Error("[rate-limit] UPSTASH_REDIS_REST_TOKEN is required when Upstash is configured");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Atomic pipeline: INCR then EXPIRE key <windowSecs> NX in one HTTP call.
  //
  // EXPIRE ... NX (Redis 7+ / Upstash) sets the TTL only when the key has
  // NO existing expiry. This is the idempotent shape:
  //   - Normal path (count > 1, TTL already set): EXPIRE NX is a no-op.
  //   - Race / eviction path (TTL silently lost): EXPIRE NX re-arms the window.
  //   - New key (count === 1): EXPIRE NX sets the initial TTL.
  //
  // A single pipeline round-trip closes the race window that existed between
  // the prior two-request INCR → conditional EXPIRE sequence.
  const pipelineRes = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSecs), "NX"],
    ]),
  });

  if (!pipelineRes.ok) {
    if (process.env.NODE_ENV === "production") {
      // Redis unavailable in prod, fail closed. Brute-force protection
      // must hold even when Redis is down.
      console.error("[rate-limit] Upstash pipeline failed in prod, denying request:", pipelineRes.status);
      // TODO(roadmap-02): Sentry capture once @sentry/nextjs is wired in
      //   this repo, Sentry.captureException(new Error(...), {
      //     tags: { component: 'rate-limit', reason: 'upstash-unreachable' }
      //   });
      //   See audit/roadmap-audit.md (P1). Not adding the dep just for this.
      return false;
    }
    // Dev: fail open so local development is unblocked.
    console.warn("[rate-limit] Upstash pipeline failed:", pipelineRes.status);
    return true;
  }

  const pipeline = (await pipelineRes.json()) as [{ result: number }, { result: number }];
  const count = pipeline[0].result;

  return count <= limit;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Outcome of a rate-limit check.
 *
 * - `allowed: true` , request may proceed.
 * - `allowed: false, reason: "quota"`     , real rate-limit hit; surface
 *   "Too many requests" to the user (their fault).
 * - `allowed: false, reason: "config-miss"`, Upstash env vars absent in
 *   production; request denied for safety but the user is blameless.
 *   Surface "This isn't available right now. Try again shortly." instead.
 */
export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "quota" | "config-miss" };

/**
 * Check whether `ip` has exceeded `limit` calls for `action` within
 * a `windowSecs` sliding window.
 *
 * Returns a `RateLimitResult`, inspect `.allowed` and, when false, `.reason`
 * to surface an honest message. Never lie to the user that they hit a quota
 * when the real cause is a missing operator configuration.
 *
 * Production behaviour:
 *   - Upstash configured: uses Redis sliding-window counter.
 *   - Upstash NOT configured: fails closed (deny, reason: "config-miss") —
 *     brute-force protection must hold even when Redis env vars are missing.
 *
 * Development behaviour:
 *   - Upstash configured: uses Redis (same as prod).
 *   - Upstash NOT configured: falls back to in-memory store (fail-open).
 */
export async function checkRateLimit(
  action: string,
  ip: string,
  limit: number,
  windowSecs: number,
): Promise<RateLimitResult> {
  const key = `rl:${action}:${ip}`;

  const upstashConfigured =
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

  if (upstashConfigured) {
    const allowed = await upstashRateLimit(key, limit, windowSecs);
    return allowed ? { allowed: true } : { allowed: false, reason: "quota" };
  }

  if (process.env.NODE_ENV === "production") {
    // No Redis in prod, fail closed, but signal the real cause so callers
    // can show an honest "service unavailable" message rather than blaming
    // the user for hitting a quota they never hit.
    console.error("[rate-limit] Upstash not configured in production, denying request for safety.");
    return { allowed: false, reason: "config-miss" };
  }

  // Dev / test: in-memory fallback (fail-open).
  const allowed = memRateLimit(key, limit, windowSecs);
  return allowed ? { allowed: true } : { allowed: false, reason: "quota" };
}

/**
 * Extract the best-guess client IP from Next.js request headers.
 * Falls back to "unknown", rate-limited as a single shared bucket.
 *
 * `headers()` is async in Next 16, the sync require() pattern this
 * function had previously was throwing on every call and silently
 * collapsing every caller into the "unknown" bucket.
 */
export async function getClientIp(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    // Use || not ??: an empty/whitespace x-forwarded-for first segment is
    // "" (not nullish), so ?? would NOT fall through and would collapse
    // every such request into one shared rate-limit bucket.
    const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return xff || h.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}
