import type {
  AccountErasureOptions,
  AccountErasureReceipt,
  ErasureDb,
} from "@/server/account-erasure";
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
export type TasksEraseFn = (
  database: ErasureDb,
  clerkId: string,
) => Promise<AccountErasureReceipt>;

/**
 * Revoke a set of Google OAuth refresh tokens at Google's revocation endpoint.
 *
 * Best-effort: a revocation failure is logged but never fatal. The rows are
 * already gone from every Signal database, so a failed revocation only leaves
 * a stale credential at Google — bad but not a reason to restore personal data.
 */
export async function defaultRevokeGoogleTokens(tokens: string[]): Promise<void> {
  // `google-drive` is a server-only transport. Lazy loading preserves the
  // injectable orchestrator's plain-Node test seam without weakening runtime
  // boundaries in production.
  const { revokeGoogleToken } = await import(
    "@/server/connections/google-drive"
  );
  await Promise.allSettled(
    tokens.map(async (token) => {
      try {
        // The provider helper places the credential in a form body, never a
        // URL that a proxy, log, or error reporter is likely to retain.
        await revokeGoogleToken(token);
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
 *   2. Erase Tasks after collecting its encrypted Project Drive generations.
 *   3. Revoke the deduplicated Google tokens collected in steps 1-2
 *      (best-effort, and only after the rows that held them are gone).
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
    /** WP5 must provide the exact, idempotent Drive permission revoker. */
    revokeDriveFolderGrant?: AccountErasureOptions["revokeDriveFolderGrant"];
    /** Test seam; production always uses the real Tasks erasure. */
    eraseTasks?: TasksEraseFn;
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
  const notesGoogleTokens =
    "refreshTokens" in notesResult ? notesResult.refreshTokens : [];

  // Step 2: Tasks collects every encrypted Project Drive generation before
  // explicitly deleting its RESTRICT-backed rows, and returns the plaintext
  // only long enough for this orchestrator to revoke it.
  const tasksResult = opts.eraseTasks
    ? await opts.eraseTasks(database, clerkId)
    : await eraseTasksData(database, clerkId, {
        revokeDriveFolderGrant: opts.revokeDriveFolderGrant,
      });
  const googleTokens = [
    ...new Set([
      ...notesGoogleTokens,
      ...tasksResult.googleRefreshTokens,
    ]),
  ];

  // Step 3: revoke Google tokens (best-effort, never throws).
  if (googleTokens.length > 0) {
    await opts.revokeTokens(googleTokens);
  }
}

