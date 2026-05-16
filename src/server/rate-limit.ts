/**
 * Lightweight in-process sliding-window rate limiter.
 *
 * Dependency-free — no Upstash or Redis required. Suitable for
 * low-volume abuse surfaces (email sends, cross-repo API calls).
 * State lives in the process; a multi-replica deploy would need a
 * shared store, but this is the correct interim layer while the
 * operator-infra decision on Upstash is pending.
 *
 * GC: entries older than 2× the window are pruned on each check
 * so the Map doesn't accumulate indefinitely.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
 *   const { allowed } = limiter.check(userId);
 *   if (!allowed) { ... }
 */

export type RateLimitResult = { allowed: boolean; remaining: number };

export type RateLimiterOptions = {
  /** Rolling window length in milliseconds. */
  windowMs: number;
  /** Maximum number of calls allowed per key within the window. */
  max: number;
};

export type RateLimiter = {
  check(key: string): RateLimitResult;
};

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  // Each key maps to a list of hit timestamps (ms since epoch).
  const store = new Map<string, number[]>();
  const { windowMs, max } = opts;

  function check(key: string): RateLimitResult {
    const now = Date.now();
    const cutoff = now - windowMs;

    // GC: sweep entries older than 2× the window.
    if (store.size > 0 && now % 50 === 0) {
      for (const [k, hits] of store) {
        const fresh = hits.filter((t) => t > now - windowMs * 2);
        if (fresh.length === 0) {
          store.delete(k);
        } else {
          store.set(k, fresh);
        }
      }
    }

    const hits = (store.get(key) ?? []).filter((t) => t > cutoff);
    if (hits.length >= max) {
      store.set(key, hits);
      return { allowed: false, remaining: 0 };
    }
    hits.push(now);
    store.set(key, hits);
    return { allowed: true, remaining: max - hits.length };
  }

  return { check };
}

// ── Pre-built limiters for email-send surfaces ──────────────────────

/** 5 email sends per authenticated user per minute. */
export const emailSendLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
});

/** 30 notes-extract calls per bearer-key per minute. */
export const notesExtractLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
});
