import { createHash } from "node:crypto";
import type { MetricKey } from "../../lib/analytics/contracts";

export const SNAPSHOT_RETENTION_DAYS = 400;
export const SNAPSHOT_RUN_STALE_MS = 10 * 60 * 1_000;

export interface SnapshotWorkspaceCandidate {
  workspaceId: string;
  timezone: string;
  /** Clerk subjects that explicitly linked this workspace in Signal. */
  linkedClerkIds?: readonly string[];
}

/** Oldest/never captured workspaces go first so a UTC-day reset cannot starve the tail. */
export function prioritizeSnapshotCandidates(
  candidates: readonly SnapshotWorkspaceCandidate[],
  lastCompletedAt: ReadonlyMap<string, number>,
): SnapshotWorkspaceCandidate[] {
  return [...candidates].sort((left, right) => {
    const leftAt = lastCompletedAt.get(left.workspaceId) ?? Number.NEGATIVE_INFINITY;
    const rightAt = lastCompletedAt.get(right.workspaceId) ?? Number.NEGATIVE_INFINITY;
    return leftAt - rightAt || left.workspaceId.localeCompare(right.workspaceId);
  });
}

/** Keep a linked workspace only while at least one linked subject remains a Tasks member/owner. */
export function currentLinkedWorkspaceIds(
  candidates: readonly SnapshotWorkspaceCandidate[],
  workspaceOwners: ReadonlyMap<string, string | null>,
  tasksUserByClerk: ReadonlyMap<string, string>,
  membershipPairs: ReadonlySet<string>,
): Set<string> {
  const allowed = new Set<string>();
  for (const candidate of candidates) {
    const ownerId = workspaceOwners.get(candidate.workspaceId);
    if (ownerId === undefined) continue;
    const hasCurrentMember = (candidate.linkedClerkIds ?? []).some((clerkId) => {
      const tasksUserId = tasksUserByClerk.get(clerkId);
      return Boolean(
        tasksUserId &&
          (tasksUserId === ownerId ||
            membershipPairs.has(`${candidate.workspaceId}\u001f${tasksUserId}`)),
      );
    });
    if (hasCurrentMember) allowed.add(candidate.workspaceId);
  }
  return allowed;
}

export function stableSnapshotId(...parts: string[]): string {
  return `sa_${createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 32)}`;
}

export function snapshotRetentionCutoff(now: Date): Date {
  return new Date(now.getTime() - SNAPSHOT_RETENTION_DAYS * 86_400_000);
}

export function snapshotRunBlocksCapture(
  status: string,
  startedAt: Date,
  now: Date,
): boolean {
  if (status === "completed") return true;
  return status === "running" && now.getTime() - startedAt.getTime() < SNAPSHOT_RUN_STALE_MS;
}

/**
 * Select one bounded continuation batch from explicitly eligible workspaces.
 * Existing and active sets are supplied by their respective tenant stores so
 * a removed Tasks workspace and an in-flight daily receipt are both skipped.
 */
export function selectSnapshotBatch(
  eligible: readonly SnapshotWorkspaceCandidate[],
  existingWorkspaceIds: ReadonlySet<string>,
  activeWorkspaceIds: ReadonlySet<string>,
  limit: number,
): SnapshotWorkspaceCandidate[] {
  const boundedLimit = Math.max(1, Math.min(25, Math.floor(limit)));
  const seen = new Set<string>();
  const selected: SnapshotWorkspaceCandidate[] = [];
  for (const candidate of eligible) {
    if (
      !candidate.workspaceId ||
      seen.has(candidate.workspaceId) ||
      !existingWorkspaceIds.has(candidate.workspaceId) ||
      activeWorkspaceIds.has(candidate.workspaceId)
    ) {
      continue;
    }
    seen.add(candidate.workspaceId);
    selected.push(candidate);
    if (selected.length === boundedLimit) break;
  }
  return selected;
}

/** Keep scalar aggregates only; arrays, identifiers and source content drop. */
export function scalarSnapshotAggregate(value: unknown): Record<string, number | null> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item === null || (typeof item === "number" && Number.isFinite(item)))
      .slice(0, 16),
  ) as Record<string, number | null>;
}

/** Pick the y-axis value intentionally for each metric's documented unit. */
export function snapshotMetricNumber(metricKey: MetricKey, value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const field = metricKey === "open_work_age"
    ? "medianDays"
    : metricKey === "completion_pace_change"
      ? "currentCount"
      : metricKey === "milestone_movement"
        ? "changeCount"
        : metricKey === "workload_distribution"
          ? "totalActive"
          : "count";
  const number = record[field];
  return typeof number === "number" && Number.isFinite(number) ? number : null;
}
