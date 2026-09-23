import "server-only";

/**
 * Drizzle may include the bound task title or description in a failed write's
 * error. Keep only the database statement inside this wrapper: authorization,
 * validation, and Project conflicts retain their existing outcomes.
 */
export async function privateTaskDbWrite<T>(write: () => PromiseLike<T>): Promise<T> {
  try {
    return await write();
  } catch {
    throw new Error("Task changes could not be saved. Please try again.");
  }
}
