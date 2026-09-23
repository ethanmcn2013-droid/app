import type {
  AccountErasureOptions,
  AccountErasureReceipt,
  ErasureDb,
} from "@/server/account-erasure";
import { eraseAccountData as eraseTasksData } from "@/server/account-erasure";
import { opLog } from "@/server/operational-log";

// Types for the per-module erase functions so tests can supply stubs.
export type NotesEraseFn = (
  clerkId: string,
  options?: { revokeTokens: RevokeTokensFn },
) => Promise<
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

export type UnifiedErasureModule =
  | "Notes"
  | "Timeline"
  | "Signal"
  | "Tasks";

/**
 * Safe, caller-visible proof that at least one product did not confirm
 * erasure. The underlying module/provider errors are deliberately omitted:
 * their messages may contain credentials or provider response bodies.
 */
export class UnifiedAccountErasureError extends AggregateError {
  readonly failedModules: readonly UnifiedErasureModule[];

  constructor(failedModules: readonly UnifiedErasureModule[]) {
    const uniqueModules = [...new Set(failedModules)];
    super(
      uniqueModules.map((module) => new Error(`${module} erasure failed`)),
      `Unified account erasure incomplete: ${uniqueModules.join(", ")}`,
    );
    this.name = "UnifiedAccountErasureError";
    this.failedModules = uniqueModules;
  }
}

/**
 * Revoke a set of Google OAuth refresh tokens at Google's revocation endpoint.
 *
 * Attempt every distinct credential, then reject if any revocation remains
 * unconfirmed. Provider errors are not retained, returned or logged.
 */
export async function defaultRevokeGoogleTokens(tokens: string[]): Promise<void> {
  // `google-drive` is a server-only transport. Lazy loading preserves the
  // injectable orchestrator's plain-Node test seam without weakening runtime
  // boundaries in production.
  if (tokens.length === 0) return;
  try {
    const { revokeGoogleToken } = await import(
      "@/server/connections/google-drive"
    );
    const attempts = await Promise.allSettled(
      [...new Set(tokens)].map(async (token) => {
        // Credentials belong in the form body, never a URL or log.
        await revokeGoogleToken(token);
      }),
    );
    if (attempts.some((attempt) => attempt.status === "rejected")) {
      throw new Error("Google token revocation incomplete");
    }
  } catch {
    throw new Error("Google token revocation incomplete");
  }
}

/**
 * GDPR right-to-erasure — unified Signal Studio deletion (injectable form).
 *
 * Accepts the Tasks DB handle, per-module erase functions, and a token-
 * revocation function so it can be exercised end-to-end in tests without
 * network access (same db-injection seam as `eraseAccountData`).
 *
 * Execution order:
 *   1. Erase Notes (strict revocation before its fenced deletion), Timeline,
 *      and Signal in parallel. Each module is attempted even when another
 *      one fails.
 *   2. Erase Tasks, strictly revoking each Project Drive credential before
 *      its encrypted row is deleted.
 *   3. Revoke deduplicated tokens returned by legacy/module erasers
 *      strictly. Legacy implementations cannot provide durable retry custody;
 *      their revocation failures still block identity deletion.
 *   4. Reject with every module that failed, so Clerk deletion cannot run
 *      until all four product erasers have confirmed success.
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
    /** Strict, idempotent Project Drive credential revoker. */
    revokeProjectDriveRefreshToken?: AccountErasureOptions["revokeProjectDriveRefreshToken"];
    /** Recovery-only resolver for pre-fence delegated upload receipts. */
    recoverPendingDelegatedDriveUpload?: AccountErasureOptions["recoverPendingDelegatedDriveUpload"];
    /** Test seam; production always uses the real Tasks erasure. */
    eraseTasks?: TasksEraseFn;
  },
): Promise<void> {
  const failedModules: UnifiedErasureModule[] = [];

  // Step 1: erase Notes (retaining custody until revoked), Timeline, Signal.
  // allSettled ensures a thrown transport error cannot skip another eraser.
  const [notesAttempt, timelineAttempt, signalAttempt] =
    await Promise.allSettled([
      Promise.resolve().then(() =>
        opts.eraseNotes(clerkId, { revokeTokens: opts.revokeTokens }),
      ),
      Promise.resolve().then(() => opts.eraseTimeline(clerkId)),
      Promise.resolve().then(() => opts.eraseSignal(clerkId)),
    ]);

  let notesGoogleTokens: string[] = [];
  if (notesAttempt.status === "fulfilled") {
    notesGoogleTokens = notesAttempt.value.refreshTokens;
    if (!notesAttempt.value.ok) failedModules.push("Notes");
  } else {
    failedModules.push("Notes");
  }

  if (
    timelineAttempt.status === "rejected" ||
    !timelineAttempt.value.ok
  ) {
    failedModules.push("Timeline");
  }
  if (signalAttempt.status === "rejected" || !signalAttempt.value.ok) {
    failedModules.push("Signal");
  }

  // Step 2: Tasks collects every encrypted Google Drive generation and exact
  // grant receipt before provider revocation. Only after those calls succeed
  // does it consume operation-journal evidence and the RESTRICT-backed rows;
  // Project Drive plaintext never leaves that fail-closed erasure scope.
  let tasksGoogleTokens: readonly string[] = [];
  try {
    const tasksResult = opts.eraseTasks
      ? await opts.eraseTasks(database, clerkId)
      : await eraseTasksData(database, clerkId, {
          revokeDriveFolderGrant: opts.revokeDriveFolderGrant,
          revokeProjectDriveRefreshToken:
            opts.revokeProjectDriveRefreshToken,
          recoverPendingDelegatedDriveUpload:
            opts.recoverPendingDelegatedDriveUpload,
        });
    tasksGoogleTokens = tasksResult.googleRefreshTokens;
  } catch {
    failedModules.push("Tasks");
  }
  const googleTokens = [
    ...new Set([...notesGoogleTokens, ...tasksGoogleTokens]),
  ];

  // Step 3: legacy erasers may return detached tokens. Attempt these even when
  // another module failed, and never report complete if revocation fails.
  if (googleTokens.length > 0) {
    try {
      await opts.revokeTokens(googleTokens);
    } catch {
      if (notesGoogleTokens.length > 0) failedModules.push("Notes");
      if (tasksGoogleTokens.length > 0) failedModules.push("Tasks");
      opLog("warn", "gdpr", "Google token revocation failed");
    }
  }

  // Step 4: only a complete confirmation lets the caller proceed to Clerk.
  if (failedModules.length > 0) {
    opLog("error", "gdpr", "account erasure incomplete", {
      modules: failedModules.join(","),
    });
    throw new UnifiedAccountErasureError(failedModules);
  }
}

