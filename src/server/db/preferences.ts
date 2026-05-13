import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { userPreferences } from "./schema";

export type DailySignalCadence = "off" | "weekdays" | "daily";
export type WeeklySummary = "off" | "mondays";

export type UserPreferences = {
  dailySignalCadence: DailySignalCadence;
  weeklySummary: WeeklySummary;
  timeZone: string | null;
  updatedAt: Date;
};

const DEFAULTS: UserPreferences = {
  dailySignalCadence: "off",
  weeklySummary: "off",
  timeZone: null,
  updatedAt: new Date(0),
};

export async function getUserPreferences(
  userId: string,
): Promise<UserPreferences> {
  const [row] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  if (!row) return DEFAULTS;
  return {
    dailySignalCadence: row.dailySignalCadence,
    weeklySummary: row.weeklySummary,
    timeZone: row.timeZone,
    updatedAt: row.updatedAt,
  };
}

export type UserPreferencesPatch = Partial<{
  dailySignalCadence: DailySignalCadence;
  weeklySummary: WeeklySummary;
  timeZone: string | null;
}>;

export async function upsertUserPreferences(
  userId: string,
  patch: UserPreferencesPatch,
): Promise<void> {
  const now = new Date();
  await db
    .insert(userPreferences)
    .values({
      userId,
      dailySignalCadence: patch.dailySignalCadence ?? "off",
      weeklySummary: patch.weeklySummary ?? "off",
      timeZone: patch.timeZone ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        ...(patch.dailySignalCadence !== undefined
          ? { dailySignalCadence: patch.dailySignalCadence }
          : {}),
        ...(patch.weeklySummary !== undefined
          ? { weeklySummary: patch.weeklySummary }
          : {}),
        ...(patch.timeZone !== undefined
          ? { timeZone: patch.timeZone }
          : {}),
        updatedAt: sql`(unixepoch())`,
      },
    });
}
