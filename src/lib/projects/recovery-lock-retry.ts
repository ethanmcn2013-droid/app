import "server-only";

const pending = new WeakMap<object, Promise<void>>();

/** Keep this process's short recovery transactions off the same libSQL client
 * simultaneously. Its local non-WAL adapter can retain a lock after competing
 * BEGIN/COMMIT calls. This is scheduling, never an authorization fence: each
 * queued operation still takes its own DB transaction and fresh owner proof. */
export async function withRecoveryTransaction<T>(database: object, transaction: () => Promise<T>): Promise<T> {
  const previous = pending.get(database) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  pending.set(database, next);
  await previous;
  try { return await withRecoveryLockRetry(transaction); }
  finally {
    release();
    if (pending.get(database) === next) pending.delete(database);
  }
}

/** Only local lock contention, on a recovery transaction with no provider work.
 * The libSQL transaction wrapper rolls back on failure. Reads and negative-only
 * writes below are replay-safe; network/unknown commit errors are not retried.
 * This is not used around project deletion or other lifecycle/provider services. */
export async function withRecoveryLockRetry<T>(transaction: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await transaction(); }
    catch (error) {
      const candidate = error as { code?: unknown; cause?: { code?: unknown } } | null;
      if (attempt >= 4 || (candidate?.code !== "SQLITE_BUSY" && candidate?.cause?.code !== "SQLITE_BUSY")) throw error;
      await new Promise(resolve => setTimeout(resolve, 20 * 2 ** attempt));
    }
  }
}
