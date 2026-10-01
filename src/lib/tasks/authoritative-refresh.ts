import type { Task } from "@/lib/data";

export type AuthoritativeTaskVersion = Readonly<{
  signature: string;
  revision: number;
}>;

export type AuthoritativeTaskVersions = ReadonlyMap<string, AuthoritativeTaskVersion>;

// Task DTOs contain dates, arrays and plain objects. Sorting object keys makes
// equivalent RSC/action snapshots identical even when their key order differs.
function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function reconcileAuthoritativeTasks(
  previous: AuthoritativeTaskVersions,
  tasks: readonly Task[],
): AuthoritativeTaskVersions {
  const next = new Map<string, AuthoritativeTaskVersion>();
  let changed = previous.size !== tasks.length;
  for (const task of tasks) {
    const signature = JSON.stringify(canonical(task));
    const prior = previous.get(task.id);
    if (prior?.signature === signature) {
      next.set(task.id, prior);
    } else {
      next.set(task.id, { signature, revision: (prior?.revision ?? 0) + 1 });
      changed = true;
    }
  }
  return changed ? next : previous;
}
