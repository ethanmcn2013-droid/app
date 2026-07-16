import "server-only";

/**
 * Per-caller rate limiting for Signal Tasks.
 *
 * Behavioural twin of `analytics/src/lib/ratelimit.ts`, same public
 * `allow(name, identifier, limit, window)` contract and the same two
 * guarantees, but implemented over the Upstash Redis REST API with
 * `fetch` instead of the `@upstash/*` SDK. Tasks doesn't carry those deps,
 * and the contract here is identical, so we avoid adding a dependency just
 * to call a one-line REST endpoint.
 *
 * Production fails closed when the remote limiter is missing or unhealthy.
 * These buckets protect cost-bearing or abuse-prone operations, so temporary
 * feature unavailability is safer than unbounded provider spend. Local
 * development remains usable without external infrastructure.
 *   - Fixed window via INCR + EXPIRE NX: the first request in a window sets
 *     the TTL, subsequent requests only increment. The window does NOT
 *     slide forward on each hit (NX), so a steady caller isn't permanently
 *     blocked, the counter resets `window` after the first request.
 *
 * Operator: provision Upstash Redis (Vercel → Integrations → Upstash) and
 * add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to the Tasks
 * project. No code change needed to turn it on. (On the HQ operator ledger.)
 */

type Duration = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const UNIT_SECONDS: Record<string, number> = {
  ms: 1 / 1000,
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
};

/** Convert a `"1 m"`-style duration to whole seconds (min 1) for EXPIRE. */
function windowSeconds(window: Duration): number {
  const [rawN, unit] = window.split(" ");
  const n = Number(rawN);
  const secs = (Number.isFinite(n) ? n : 0) * (UNIT_SECONDS[unit] ?? 0);
  return Math.max(1, Math.ceil(secs));
}

/** Best-effort client IP for anonymous routes (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Returns true if the request is within the limit. Allows (returns true)
 * when Upstash is unconfigured OR errors, see the gated / fail-open notes.
 *
 * @param name        logical bucket, e.g. "ai", namespaces the keys
 * @param identifier  the caller key, a userId or an IP
 * @param limit       max requests permitted per window
 * @param window      window size, e.g. "1 m"
 */
export async function allow(
  name: string,
  identifier: string,
  limit: number,
  window: Duration,
): Promise<boolean> {
  const unavailableDecision = process.env.NODE_ENV !== "production";
  if (!url || !token) return unavailableDecision;

  const key = `signal:rl:${name}:${identifier}`;
  const ttl = windowSeconds(window);
  try {
    // Atomic pipeline: bump the counter, then set the TTL only if the key
    // is new (NX). The first response element is the post-increment count.
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(ttl), "NX"],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return unavailableDecision;
    const data = (await res.json()) as Array<{ result?: unknown }>;
    const count = Number(data?.[0]?.result ?? 0);
    if (!Number.isFinite(count) || count <= 0) return unavailableDecision;
    return count <= limit;
  } catch {
    return unavailableDecision;
  }
}
