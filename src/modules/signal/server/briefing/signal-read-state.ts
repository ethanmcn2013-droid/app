/**
 * Per-user read state for the briefing engine — ported from
 * signal/src/server/briefing/read-state.ts.
 *
 * DB client: signalAnalyticsDb (SIGNAL_ANALYTICS_* vars).
 */

import { and, eq } from "drizzle-orm";
import { signalAnalyticsDb as db } from "../db/signal-analytics-client";
import {
  briefingFeedback,
  surfacedItems,
} from "../db/signal-analytics-schema";

const DAY = 86_400_000;

export function utcDay(now: number): number {
  return Math.floor(now / DAY);
}

export async function getDismissedKeys(
  clerkId: string,
): Promise<Set<string>> {
  try {
    const rows = await db
      .select({
        itemKey: briefingFeedback.itemKey,
        triggerId: briefingFeedback.triggerId,
      })
      .from(briefingFeedback)
      .where(
        and(
          eq(briefingFeedback.clerkId, clerkId),
          eq(briefingFeedback.verdict, "not-useful"),
        ),
      );
    return new Set(rows.map((r) => `${r.triggerId ?? "*"}:${r.itemKey}`));
  } catch (err) {
    console.warn("[signal-briefing-read-state] dismissals unavailable:", String(err));
    return new Set();
  }
}

export async function getSurfacedAges(
  clerkId: string,
  now: number,
): Promise<Map<string, number>> {
  const today = utcDay(now);
  try {
    const rows = await db
      .select({
        itemKey: surfacedItems.itemKey,
        triggerId: surfacedItems.triggerId,
        lastDay: surfacedItems.lastDay,
        runDays: surfacedItems.runDays,
      })
      .from(surfacedItems)
      .where(eq(surfacedItems.clerkId, clerkId));

    const ages = new Map<string, number>();
    for (const row of rows) {
      const age =
        row.lastDay === today
          ? row.runDays
          : row.lastDay === today - 1
            ? row.runDays + 1
            : 1;
      ages.set(`${row.triggerId}:${row.itemKey}`, age);
    }
    return ages;
  } catch (err) {
    console.warn("[signal-briefing-read-state] ages unavailable:", String(err));
    return new Map();
  }
}

export async function recordSurfaced(
  clerkId: string,
  items: ReadonlyArray<{ itemKey: string; triggerId: string }>,
  now: number,
): Promise<void> {
  if (items.length === 0) return;
  const today = utcDay(now);
  try {
    await Promise.all(
      items.map(async ({ itemKey, triggerId }) => {
        const existing = await db
          .select({
            lastDay: surfacedItems.lastDay,
            runDays: surfacedItems.runDays,
            firstDay: surfacedItems.firstDay,
          })
          .from(surfacedItems)
          .where(
            and(
              eq(surfacedItems.clerkId, clerkId),
              eq(surfacedItems.itemKey, itemKey),
              eq(surfacedItems.triggerId, triggerId),
            ),
          )
          .limit(1);

        const row = existing[0];
        if (row?.lastDay === today) return;

        const continues = row?.lastDay === today - 1;
        await db
          .insert(surfacedItems)
          .values({
            clerkId,
            itemKey,
            triggerId,
            firstDay: continues ? row.firstDay : today,
            lastDay: today,
            runDays: continues ? row.runDays + 1 : 1,
          })
          .onConflictDoUpdate({
            target: [
              surfacedItems.clerkId,
              surfacedItems.itemKey,
              surfacedItems.triggerId,
            ],
            set: {
              firstDay: continues ? row!.firstDay : today,
              lastDay: today,
              runDays: continues ? row!.runDays + 1 : 1,
            },
          });
      }),
    );
  } catch (err) {
    console.warn("[signal-briefing-read-state] surfacing not recorded:", String(err));
  }
}
