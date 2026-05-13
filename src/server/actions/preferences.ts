"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth";
import {
  type DailySignalCadence,
  type WeeklySummary,
  type UserPreferencesPatch,
  upsertUserPreferences,
} from "@/server/db/preferences";

const CADENCE: DailySignalCadence[] = ["off", "weekdays", "daily"];
const SUMMARY: WeeklySummary[] = ["off", "mondays"];

export async function updateUserPreferencesAction(
  raw: UserPreferencesPatch,
): Promise<void> {
  const me = await getCurrentUser();
  const patch: UserPreferencesPatch = {};
  if (
    raw.dailySignalCadence !== undefined &&
    CADENCE.includes(raw.dailySignalCadence)
  ) {
    patch.dailySignalCadence = raw.dailySignalCadence;
  }
  if (
    raw.weeklySummary !== undefined &&
    SUMMARY.includes(raw.weeklySummary)
  ) {
    patch.weeklySummary = raw.weeklySummary;
  }
  if (raw.timeZone !== undefined) {
    patch.timeZone = raw.timeZone ? String(raw.timeZone).slice(0, 64) : null;
  }
  await upsertUserPreferences(me, patch);
  revalidatePath("/settings/notifications");
}
