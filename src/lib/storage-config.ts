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
 * The transport ceiling on a single upload, whatever the tier allows.
 *
 * WP-0 made this a re-export instead of a second opinion. It used to be an
 * independent literal that disagreed with `next.config.ts`, with the
 * client toast, and with the platform; the client-direct Blob flow now
 * carries the bytes and `MAX_UPLOAD_BYTES` is the only place the number
 * lives. The "client-upload token flow" the old comment here listed as a
 * follow-up is the flow that shipped: see `src/lib/upload-limit.ts`.
 *
 * The effective per-file cap remains min(maxFileBytes, this), so a free
 * board is still held to its own 10 MB — a tier promise, not a transport
 * one, and deliberately a different number.
 */
export { MAX_UPLOAD_BYTES as SERVER_UPLOAD_LIMIT_BYTES } from "@/lib/upload-limit";

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
