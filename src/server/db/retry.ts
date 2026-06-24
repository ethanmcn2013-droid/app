/**
 * Transient-failure retry for READ queries against Turso.
 *
 * Tasks runs libSQL over Turso's stateless HTTP protocol — every query is a
 * network round-trip, so an ordinary network blip (DNS hiccup, dropped
 * socket, a 5xx from the edge, an expired stream) surfaces to the user as a
 * hard 500 even though an immediate retry would succeed.
 *
 * This wraps a read thunk with bounded exponential backoff. It is scoped to
 * READS ON PURPOSE: a SELECT is idempotent, so re-running it can never cause
 * incorrectness — the worst case is a little added latency on a genuinely
 * failing read. Writes are deliberately NOT covered here: a mutation that
 * failed *after* the server applied it must not be blindly replayed, so
 * write-retry needs per-statement idempotency analysis and is out of scope.
 *
 * Non-transient errors (SQL errors like "no such column", constraint
 * violations) are re-thrown immediately — retrying them only wastes time.
 */

const TRANSIENT_RE =
  /fetch failed|network|timeout|timed out|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|stream (is )?(not found|expired|closed)|Server returned (HTTP )?5\d\d|\b50[234]\b|service unavailable|connection (reset|closed|refused)/i;

/** Classify an error as a transient network/server failure worth retrying. */
export function isTransient(err: unknown): boolean {
  if (!err) return false;
  const msg =
    err instanceof Error ? `${err.message} ${(err as { cause?: unknown }).cause ?? ""}` : String(err);
  return TRANSIENT_RE.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ReadRetryOptions = {
  /** Number of RETRIES after the first attempt (so total tries = retries+1). */
  retries?: number;
  /** Base backoff in ms; attempt N waits base * 2^N. */
  baseMs?: number;
};

/**
 * Run an idempotent read thunk, retrying transient failures with bounded
 * exponential backoff. Resolves with the first success; throws the last
 * error once retries are exhausted, or immediately on a non-transient error.
 */
export async function withReadRetry<T>(
  fn: () => Promise<T>,
  opts: ReadRetryOptions = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseMs = opts.baseMs ?? 40;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isTransient(err)) throw err;
      await sleep(baseMs * 2 ** attempt);
    }
  }
  throw lastErr;
}
