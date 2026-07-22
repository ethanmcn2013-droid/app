import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { isDemoMode } from "@/lib/access-mode";
import {
  PERSONALITY_DEFAULTS,
  type PersonalityPrefs,
} from "@/lib/personality-prefs";

/**
 * Raw personality-prefs read for a given user id.
 *
 * This is a plain server-only helper, NOT a server action, so an explicit
 * user id is safe here: only trusted server callers (the settings/inbox
 * pages resolving `me`, and milestones.ts resolving the completing user)
 * ever pass one. The client-facing `getPersonalityPrefs()` action resolves
 * identity from the session and never accepts a caller-supplied id, which is
 * why the id-taking read lives in this non-action module (least privilege:
 * a client cannot read another user's flags).
 */
export async function readPersonalityPrefs(
  userId: string,
): Promise<PersonalityPrefs> {
  if (isDemoMode()) return { ...PERSONALITY_DEFAULTS };

  try {
    const row = await db.get<{ value: string }>(sql`
      SELECT value FROM meta WHERE key = ${`personality:${userId}`}
    `);
    if (!row) return { ...PERSONALITY_DEFAULTS };
    const parsed = JSON.parse(row.value) as Partial<PersonalityPrefs>;
    return {
      greeting:
        typeof parsed.greeting === "boolean"
          ? parsed.greeting
          : PERSONALITY_DEFAULTS.greeting,
      tips:
        typeof parsed.tips === "boolean"
          ? parsed.tips
          : PERSONALITY_DEFAULTS.tips,
      celebrations:
        typeof parsed.celebrations === "boolean"
          ? parsed.celebrations
          : PERSONALITY_DEFAULTS.celebrations,
    };
  } catch {
    return { ...PERSONALITY_DEFAULTS };
  }
}
