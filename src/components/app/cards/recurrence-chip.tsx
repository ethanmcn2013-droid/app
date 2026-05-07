import type { Recurrence } from "@/lib/data";

/**
 * Tiny recurrence indicator for task cards. Sits in the card meta
 * row alongside due date / tags / priority — quiet enough to not
 * fight those signals, but glanceable so the user knows at-a-card
 * which tasks repeat.
 *
 * Label rules:
 *   freq + interval undefined|1 → "daily" / "weekly" / "monthly"
 *   freq + interval > 1         → "Nd" / "Nw" / "Nm"
 *
 * Renders nothing when `recurrence` is undefined so callers can
 * drop it unconditionally into a meta row without wrapping in
 * a conditional themselves.
 */
export function RecurrenceChip({
  recurrence,
}: {
  recurrence: Recurrence | undefined;
}) {
  if (!recurrence) return null;

  const interval = recurrence.interval ?? 1;
  const label = formatLabel(recurrence.freq, interval);
  const tooltip = formatTooltip(recurrence.freq, interval);

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full bg-bg-sunken/70 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-quiet"
      title={tooltip}
      aria-label={tooltip}
    >
      <span aria-hidden="true" className="text-[11px] leading-none">
        {"↻"}
      </span>
      {label}
    </span>
  );
}

function formatLabel(
  freq: Recurrence["freq"],
  interval: number,
): string {
  if (interval <= 1) return freq;
  const suffix = freq === "daily" ? "d" : freq === "weekly" ? "w" : "m";
  return `${interval}${suffix}`;
}

function formatTooltip(
  freq: Recurrence["freq"],
  interval: number,
): string {
  if (interval <= 1) return `Repeats ${freq}`;
  const unit =
    freq === "daily" ? "days" : freq === "weekly" ? "weeks" : "months";
  return `Repeats every ${interval} ${unit}`;
}
