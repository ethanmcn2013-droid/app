import type { EntitlementTier } from "@/lib/data";

/**
 * Storage quota constants. Labelled FALLBACK: these numbers are
 * operator-todos for founder ratification before any pricing page
 * cites them. See content/hq/operator-todos/premium-blob-storage.md.
 *
 * SINGLE SOURCE: nowhere else in the codebase should bytes appear.
 * Import getQuota(tier) or the named constants below.
 */

const FREE_TOTAL_BYTES = 100 * 1024 * 1024;   // 100 MB
const FREE_MAX_FILE_BYTES = 10 * 1024 * 1024;  // 10 MB per file

const PAID_TOTAL_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
const PAID_MAX_FILE_BYTES = 250 * 1024 * 1024;     // 250 MB per file

/**
 * Server-action uploads buffer the whole file in memory (arrayBuffer()).
 * Until a client-direct multipart Vercel Blob token flow ships (tracked
 * in docs/execution/signal-studio/MASTER_PLAN.md §1.4 OOM note), the
 * effective per-file cap is min(maxFileBytes, SERVER_UPLOAD_LIMIT_BYTES).
 *
 * Follow-up: implement client-upload token flow to lift the 50 MB ceiling
 * for paid tiers without OOM risk.
 */
export const SERVER_UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Thresholds at which the UI surfaces a calm storage-usage warning.
 * Values are fractions of totalBytes (0.8 = 80 %, 0.95 = 95 %).
 */
export const WARN_THRESHOLDS: readonly number[] = [0.8, 0.95] as const;

export type StorageQuota = {
  totalBytes: number;
  maxFileBytes: number;
};

/**
 * Resolve the storage quota for a tier. All paid/pro tiers share the
 * same generous quota; only the free tier is constrained.
 *
 * Tier ids are taken directly from EntitlementTier in src/lib/data.ts:
 *   "free" | "event" | "wedding" | "workspace" | "studio"
 * "free" is the only tier that uses the constrained quota. Every other
 * tier maps to the paid quota.
 */
export function getQuota(tier: EntitlementTier): StorageQuota {
  if (tier === "free") {
    return { totalBytes: FREE_TOTAL_BYTES, maxFileBytes: FREE_MAX_FILE_BYTES };
  }
  return { totalBytes: PAID_TOTAL_BYTES, maxFileBytes: PAID_MAX_FILE_BYTES };
}
