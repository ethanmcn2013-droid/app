import type { ExportDb } from "@/server/account-export";
import { exportAccountData as exportTasksData } from "@/server/account-export";

// Types for the per-module export functions so tests can supply stubs.
export type NotesExportFn = (clerkId: string) => Promise<
  | { available: true; [key: string]: unknown }
  | { available: false; reason: string }
>;
export type TimelineExportFn = (clerkId: string) => Promise<
  | { available: true; [key: string]: unknown }
  | { available: false; reason: string }
>;
export type SignalExportFn = (clerkId: string) => Promise<
  | { available: true; [key: string]: unknown }
  | { available: false; reason: string }
>;

/**
 * GDPR Art. 20 (data portability) — unified Signal Studio export.
 *
 * Injectable form: accepts the Tasks DB handle and per-module export functions
 * so it can be exercised end-to-end in tests without network access (same
 * db-injection seam as `exportAccountData`).
 *
 * A module section is `{ available: false }` when its function throws or
 * returns that shape (e.g. when its DB env var is missing). It never throws,
 * and a missing module never blocks the rest of the export.
 *
 * Secrets omitted:
 *   - Notes `calendar_connections.refresh_token` (live Google OAuth credential)
 *   - Signal `user_preferences.unsubscribe_token` (opaque action credential)
 *   - Tasks `attachments.storedPath` (private disk/blob locator, not content)
 *   - Tasks Project Drive credential/storage ids, dedupe hashes, leases and
 *     provider web links (the export carries plain-language activity instead)
 */
export async function exportUnifiedAccountDataWith(
  database: ExportDb,
  clerkId: string,
  opts: {
    exportNotes: NotesExportFn;
    exportTimeline: TimelineExportFn;
    exportSignal: SignalExportFn;
  },
) {
  const exportedAt = new Date().toISOString();

  // Tasks: always present (host DB).
  const tasks = await exportTasksData(database, clerkId);

  // Module sections: degrade gracefully on missing config or query error.
  const [notesResult, timelineResult, signalResult] = await Promise.all([
    opts.exportNotes(clerkId).catch((err: unknown) => ({
      available: false as const,
      reason: err instanceof Error ? err.message : String(err),
    })),
    opts.exportTimeline(clerkId).catch((err: unknown) => ({
      available: false as const,
      reason: err instanceof Error ? err.message : String(err),
    })),
    opts.exportSignal(clerkId).catch((err: unknown) => ({
      available: false as const,
      reason: err instanceof Error ? err.message : String(err),
    })),
  ]);

  return {
    product: "signal" as const,
    exportedAt,
    clerkId,
    tasks,
    notes: notesResult,
    timeline: timelineResult,
    signal: signalResult,
  };
}

