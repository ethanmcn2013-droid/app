const MAX_ATTEMPTS = 8;
const pendingByDatabase = new WeakMap<object, Map<string, Promise<void>>>();

function isSqliteContention(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (candidate.code === "SQLITE_BUSY" || candidate.code === "SQLITE_LOCKED") return true;
    current = candidate.cause;
  }
  return false;
}

/** Serialize one subject per DB client, then retry only rolled-back SQLite contention. */
export async function retryImmediateProvisioning<T>(
  database: object,
  clerkId: string,
  operation: () => Promise<T>,
): Promise<T> {
  let pending = pendingByDatabase.get(database);
  if (!pending) {
    pending = new Map();
    pendingByDatabase.set(database, pending);
  }
  // A local libSQL file allows one writer; its client creates separate SQLite
  // connections for simultaneous transactions. Remote Turso requests do not
  // share that file lock, so only serialize the same subject there.
  const url = process.env.TASKS_DATABASE_URL ?? "file:tasks.db";
  const queueKey = url.startsWith("file:") || url === ":memory:"
    ? "local-sqlite-writer"
    : clerkId;
  const predecessor = pending.get(queueKey);
  let release!: () => void;
  const completion = new Promise<void>((resolve) => { release = resolve; });
  pending.set(queueKey, completion);
  if (predecessor) await predecessor;
  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (!isSqliteContention(error) || attempt === MAX_ATTEMPTS - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(5 * 2 ** attempt, 100)));
      }
    }
    throw new Error("Unreachable provisioning retry state.");
  } finally {
    release();
    if (pending.get(queueKey) === completion) pending.delete(queueKey);
  }
}
