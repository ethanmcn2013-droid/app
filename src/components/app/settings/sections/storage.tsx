"use client";

import { SectionHeader } from "../settings-app";
import { Badge, Hint, SettingsGroup, SettingsRow, cx } from "../settings-ui";
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
    ? "bg-[var(--v3-danger)]"
    : isWarn
      ? "bg-[var(--v3-warning)]"
      : "bg-[var(--v3-accent)]";

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
        title={driveEnabled ? "Signal Studio storage" : "Storage"}
        description={driveEnabled ? "Files stored in Signal Studio count against this board’s allowance. Google Drive files use the storage owner’s Google space." : "Files stored in Signal Studio count against this board’s allowance."}
      />

      <SettingsGroup>
        <div className="px-4 py-5 md:px-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[12.5px] font-medium text-[color:var(--v3-text-2)]">Used</p>
              <p className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[color:var(--v3-text)]">
                {usageLabel}
                <span className="ml-1.5 text-[13px] font-normal tracking-normal text-[color:var(--v3-text-3)]">
                  of {totalLabel}
                </span>
              </p>
            </div>
            <Badge tone={isCritical ? "danger" : isWarn ? "warning" : "neutral"}>
              {pct}%
            </Badge>
          </div>

          {/* Usage bar */}
          <div
            className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--v3-sunken)] ring-1 ring-inset ring-[color:var(--v3-border)]"
            role="meter"
            aria-label="Storage used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className={cx("h-full rounded-full transition-[width] duration-500 ease-[var(--v3-ease)]", barColor)}
              style={{ width: `${Math.max(pct, usageBytes > 0 ? 1 : 0)}%` }}
            />
          </div>

          {isCritical ? (
            <div className="mt-2.5">
              <Hint tone="danger">
                Storage is nearly full. Delete unused attachments or upgrade to free
                up space.
              </Hint>
            </div>
          ) : isWarn ? (
            <div className="mt-2.5">
              <Hint tone="warning">
                You are approaching your storage limit. Consider cleaning up older
                attachments.
              </Hint>
            </div>
          ) : null}
        </div>

        <SettingsRow
          label="Per-file limit"
          description="The largest single file you can attach."
        >
          <span className="text-[13px] font-medium tabular-nums text-[color:var(--v3-text)]">
            {formatBytes(perFileBytes)} per file
          </span>
        </SettingsRow>
      </SettingsGroup>

      <p className="mt-4 px-0.5 text-[12px] leading-[1.55] text-[color:var(--v3-text-3)]">
        Files are attached from a task, in its Resources section. Files stored in Signal Studio are counted here.
      </p>
    </div>
  );
}
