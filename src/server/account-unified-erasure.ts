import type { ErasureDb } from "@/server/account-erasure";
import { eraseAccountData as eraseTasksData } from "@/server/account-erasure";

// Types for the per-module erase functions so tests can supply stubs.
export type NotesEraseFn = (clerkId: string) => Promise<
  | { ok: true; refreshTokens: string[] }
  | { ok: false; error: string; refreshTokens: string[] }
>;
export type TimelineEraseFn = (clerkId: string) => Promise<
  { ok: true } | { ok: false; error: string }
>;
export type SignalEraseFn = (clerkId: string) => Promise<
  { ok: true } | { ok: false; error: string }
>;
export type RevokeTokensFn = (tokens: string[]) => Promise<void>;

/**
 * Revoke a set of Google OAuth refresh tokens at Google's revocation endpoint.
 *
 * Best-effort: a revocation failure is logged but never fatal. The rows are
 * already gone from Notes' DB so a failed revocation only leaves a stale
 * credential at Google — bad but not a reason to abort the account deletion.
 */
export async function defaultRevokeGoogleTokens(tokens: string[]): Promise<void> {
  await Promise.allSettled(
    tokens.map(async (token) => {
      try {
        const res = await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
          { method: "POST" },
        );
        if (!res.ok) {
          console.warn(
            `[gdpr] Google token revocation returned ${res.status}`,
          );
        }
      } catch (err) {
        console.warn("[gdpr] Google token revocation failed:", err);
      }
    }),
  );
}

/**
 * GDPR right-to-erasure — unified Signal Studio deletion (injectable form).
 *
 * Accepts the Tasks DB handle, per-module erase functions, and a token-
 * revocation function so it can be exercised end-to-end in tests without
 * network access (same db-injection seam as `eraseAccountData`).
 *
 * Execution order:
 *   1. Erase Notes (returns Google tokens collected before deletion),
 *      Timeline, and Signal in parallel. Each module failure is logged
 *      but does not abort the others.
 *   2. Erase Tasks (host DB).
 *   3. Revoke the Google tokens collected in step 1 (best-effort).
 *
 * The caller (POST /api/account/delete route → deleteAccountForUser →
 * deleteUnifiedAccountData) then calls Clerk admin delete LAST.
 *
 * Idempotent: safe to retry after partial failure.
 */
export async function deleteUnifiedAccountDataWith(
  database: ErasureDb,
  clerkId: string,
  opts: {
    eraseNotes: NotesEraseFn;
    eraseTimeline: TimelineEraseFn;
    eraseSignal: SignalEraseFn;
    revokeTokens: RevokeTokensFn;
  },
): Promise<void> {
  // Step 1: erase Notes (collecting tokens), Timeline, Signal in parallel.
  const [notesResult, timelineResult, signalResult] = await Promise.all([
    opts.eraseNotes(clerkId).catch((err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
      refreshTokens: [] as string[],
    })),
    opts.eraseTimeline(clerkId).catch((err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    })),
    opts.eraseSignal(clerkId).catch((err: unknown) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    })),
  ]);

  // Log per-module failures; erasure continues regardless.
  if (!notesResult.ok) {
    console.error("[gdpr] Notes erasure failed:", notesResult.error);
  }
  if (!timelineResult.ok) {
    console.error("[gdpr] Timeline erasure failed:", timelineResult.error);
  }
  if (!signalResult.ok) {
    console.error("[gdpr] Signal erasure failed:", signalResult.error);
  }

  // Collect refresh tokens from the Notes result (empty on failure).
  const googleTokens =
    "refreshTokens" in notesResult ? notesResult.refreshTokens : [];

  // Step 2: erase Tasks (host DB).
  await eraseTasksData(database, clerkId);

  // Step 3: revoke Google tokens (best-effort, never throws).
  if (googleTokens.length > 0) {
    await opts.revokeTokens(googleTokens);
  }
}

