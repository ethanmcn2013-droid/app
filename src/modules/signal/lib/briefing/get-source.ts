import { mockBriefingSource } from "./mock-source";
import type { BriefingSource } from "./source";
import { makeTasksDbSource } from "./tasks-db-source";

/**
 * An empty source that returns no signals. Used when the Tasks env
 * vars are not set, the empty-state render (BriefingEmpty) is the
 * correct truthful render in that case. Never falls back to mock in
 * production.
 */
const emptySource: BriefingSource = {
  getSignalsForUser: async () => [],
};

/**
 * Runtime source selection. If the Tasks read-only Turso env vars
 * are set, return a real Tasks DB reader. Otherwise return the
 * empty source, the empty-state briefing is the honest signal that
 * no workspace data is connected.
 *
 * Cached per server process so we don't recreate the libsql client
 * on every request.
 */
let cached: BriefingSource | null = null;

export function getBriefingSource(): BriefingSource {
  if (cached) return cached;
  const real = makeTasksDbSource();
  cached = real ?? emptySource;
  return cached;
}

/**
 * For tests / preview-email surfaces that want the demo regardless
 * of env. Don't reach for this in production cron, it bypasses
 * the cross-product join.
 */
export function getMockSource(): BriefingSource {
  return mockBriefingSource;
}
