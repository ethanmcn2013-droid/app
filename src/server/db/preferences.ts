import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { userPreferences } from "./schema";

export type DailySignalCadence = "off" | "weekdays" | "daily";
export type WeeklySummary = "off" | "mondays";
/** D-013: only system and light are selectable. dark exists in tokens
 *  but is not shipped. The server action enforces this allow-list. */
export type ThemeMode = "system" | "light";

export type UserPreferences = {
  dailySignalCadence: DailySignalCadence;
  weeklySummary: WeeklySummary;
  timeZone: string | null;
  themeMode: ThemeMode;
  updatedAt: Date;
};

const DEFAULTS: UserPreferences = {
  dailySignalCadence: "off",
  weeklySummary: "off",
  timeZone: null,
  themeMode: "system",
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
    // Null in DB resolves to "system"; any value outside the allow-list
    // also falls back to "system" (defensive read).
    themeMode:
      row.themeMode === "light" ? "light" : "system",
    updatedAt: row.updatedAt,
  };
}

export type UserPreferencesPatch = Partial<{
  dailySignalCadence: DailySignalCadence;
  weeklySummary: WeeklySummary;
  timeZone: string | null;
  themeMode: ThemeMode;
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
      themeMode: patch.themeMode ?? null,
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
        ...(patch.themeMode !== undefined
          ? { themeMode: patch.themeMode }
          : {}),
        updatedAt: sql`(unixepoch())`,
      },
    });
}
