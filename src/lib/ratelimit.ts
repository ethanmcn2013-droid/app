import "server-only";
import { checkFixedWindow, isRedisConfigured, type RateLimitResult } from "./redis-rate-limit";

type Duration = `${number} ${"ms" | "s" | "m" | "h" | "d"}`;
const UNIT_SECONDS: Record<string, number> = { ms: 1 / 1000, s: 1, m: 60, h: 3600, d: 86400 };
function windowSeconds(window: Duration): number {
  const [raw, unit] = window.split(" ");
  return Math.max(1, Math.ceil(Number(raw) * (UNIT_SECONDS[unit] ?? 0)));
}
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
/** Best-effort AI/extraction budget. Degradation is logged, not silently hidden. */
export async function allow(name: string, identifier: string, limit: number, window: Duration): Promise<boolean> {
  const result = await checkFixedWindow(`signal:rl:${name}:${identifier}`, limit, windowSeconds(window));
  return result.allowed || result.reason !== "quota";
}
/** Redemption must fail closed in production, before any code lookup or claim. */
export async function checkAttemptLimit(name: string, identifier: string, limit: number, window: Duration): Promise<RateLimitResult> {
  if (process.env.NODE_ENV !== "production" && !isRedisConfigured()) return { allowed: true };
  return checkFixedWindow(`signal:rl:${name}:${identifier}`, limit, windowSeconds(window));
}
