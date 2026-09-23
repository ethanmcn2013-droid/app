const pendingByDatabase = new WeakMap<object, Map<string, Promise<void>>>();

/** Local SQLite files have one writer; remote calls queue only by Clerk subject. */
export async function serializeProvisioning<T>(
  database: object,
  clerkId: string,
  operation: () => Promise<T>,
): Promise<T> {
  let pending = pendingByDatabase.get(database);
  if (!pending) {
    pending = new Map();
    pendingByDatabase.set(database, pending);
  }
  // A local libSQL file opens separate SQLite connections for simultaneous
  // transactions. Remote Turso requests do not share that file lock.
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
    return await operation();
  } finally {
    release();
    if (pending.get(queueKey) === completion) pending.delete(queueKey);
  }
}
