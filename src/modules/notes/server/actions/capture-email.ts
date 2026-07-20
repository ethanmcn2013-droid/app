"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { requireUser } from "@/modules/notes/server/notes-auth";
import { db } from "@/modules/notes/server/db/notes-client";
import { userPreferences } from "@/modules/notes/server/db/notes-schema";
import { notesProEnabled } from "@/modules/notes/server/notes-entitlements";
import { isDemoMode } from "@/lib/access-mode";

// Server-only config, not NEXT_PUBLIC because this value is only ever
// used inside server actions and never needs to appear in client bundles.
// Rename env var to NOTES_CAPTURE_DOMAIN on Vercel (see operator note in
// src/app/api/capture/email/route.ts). The NEXT_PUBLIC_ variant still
// works at runtime but exposes the value to the browser unnecessarily.
const CAPTURE_DOMAIN =
  process.env.NOTES_CAPTURE_DOMAIN ??
  process.env.NEXT_PUBLIC_NOTES_CAPTURE_DOMAIN ??
  "notes.signalstudio.ie";

function makeSlug(): string {
  // 6 bytes → 12 hex chars, 48 bits. Generated from node:crypto so
  // the slug is unguessable; the bearer secret on the webhook is the
  // actual auth, but unguessable slugs add defence-in-depth and
  // remove the comment-vs-implementation drift Math.random caused.
  return randomBytes(6).toString("hex");
}

export type CaptureEmailResult =
  | { ok: true; address: string; slug: string }
  | { ok: false; reason: "free-tier-not-enabled" }
  | { ok: false; reason: "inbound-not-configured" };

/**
 * Resolve the signed-in user's capture-email address. Two gates:
 *
 *   1. Tier: must be workspace+ (notesProEnabled).
 *   2. Inbound mail provider must be wired (NOTES_CAPTURE_INBOUND_SECRET
 *      env must be set). Until DNS/Resend is configured, we hide the
 *      address rather than show one that silently drops mail.
 *
 * Row is lazy-created on first ok call, never seeded at signup, so
 * the cost (a single INSERT) only lands on users who actually want
 * this feature AND can use it.
 */
export async function getCaptureEmail(): Promise<CaptureEmailResult> {
  // Demo/Review: show the free-tier upgrade nudge rather than a live inbound
  // address. Keeps the notebook visually complete without touching the DB.
  if (isDemoMode()) return { ok: false, reason: "free-tier-not-enabled" };

  const userId = await requireUser();
  if (!(await notesProEnabled(userId))) {
    return { ok: false, reason: "free-tier-not-enabled" };
  }
  if (!process.env.NOTES_CAPTURE_INBOUND_SECRET) {
    return { ok: false, reason: "inbound-not-configured" };
  }

  const existing = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  let slug = existing[0]?.captureSlug;
  if (!slug) {
    // Unique-collision is statistically impossible at 48 bits but
    // the DB constraint protects us anyway. Three retries cover it.
    for (let attempt = 0; attempt < 3 && !slug; attempt++) {
      const candidate = makeSlug();
      try {
        await db.insert(userPreferences).values({
          userId,
          captureSlug: candidate,
        });
        slug = candidate;
      } catch {
        // try again
      }
    }
    if (!slug) {
      throw new Error("Failed to allocate capture slug after 3 attempts");
    }
  }

  return {
    ok: true,
    slug,
    address: `capture-${slug}@${CAPTURE_DOMAIN}`,
  };
}

/**
 * Rotate the user's capture slug, useful if the address leaked to
 * a public mailing list. The old address stops resolving immediately
 * after this returns. Tier-gated.
 */
export async function regenerateCaptureSlug(): Promise<CaptureEmailResult> {
  const userId = await requireUser();
  if (!(await notesProEnabled(userId))) {
    return { ok: false, reason: "free-tier-not-enabled" };
  }

  const now = Date.now();
  let next: string | null = null;
  for (let attempt = 0; attempt < 3 && !next; attempt++) {
    const candidate = makeSlug();
    try {
      await db
        .insert(userPreferences)
        .values({ userId, captureSlug: candidate })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: { captureSlug: candidate, updatedAt: now },
        });
      next = candidate;
    } catch {
      // captureSlug unique constraint may collide, retry.
    }
  }
  if (!next) {
    throw new Error("Failed to rotate capture slug after 3 attempts");
  }

  return {
    ok: true,
    slug: next,
    address: `capture-${next}@${CAPTURE_DOMAIN}`,
  };
}
