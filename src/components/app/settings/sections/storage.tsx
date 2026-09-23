"use client";

import { SectionHeader } from "../settings-app";
import type { EntitlementTier } from "@/lib/data";
import { getQuota, WARN_THRESHOLDS } from "@/lib/storage-config";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageSection({
  tier,
  usageBytes,
  driveEnabled = false,
}: {
  tier: EntitlementTier;
  usageBytes: number;
  driveEnabled?: boolean;
}) {
  const quota = getQuota(tier);
  const ratio = usageBytes / quota.totalBytes;
  const pct = Math.min(100, Math.round(ratio * 100));

  const isWarn = ratio >= WARN_THRESHOLDS[0] && ratio < WARN_THRESHOLDS[1];
  const isCritical = ratio >= WARN_THRESHOLDS[1];

  const barColor = isCritical
    ? "bg-rose-500"
    : isWarn
      ? "bg-amber-500"
      : "bg-brand";

  const usageLabel = formatBytes(usageBytes);
  const totalLabel = formatBytes(quota.totalBytes);

  // What a person can actually attach: the smaller of what this plan
  // allows per file and what a single upload can carry. Before WP-0 this
  // panel showed the plan's number alone, which on a paid plan was 250 MB
  // — five times what any upload could deliver.
  const perFileBytes = Math.min(quota.maxFileBytes, MAX_UPLOAD_BYTES);

  return (
    <div>
      <SectionHeader
        eyebrow="Storage"
        title={driveEnabled ? "Signal Studio storage" : "Project storage"}
        description={driveEnabled ? "Files stored in Signal Studio count against this board’s allowance. Google Drive files use the storage owner’s Google space." : "Files stored in Signal Studio count against this board’s allowance."}
      />

      <div className="rounded-xl border border-line-soft bg-bg-elevated p-5">
        <div className="flex items-baseline justify-between gap-4">
          <div className="text-[13px] font-medium text-ink">
            {usageLabel}{" "}
            <span className="text-ink-soft">of {totalLabel} used</span>
          </div>
          <div className="text-[12px] tabular-nums text-ink-faint">{pct}%</div>
        </div>

        {/* Usage bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg-sunken">
          <div
            className={"h-full rounded-full transition-all " + barColor}
            style={{ width: `${pct}%` }}
          />
        </div>

        {isCritical ? (
          <p className="mt-2 text-[12px] leading-[1.5] text-rose-600">
            Storage is nearly full. Delete unused attachments or upgrade to free
            up space.
          </p>
        ) : isWarn ? (
          <p className="mt-2 text-[12px] leading-[1.5] text-amber-700">
            You are approaching your storage limit. Consider cleaning up older
            attachments.
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl border border-line-soft bg-bg-elevated p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Per-file limit
        </div>
        <div className="mt-1 text-[13px] text-ink-soft">
          {formatBytes(perFileBytes)} per file
        </div>
      </div>

      <p className="mt-4 text-[11.5px] leading-[1.55] text-ink-faint">
        Files are attached from a task, in its Resources section. Files stored in Signal Studio are counted here.
      </p>
    </div>
  );
}
