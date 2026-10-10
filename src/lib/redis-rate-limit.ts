import "server-only";
import { opLog } from "../server/operational-log";

/** Shared, bounded Redis fixed-window check. No live requests on import. */
export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "quota" | "config-miss" | "unavailable" };

type RedisConfig = { url: string; token: string };
export const REDIS_TIMEOUT_MS = 1500;
function value(raw: string | undefined): string { return raw?.trim() ?? ""; }

/** Select a complete named pair; never mix credentials from two providers. */
export function redisConfig(): RedisConfig | null {
  const direct = [value(process.env.UPSTASH_REDIS_REST_URL), value(process.env.UPSTASH_REDIS_REST_TOKEN)];
  const marketplace = [value(process.env.KV_REST_API_URL), value(process.env.KV_REST_API_TOKEN)];
  const pair = direct.some(Boolean) ? direct : marketplace;
  if (!pair[0] || !pair[1]) return null;
  try {
    const url = new URL(pair[0]);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    return { url: url.origin, token: pair[1] };
  } catch { return null; }
}

/** Partial configuration must still enter callers' fail-closed path. */
export function isRedisConfigured(): boolean {
  return [process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN,
    process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN].some(raw => Boolean(value(raw)));
}

const lastWarning = new Map<string, number>();
function warn(reason: "config-miss" | "unavailable"): void {
  if (reason === "config-miss" && process.env.NODE_ENV !== "production") return;
  const now = Date.now();
  if (now - (lastWarning.get(reason) ?? -Infinity) < 60_000) return;
  lastWarning.set(reason, now);
  // Never include tokens, endpoints, keys, caller IDs, response bodies or errors.
  opLog("warn", "rate-limit", "Redis protection degraded", { reason });
}

export async function checkFixedWindow(key: string, limit: number, seconds: number): Promise<RateLimitResult> {
  if (!key || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(seconds) || seconds < 1) {
    throw new TypeError("Invalid rate-limit parameters");
  }
  const config = redisConfig();
  if (!config) { warn("config-miss"); return { allowed: false, reason: "config-miss" }; }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Redis check timed out")); }, REDIS_TIMEOUT_MS);
    });
    const operation = (async () => {
      // /pipeline is not atomic. MULTI/EXEC prevents interleaving. Redis does
      // not roll back individual command errors, so validate BOTH results.
      // Never retry INCR: a lost response may already have spent the attempt.
      const response = await fetch(`${config.url}/multi-exec`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", key], ["EXPIRE", key, String(seconds), "NX"]]),
        cache: "no-store", redirect: "error", signal: controller.signal,
      });
      if (!response.ok) throw new Error("Redis HTTP failure");
      const data: unknown = await response.json();
      if (!Array.isArray(data) || data.length !== 2) throw new Error("Redis response failure");
      const [increment, expiry] = data;
      if (!increment || !expiry || typeof increment !== "object" || typeof expiry !== "object" ||
          "error" in increment || "error" in expiry ||
          !Number.isSafeInteger(increment.result) || increment.result < 1 ||
          (expiry.result !== 0 && expiry.result !== 1)) throw new Error("Redis command failure");
      return increment.result <= limit ? { allowed: true } as const : { allowed: false, reason: "quota" } as const;
    })();
    return await Promise.race([operation, deadline]);
  } catch { warn("unavailable"); return { allowed: false, reason: "unavailable" }; }
  finally { clearTimeout(timer); }
}
