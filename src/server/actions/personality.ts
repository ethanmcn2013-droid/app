"use server";

/**
 * Personality preferences — per-user settings for greeting, tips, and
 * milestone notifications. Stored in the global meta KV table under
 * the key `personality:<userId>`.
 *
 * These are client-callable server actions. They ALWAYS resolve identity
 * from the session (getCurrentUser) and never accept a caller-supplied user
 * id, so a client cannot read or write another user's preferences. The
 * id-taking raw read lives in the server-only helper
 * `@/server/personality-read` for trusted server callers (milestones.ts).
 */

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import { readPersonalityPrefs } from "@/server/personality-read";
import {
  PERSONALITY_DEFAULTS,
  PERSONALITY_KEYS as KNOWN_KEYS,
  type PersonalityPrefs,
} from "@/lib/personality-prefs";

// NOTE: do not re-export PersonalityPrefs from this "use server" file.
// Turbopack's action collector treats every export here as a server action
// and fails the build on a non-async export, even a type. Type consumers
// import from "@/lib/personality-prefs" directly.

/**
 * Read the current user's personality prefs. Identity is resolved from the
 * session, never from a caller argument (least privilege). Demo mode returns
 * DEFAULTS. Falls back to DEFAULTS on a missing row or parse error.
 */
export async function getPersonalityPrefs(): Promise<PersonalityPrefs> {
  if (isDemoMode()) return { ...PERSONALITY_DEFAULTS };
  const me = await getCurrentUser();
  return readPersonalityPrefs(me);
}

/**
 * Merge a partial patch over the current user's personality prefs and
 * persist. Unknown keys are silently ignored (server-side allow-list).
 * Demo mode returns { ok: true } without touching the DB.
 */
export async function setPersonalityPrefsAction(
  patch: Partial<PersonalityPrefs>,
): Promise<{ ok: true }> {
  if (isDemoMode()) return { ok: true };

  const me = await getCurrentUser();

  // Validate: only known boolean keys are accepted.
  const clean: Partial<PersonalityPrefs> = {};
  for (const k of KNOWN_KEYS) {
    if (k in patch && typeof patch[k] === "boolean") {
      clean[k] = patch[k];
    }
  }

  // Merge over current prefs (read via the server-only helper).
  const current = await readPersonalityPrefs(me);
  const merged: PersonalityPrefs = { ...current, ...clean };

  const key = `personality:${me}`;
  const value = JSON.stringify(merged);

  await db.run(sql`
    INSERT INTO meta (key, value, updated_at)
    VALUES (${key}, ${value}, unixepoch())
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `);

  revalidatePath("/app", "layout");

  return { ok: true };
}
