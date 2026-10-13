import "server-only";

/** The shared title-only SET payload; activity and transaction belong to callers. */
export function canonicalTitleUpdate(title: string, updatedAt = new Date()) {
  return { title, updatedAt };
}
