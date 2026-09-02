import type {
  AccountErasureOptions,
  AccountErasureReceipt,
  ErasureDb,
} from "@/server/account-erasure";
import { eraseAccountData as eraseTasksData } from "@/server/account-erasure";
import { opLog } from "@/server/operational-log";

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
 * Best-effort: a revocation failure is logged but never fatal. Provider errors
 * are not logged because their response bodies can contain credentials.
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
      } catch {
        opLog("warn", "gdpr", "Google token revocation failed");
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
 *      Timeline, and Signal in parallel. Each module is attempted even when
 *      another one fails.
 *   2. Erase Tasks, strictly revoking each Project Drive credential before
 *      its encrypted row is deleted.
 *   3. Revoke deduplicated tokens returned by legacy/module erasers
 *      (best-effort, and only after the rows that held them are gone).
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
    /** Test seam; production always uses the real Tasks erasure. */
    eraseTasks?: TasksEraseFn;
  },
): Promise<void> {
  const failedModules: UnifiedErasureModule[] = [];

  // Step 1: erase Notes (collecting tokens), Timeline, Signal in parallel.
  // allSettled ensures a thrown transport error cannot skip another eraser.
  const [notesAttempt, timelineAttempt, signalAttempt] =
    await Promise.allSettled([
      Promise.resolve().then(() => opts.eraseNotes(clerkId)),
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
        });
    tasksGoogleTokens = tasksResult.googleRefreshTokens;
  } catch {
    failedModules.push("Tasks");
  }
  const googleTokens = [
    ...new Set([...notesGoogleTokens, ...tasksGoogleTokens]),
  ];

  // Step 3: revoke Google tokens even when another module failed. Notes may
  // already have detached the only stored copies, so this custody must survive
  // every later failure. The seam is guarded as well as the production helper.
  if (googleTokens.length > 0) {
    try {
      await opts.revokeTokens(googleTokens);
    } catch {
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

