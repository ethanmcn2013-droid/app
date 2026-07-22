import { eq } from "drizzle-orm";
import {
  analyticsUsers,
  analyticsViewPreferences,
  briefingFeedback,
  phrasingRotations,
  surfacedItems,
} from "./db/signal-analytics-schema";
import { signalAnalyticsDb } from "./db/signal-analytics-client";
import { userPreferences } from "./db/signal-prefs-schema";
import { signalPrefsDb } from "./db/signal-prefs-client";

/**
 * GDPR Art. 20 (data portability) — Signal analytics + prefs module.
 *
 * Returns everything Signal holds for the user across its two Turso databases:
 *   - Analytics DB (`SIGNAL_ANALYTICS_DATABASE_URL`): analyticsUsers,
 *     phrasingRotations, briefingFeedback, surfacedItems,
 *     analyticsViewPreferences.
 *   - Prefs DB (`SIGNAL_PREFS_DATABASE_URL`): userPreferences (email
 *     subscription).
 *
 * SECURITY: `user_preferences.unsubscribe_token` is OMITTED. It is an opaque
 * action credential (one-click unsubscribe, no auth), not user content.
 * Email address + cadence + timestamps are exported; the token is not.
 *
 * Degrades gracefully when either DB is unconfigured: returns
 * `{ available: false, reason }` rather than throwing. The orchestrator
 * treats that section as unavailable, not as an error.
 *
 * May be called from the GDPR orchestrator in src/server/ via the boundary-
 * approved import path (check-module-boundaries.mjs gdprOrchestrators list).
 */
export async function exportForUser(clerkId: string): Promise<
  | {
      available: true;
      account: typeof analyticsUsers.$inferSelect | null;
      phrasingRotations: (typeof phrasingRotations.$inferSelect)[];
      briefingFeedback: (typeof briefingFeedback.$inferSelect)[];
      surfacedItems: (typeof surfacedItems.$inferSelect)[];
      analyticsViewPreferences: (typeof analyticsViewPreferences.$inferSelect)[];
      emailSubscription: {
        userId: string;
        email: string;
        cadence: string;
        lastSentAt: number | null;
        createdAt: number;
        updatedAt: number;
      } | null;
    }
  | { available: false; reason: string }
> {
  try {
    const [users, rotations, feedback, surfaced, viewPrefs, prefs] =
      await Promise.all([
        signalAnalyticsDb
          .select()
          .from(analyticsUsers)
          .where(eq(analyticsUsers.clerkId, clerkId)),
        signalAnalyticsDb
          .select()
          .from(phrasingRotations)
          .where(eq(phrasingRotations.clerkId, clerkId)),
        signalAnalyticsDb
          .select()
          .from(briefingFeedback)
          .where(eq(briefingFeedback.clerkId, clerkId)),
        signalAnalyticsDb
          .select()
          .from(surfacedItems)
          .where(eq(surfacedItems.clerkId, clerkId)),
        signalAnalyticsDb
          .select()
          .from(analyticsViewPreferences)
          .where(eq(analyticsViewPreferences.clerkId, clerkId)),
        signalPrefsDb
          .select({
            userId: userPreferences.userId,
            email: userPreferences.email,
            cadence: userPreferences.cadence,
            lastSentAt: userPreferences.lastSentAt,
            createdAt: userPreferences.createdAt,
            updatedAt: userPreferences.updatedAt,
          })
          .from(userPreferences)
          .where(eq(userPreferences.userId, clerkId)),
      ]);

    return {
      available: true,
      account: users[0] ?? null,
      phrasingRotations: rotations,
      briefingFeedback: feedback,
      surfacedItems: surfaced,
      analyticsViewPreferences: viewPrefs,
      // Token-free by design: see the security note above.
      emailSubscription: prefs[0] ?? null,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { available: false, reason };
  }
}

/**
 * GDPR right-to-erasure — Signal analytics + prefs module.
 *
 * Hard-deletes every row keyed to `clerkId` across both Signal databases.
 * Mirrors `analytics/src/server/account-erasure.ts`, extended to also
 * clear `analyticsViewPreferences` and `surfacedItems`.
 *
 * Returns `{ ok: true }` on success, `{ ok: false, error }` on failure so
 * the orchestrator can log and continue rather than aborting.
 *
 * Idempotent: retrying after partial failure is safe.
 */
export async function eraseForUser(
  clerkId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Analytics DB: every table keyed by clerk_id.
    await signalAnalyticsDb
      .delete(phrasingRotations)
      .where(eq(phrasingRotations.clerkId, clerkId));
    await signalAnalyticsDb
      .delete(briefingFeedback)
      .where(eq(briefingFeedback.clerkId, clerkId));
    await signalAnalyticsDb
      .delete(surfacedItems)
      .where(eq(surfacedItems.clerkId, clerkId));
    await signalAnalyticsDb
      .delete(analyticsViewPreferences)
      .where(eq(analyticsViewPreferences.clerkId, clerkId));
    await signalAnalyticsDb
      .delete(analyticsUsers)
      .where(eq(analyticsUsers.clerkId, clerkId));

    // Prefs DB (separate Turso instance): email subscription row.
    await signalPrefsDb
      .delete(userPreferences)
      .where(eq(userPreferences.userId, clerkId));

    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}
