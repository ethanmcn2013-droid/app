import type { TimelineDependencyRecord } from "./contracts";

const TERMINAL_DEPENDENCY_STATES = new Set([
  "cancelled",
  "completed",
  "done",
  "refused",
  "resolved",
  "shipped",
]);

export function timelineDependencyResolved(
  state: string | null,
  completedAt: string | null,
): boolean {
  return completedAt !== null || TERMINAL_DEPENDENCY_STATES.has((state ?? "").toLowerCase());
}

/** Missing records remain unresolved; provider boundaries must never guess them complete. */
export function unresolvedTimelineDependencyIds(
  dependencyIds: readonly string[],
  records: readonly TimelineDependencyRecord[],
): string[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  return [...new Set(dependencyIds)].filter((id) => byId.get(id)?.resolved !== true);
}
