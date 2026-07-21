"use client";

import { SectionHeader } from "../settings-app";
import type { EntitlementTier } from "@/lib/data";
import { getQuota, WARN_THRESHOLDS } from "@/lib/storage-config";

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
}: {
  tier: EntitlementTier;
  usageBytes: number;
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

  return (
    <div>
      <SectionHeader
        eyebrow="Storage"
        title="Workspace storage"
        description="Attachments and uploaded files count against your workspace quota. The quota resets if you upgrade."
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
          {formatBytes(quota.maxFileBytes)} per upload
        </div>
      </div>

      <p className="mt-4 text-[11.5px] leading-[1.55] text-ink-faint">
        File uploads are not yet active on this workspace. Storage tracking
        will update when uploads ship.
      </p>
    </div>
  );
}
