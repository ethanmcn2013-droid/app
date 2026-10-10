/** Timeline fixed-window limits. Local memory is for unconfigured development only. */
import { checkFixedWindow, isRedisConfigured, type RateLimitResult } from "../../../lib/redis-rate-limit";
export { isRedisConfigured };
export type { RateLimitResult };
type MemEntry = { count: number; resetAt: number };
const memStore = new Map<string, MemEntry>();
function memRateLimit(key: string, limit: number, seconds: number): boolean {
  const now = Date.now();
  // Bound stale local entries; production never uses this process-local store.
  for (const [name, entry] of memStore) if (now >= entry.resetAt) memStore.delete(name);
  const entry = memStore.get(key);
  if (!entry) { memStore.set(key, { count: 1, resetAt: now + seconds * 1000 }); return true; }
  if (entry.count >= limit) return false;
  entry.count++; return true;
}
export async function checkRateLimit(action: string, ip: string, limit: number, seconds: number): Promise<RateLimitResult> {
  const key = `rl:${action}:${ip}`;
  if (process.env.NODE_ENV !== "production" && !isRedisConfigured()) {
    if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(seconds) || seconds < 1) throw new TypeError("Invalid rate-limit parameters");
    return memRateLimit(key, limit, seconds) ? { allowed: true } : { allowed: false, reason: "quota" };
  }
  return checkFixedWindow(key, limit, seconds);
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
