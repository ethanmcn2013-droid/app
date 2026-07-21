/**
 * Per-user phrasing rotation persistence — ported from
 * signal/src/server/briefing/rotation.ts.
 *
 * DB client: signalAnalyticsDb (SIGNAL_ANALYTICS_* vars).
 */

import { eq, sql, inArray, and } from "drizzle-orm";
import { signalAnalyticsDb as db } from "../db/signal-analytics-client";
import { phrasingRotations } from "../db/signal-analytics-schema";
import type { TriggerId } from "../../lib/triggers/types";

export async function getRotations(
  clerkId: string,
): Promise<Partial<Record<TriggerId, number>>> {
  const rows = await db
    .select({
      triggerId: phrasingRotations.triggerId,
      lastIndex: phrasingRotations.lastIndex,
    })
    .from(phrasingRotations)
    .where(eq(phrasingRotations.clerkId, clerkId));

  const map: Partial<Record<TriggerId, number>> = {};
  for (const row of rows) {
    map[row.triggerId as TriggerId] = row.lastIndex;
  }
  return map;
}

export async function bumpRotations(
  clerkId: string,
  firedTriggerIds: TriggerId[],
): Promise<void> {
  if (firedTriggerIds.length === 0) return;

  const existing = await db
    .select({
      triggerId: phrasingRotations.triggerId,
      lastIndex: phrasingRotations.lastIndex,
    })
    .from(phrasingRotations)
    .where(
      and(
        eq(phrasingRotations.clerkId, clerkId),
        inArray(phrasingRotations.triggerId, firedTriggerIds),
      ),
    );

  const existingMap = new Map(
    existing.map((r) => [r.triggerId, r.lastIndex]),
  );

  for (const triggerId of firedTriggerIds) {
    const current = existingMap.get(triggerId);
    if (current === undefined) {
      await db.insert(phrasingRotations).values({
        clerkId,
        triggerId,
        lastIndex: 1,
        lastFiredAt: new Date(),
      });
    } else {
      await db
        .update(phrasingRotations)
        .set({
          lastIndex: current + 1,
          lastFiredAt: new Date(),
        })
        .where(
          and(
            eq(phrasingRotations.clerkId, clerkId),
            eq(phrasingRotations.triggerId, triggerId),
          ),
        );
    }
  }
}

export function rotationLookupFromMap(
  map: Partial<Record<TriggerId, number>>,
): (triggerId: string) => number {
  return (triggerId) => map[triggerId as TriggerId] ?? 0;
}

export { sql };
