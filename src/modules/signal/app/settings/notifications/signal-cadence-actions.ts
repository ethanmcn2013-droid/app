"use server";

import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/access-mode";
import { setCadence } from "../../../lib/signal-preferences";
import type { Cadence } from "../../../lib/db/signal-prefs-schema";

/**
 * Cadence save action — ported from signal/src/app/app/settings/notifications/actions.ts.
 *
 * S3 (email NOT ported): sendTestBriefingAction is intentionally OMITTED.
 *
 * Demo guard added (S8): in demo mode, cadence save is a no-op that
 * resolves immediately — no prefs DB is touched in demo.
 */
export async function updateCadenceAction(cadence: Cadence): Promise<void> {
  // Demo/Review: acknowledge silently, no prefs DB touch.
  if (isDemoMode()) {
    return;
  }

  await setCadence(cadence);
  revalidatePath("/app/brief/settings/notifications");
}
