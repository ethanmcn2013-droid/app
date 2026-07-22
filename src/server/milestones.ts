import "server-only";

/**
 * Completion milestones — exactly-once awards at 100 / 250 / 500 / 1000
 * distinct tasks completed by a single user.
 *
 * Architecture notes:
 *
 *   EXACTLY-ONCE POINT: The `ON CONFLICT(key) DO NOTHING` INSERT combined
 *   with checking `result.rowsAffected === 1` is the concurrency-safe guard.
 *   Even under concurrent toggleCompleteAction calls the second writer will
 *   find the key already present and rowsAffected will be 0, so the
 *   notification fires only once. The KV award is always written (even when
 *   celebrations is false) so the idempotency record persists regardless of
 *   the user's preference at award time.
 *
 *   DEMO MODE: this function is a no-op in demo/review mode. The caller also
 *   guards with isDemoMode() before calling, but this is belt-and-suspenders.
 *
 *   THROWS: the body is wrapped in a try/catch; errors are logged but never
 *   bubble to the caller. The caller also .catch(() => {}) at the call site.
 *
 *   TESTABILITY: the pure threshold logic lives in src/lib/milestones-pure.ts
 *   so tests can import it without touching the server-only db singleton.
 */

import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { isDemoMode } from "@/lib/access-mode";
import { notify } from "@/server/db/notifications";
import { readPersonalityPrefs } from "@/server/personality-read";
import { MILESTONE_THRESHOLDS } from "@/lib/milestones-pure";

// Re-export the pure helpers so callers can import from one place.
export { MILESTONE_THRESHOLDS, awardableThresholds } from "@/lib/milestones-pure";
export type { MilestoneThreshold } from "@/lib/milestones-pure";

export async function maybeAwardCompletionMilestone(
  userId: string,
  taskId: string,
): Promise<void> {
  if (isDemoMode()) return;

  try {
    // Count DISTINCT task_id to avoid inflating the total when a task is
    // toggled done multiple times (e.g. recurrence completion records).
    const row = await db.get<{ n: number }>(sql`
      SELECT COUNT(DISTINCT task_id) AS n
      FROM activities
      WHERE user_id = ${userId}
        AND kind = 'toggleComplete'
        AND json_extract(payload, '$.to') = 'done'
    `);

    const count = Number(row?.n ?? 0);

    for (const threshold of MILESTONE_THRESHOLDS) {
      if (count < threshold) continue;

      const key = `milestone:${userId}:${threshold}`;

      // Insert with DO NOTHING — the rowsAffected check is the exactly-once gate.
      const result = await db.run(sql`
        INSERT INTO meta (key, value, updated_at)
        VALUES (${key}, ${String(count)}, unixepoch())
        ON CONFLICT(key) DO NOTHING
      `);

      if (result.rowsAffected === 1) {
        // New award: read celebrations preference.
        // IMPORTANT: we always record the KV award above even when celebrations
        // is false, so the milestone counts as "awarded" for idempotency.
        // The notification is simply suppressed based on preference.
        const prefs = await readPersonalityPrefs(userId);
        if (prefs.celebrations === false) continue;

        await notify(userId, {
          kind: "milestone",
          taskId,
          threshold,
          count,
        });
      }
    }
  } catch (err) {
    console.warn("[milestones] maybeAwardCompletionMilestone failed:", err);
  }
}
