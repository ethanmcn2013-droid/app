import { eq } from "drizzle-orm";
import { signalAnalyticsDb as db } from "../db/signal-analytics-client";
import {
  analyticsUsers,
  type AnalyticsUser,
} from "../db/signal-analytics-schema";

/**
 * Onboarding-relevant analytics DB queries — ported from
 * signal/src/server/onboarding/queries.ts.
 *
 * DB client: signalAnalyticsDb (SIGNAL_ANALYTICS_* vars).
 */

export async function getAnalyticsUser(
  clerkId: string,
): Promise<AnalyticsUser | null> {
  const rows = await db
    .select()
    .from(analyticsUsers)
    .where(eq(analyticsUsers.clerkId, clerkId))
    .limit(1);
  return rows[0] ?? null;
}

export async function isOnboarded(clerkId: string): Promise<boolean> {
  const user = await getAnalyticsUser(clerkId);
  return Boolean(user?.linkedWorkspaceId);
}
