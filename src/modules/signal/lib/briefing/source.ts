import type { TaskSignal } from "./types";

/**
 * Identity passed into a BriefingSource. `userId` is the immutable suite
 * subject used for all cross-product authorization. `email` is retained only
 * for delivery/presentation and must never be used as a join key.
 */
export type BriefingContext = {
  userId: string;
  email: string;
};

/**
 * The data contract for "what signals does this user have today?".
 *
 * Implementations:
 *   - mockBriefingSource    Wedding 2026 demo (dev + onboarding).
 *   - tasksDbSource         Read-only join into the Tasks Turso DB.
 *
 * Picked at runtime by getBriefingSource() based on env vars. The
 * cron handler, /app/brief, and the Send-test action all go
 * through this interface, so swapping is one line of change.
 */
export interface BriefingSource {
  getSignalsForUser(ctx: BriefingContext): Promise<TaskSignal[]>;
}
