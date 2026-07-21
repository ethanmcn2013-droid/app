"use server";

import { isDemoMode } from "@/lib/access-mode";
import { requireSignalUser, UnauthorizedError } from "../server/signal-auth";
import { signalAnalyticsDb as db } from "../server/db/signal-analytics-client";
import { briefingFeedback } from "../server/db/signal-analytics-schema";

export type FeedbackVerdict = "useful" | "not-useful";

/**
 * Record a one-tap verdict on a briefing item — ported from
 * signal/src/app/app/brief/feedback-actions.ts.
 *
 * Demo guard added (S8): in demo mode this is a no-op. The feedback_feedback
 * table must never be written with synthetic demo data.
 */
export async function recordBriefingFeedback(
  itemKey: string,
  verdict: FeedbackVerdict,
  triggerId?: string,
): Promise<void> {
  if (verdict !== "useful" && verdict !== "not-useful") return;
  if (!itemKey) return;

  // Demo/Review: acknowledge silently, no analytics DB touch.
  if (isDemoMode()) return;

  try {
    // Module auth helper (not raw Clerk): identical in production, and the
    // keyless-dev fallback keeps the action testable outside prod (P6 QA gap).
    let clerkId: string;
    try {
      clerkId = await requireSignalUser();
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      throw err;
    }
    const now = new Date();
    await db
      .insert(briefingFeedback)
      .values({
        clerkId,
        itemKey,
        verdict,
        triggerId: triggerId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [briefingFeedback.clerkId, briefingFeedback.itemKey],
        set: { verdict, triggerId: triggerId ?? null, updatedAt: now },
      });
  } catch (err) {
    console.warn("[signal-briefing-feedback] not recorded:", String(err));
  }
}
